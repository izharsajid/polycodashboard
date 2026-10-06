import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { CalendarClock, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import Panel from '../../components/Panel'
import { MachinesPayload } from '../../data/schemas'
import { useApiData } from '../../data/useApiData'
import { useTracker } from '../../data/useTracker'
import { addDays, buildMachines, dayNumber, nowOf, upcoming, type Bar, type Machine, type Now } from '../../engine/machines'
import { day, dayMonth } from '../../lib/format'
import { look, Orders, StatusPill, Swatch } from '../machines/parts'
import Floor, { CENTRE, place, type Look, type Zone } from './Floor'
import type { Lamp } from './models'
import { FAMILY_HEX, T } from './palette'

/**
 * The plant in 3D, as a process line: thermoforming in two back-to-back lines
 * of four, then lamination, then trimming. Pick a day and every machine shows
 * what it runs then; click one for what it runs now and next. Play steps the
 * days forward, so machines change product and stop as the plan says.
 */
/** The stack light for a machine's state on the day. */
const lampOf = (now: Now): Lamp =>
  now.state === 'running' ? 'running' : now.state === 'maintenance' ? 'maintenance' : now.state === 'no-plan' ? 'none' : 'stopped'

const ZONE_TITLE: Record<Zone, string> = { forming: 'Thermoforming', lamination: 'Lamination', trimming: 'Trimming' }

/** Today in Bahrain, as YYYY-MM-DD. */
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bahrain' })

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  useEffect(() => {
    const q = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!q) return
    const on = () => setReduced(q.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return reduced
}

/** Whether the element is on screen, so the scene stops drawing when scrolled away. */
function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(true)
  useEffect(() => {
    if (!ref.current || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting))
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  return [ref, seen] as const
}

export default function PlantTab() {
  const plan = useApiData('/api/machines', MachinesPayload, 'machine plan')
  const { tracker, loading } = useTracker()
  const model = useMemo(() => (plan.status === 'ready' ? buildMachines(plan.data.plan, tracker) : null), [plan, tracker])
  const placed = useMemo(() => (plan.status === 'ready' && model ? place(plan.data.plan.floor, model.machines) : []), [plan, model])

  const [chosen, setChosen] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const reduced = usePrefersReducedMotion()
  const [frame, onScreen] = useOnScreen<HTMLDivElement>()
  const controls = useRef<OrbitControlsImpl>(null)
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640

  const span = model?.range ?? null
  const start = span ? clamp(todayIso(), span.from, span.to) : ''
  const date = chosen ?? start

  // Play steps one day at a time to the end of the plan, then stops.
  useEffect(() => {
    if (!playing || !span) return
    const id = window.setInterval(() => {
      setChosen((d) => {
        const next = addDays(d ?? start, 1)
        if (next >= span.to) setPlaying(false)
        return next > span.to ? span.to : next
      })
    }, 350)
    return () => window.clearInterval(id)
  }, [playing, span, start])

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  if (plan.status === 'loading' || loading) return <p className="mt-8 text-body text-press-2" aria-busy="true">Loading the plant.</p>
  if (plan.status === 'failed' || !model || !span) {
    return (
      <p role="alert" className="mt-8 max-w-prose rounded-card border-l-3 border-alert bg-sheet py-3 pl-4 pr-4 text-body text-alert">
        {plan.status === 'failed' ? plan.error : 'The machine plan could not be read.'}
      </p>
    )
  }

  const states = new Map(placed.map((p) => [p.machine.id, nowOf(p.machine, date)]))
  const looks = new Map<string, Look>(
    placed.map((p) => {
      const now = states.get(p.machine.id)!
      return [p.machine.id, { status: lampOf(now), color: now.state === 'running' ? FAMILY_HEX[now.bar.family] : T.rule }]
    }),
  )
  const count = (k: Lamp) => [...states.values()].filter((n) => lampOf(n) === k).length
  const flow = [...new Set([...states.values()].flatMap((n) => (n.state === 'running' ? [FAMILY_HEX[n.bar.family]] : [])))]
  const days = dayNumber(span.to) - dayNumber(span.from)
  const offset = dayNumber(date) - dayNumber(span.from)
  const moving = !reduced && onScreen
  const pick = placed.find((p) => p.machine.id === selected) ?? null
  // A phone is taller than wide, so there the line is turned to run top to
  // bottom and seen from nearly overhead; on a wide screen it runs left to right.
  const turn = narrow ? -Math.PI / 2 : 0
  const target: [number, number, number] = narrow ? [0, 0, CENTRE[0]] : CENTRE
  const camera: [number, number, number] = narrow ? [0, 50, CENTRE[0] + 32] : [CENTRE[0] - 2, 15, 31]

  return (
    <div className="space-y-6 pt-6">
      <header>
        <h1 className="condensed text-figure font-bold">Plant</h1>
        <p className="mt-1 max-w-prose text-table text-press-2">
          The process line in 3D: thermoforming in two lines of four standing back to back, then lamination, then
          trimming. Pick a day to see what every machine runs then, or press play to watch the plan unfold. Click a
          machine for what it runs now and next.
        </p>
      </header>

      {/* The day */}
      <section aria-label="Day" className="rounded-card bg-sheet p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!playing && date >= span.to) setChosen(start)
              setPlaying((p) => !p)
            }}
            aria-pressed={playing}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-press px-4 text-table font-semibold text-sheet"
          >
            {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              setChosen(null)
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-rule px-4 text-table font-semibold hover:border-press-2"
          >
            <CalendarClock size={16} aria-hidden /> Today
          </button>
          <p className="text-title font-bold" aria-live="polite">
            {day(date)}
          </p>
          <ul className="flex flex-wrap gap-1.5 text-small font-semibold">
            <li className="rounded-full bg-income-wash px-2.5 py-1 text-income">{count('running')} running</li>
            {count('maintenance') > 0 && <li className="rounded-full bg-caution-wash px-2.5 py-1 text-caution">{count('maintenance')} in maintenance</li>}
            <li className="rounded-full bg-mist px-2.5 py-1 text-press-2">{count('stopped')} not running</li>
            {count('none') > 0 && <li className="rounded-full bg-mist px-2.5 py-1 text-press-2">{count('none')} no plan yet</li>}
          </ul>
        </div>
        <label className="mt-3 block">
          <span className="sr-only">Day on the plan</span>
          <input
            type="range"
            min={0}
            max={days}
            value={offset}
            onChange={(e) => {
              setPlaying(false)
              setChosen(addDays(span.from, Number(e.target.value)))
            }}
            className="w-full accent-press"
          />
        </label>
        <div className="flex justify-between text-small text-press-2">
          <span>{dayMonth(span.from)}</span>
          <span>{dayMonth(span.to)}</span>
        </div>
      </section>

      {/* The plant */}
      <div ref={frame} className="relative h-[62vh] min-h-[380px] max-h-[720px] overflow-hidden rounded-card bg-sheet shadow-card">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          frameloop={moving ? 'always' : 'demand'}
          camera={{ position: camera, fov: narrow ? 44 : 38, near: 0.5, far: 300 }}
          onPointerMissed={() => setHovered(null)}
          fallback={
            <p className="p-6 text-body text-press-2">
              This browser cannot draw the 3D plant. Every machine is listed below.
            </p>
          }
          aria-label="3D view of the plant floor"
        >
          <color attach="background" args={[T.floor]} />
          <fog attach="fog" args={[T.floor, 60, 110]} />
          <hemisphereLight args={[T.sheet, T.floor, 1.1]} />
          <directionalLight
            position={narrow ? [18, 30, CENTRE[0] + 12] : [CENTRE[0] + 12, 30, 18]}
            intensity={1.6}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
            shadow-camera-far={90}
          />
          <group rotation={[0, turn, 0]}>
            <Floor
              placed={placed}
              looks={looks}
              selected={selected}
              hovered={hovered}
              moving={moving}
              flow={flow}
              onSelect={setSelected}
              onHover={setHovered}
              compact={narrow}
            />
          </group>
          <OrbitControls
            ref={controls}
            makeDefault
            target={target}
            enableDamping
            maxPolarAngle={1.3}
            minDistance={8}
            maxDistance={90}
          />
        </Canvas>
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <p className="rounded-full bg-sheet/90 px-3 py-1 text-small text-press-2">Drag to turn, scroll or pinch to zoom</p>
          <button
            type="button"
            onClick={() => controls.current?.reset()}
            className="pointer-events-auto inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-rule bg-sheet px-3 text-small font-semibold hover:border-press-2"
          >
            <RotateCcw size={14} aria-hidden /> Reset view
          </button>
        </div>
      </div>

      {/* Every machine, as a list: the way in by keyboard, and without 3D */}
      <section aria-labelledby="plant-list">
        <h2 id="plant-list" className="text-title font-bold">
          Every machine on {day(date)}
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {(['forming', 'lamination', 'trimming'] as Zone[]).map((zone) => (
            <div key={zone}>
              <h3 className="text-small font-bold uppercase tracking-wide text-press-2">{ZONE_TITLE[zone]}</h3>
              <ul className="mt-1.5 space-y-1.5">
                {placed
                  .filter((p) => p.zone === zone)
                  .map((p) => {
                    const now = states.get(p.machine.id)!
                    return (
                      <li key={p.machine.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(p.machine.id)}
                          className="flex min-h-[44px] w-full items-center gap-3 rounded-card border border-rule bg-sheet px-3 py-2 text-left hover:border-press-2"
                        >
                          <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: looks.get(p.machine.id)!.color }} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block text-table font-semibold">{p.machine.name}</span>
                            <span className="block truncate text-small text-press-2">
                              {now.state === 'running' ? `${now.bar.product}, to ${dayMonth(now.bar.to)}` : look(now).label}
                            </span>
                          </span>
                          <span className="shrink-0">
                            <StatusPill now={now} />
                          </span>
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {pick && (
        <Panel
          open
          onClose={() => setSelected(null)}
          title={pick.machine.name}
          eyebrow={`${ZONE_TITLE[pick.zone]} · ${day(date)}`}
          badges={<StatusPill now={states.get(pick.machine.id)!} />}
        >
          <MachineDetail machine={pick.machine} date={date} live={model.live} />
        </Panel>
      )}
    </div>
  )
}

function clamp(d: string, from: string, to: string) {
  return d < from ? from : d > to ? to : d
}

/** What a machine runs on the day, and what comes after. */
function MachineDetail({ machine, date, live }: { machine: Machine; date: string; live: boolean }) {
  const now = nowOf(machine, date)
  const current = now.state === 'running' ? now.bar : null
  const next = upcoming(machine, date).filter((b) => b !== current && !(current && b.from === current.from))
  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-small font-bold uppercase tracking-wide text-press-2">Running now</h3>
        {current ? (
          <RunBlock bar={current} live={live} />
        ) : (
          <p className="mt-1 text-body text-press-2">
            {now.state === 'maintenance' ? `In maintenance${machine.note ? `: ${machine.note.replace(/\.+$/, '')}` : ''}.` : `${look(now).label}.`}
          </p>
        )}
      </section>
      <section>
        <h3 className="text-small font-bold uppercase tracking-wide text-press-2">Next</h3>
        {next.length ? (
          <ol className="mt-1 space-y-3">
            {next.map((b) => (
              <li key={`${b.product}-${b.from}`}>
                <RunBlock bar={b} live={live} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-body text-press-2">Nothing further on the plan.</p>
        )}
      </section>
      {machine.stops && machine.stops >= date && (
        <p className="rounded bg-caution-wash px-3 py-2 text-table font-semibold text-caution">
          Stops {day(machine.stops)}
          {machine.stopNote ? `: ${machine.stopNote}` : ''}
        </p>
      )}
    </div>
  )
}

function RunBlock({ bar, live }: { bar: Bar; live: boolean }) {
  const r = bar.run
  return (
    <div className="mt-1 space-y-2 rounded-card border border-rule p-3">
      <div>
        <p className="flex items-center gap-2 text-body font-semibold">
          <Swatch family={bar.family} className="h-3 w-3" />
          {bar.product}
        </p>
        <p className="text-small text-press-2">
          {r.from === null ? 'Already running' : `From ${day(r.from)}`}
          {r.until === null ? ', no end date' : ` to ${day(bar.to)}`}
        </p>
        {r.note && <p className="text-small font-semibold text-caution">{r.note}</p>}
      </div>
      <Orders run={r} live={live} />
    </div>
  )
}
