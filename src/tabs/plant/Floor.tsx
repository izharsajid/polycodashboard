import { Html } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import type { Machine } from '../../engine/machines'
import { shortName } from '../machines/parts'
import { AutoTrimmer, Laminator, ManualTrimmer, Thermoformer, type Lamp, type ModelProps } from './models'
import { T } from './palette'

/**
 * The plant floor, left to right in process order: thermoforming as two lines
 * of four standing back to back, then lamination, then trimming, joined by the
 * conveyor that carries trays from one stage to the next. Positions are floor
 * geometry in metres, not business figures; which machine stands where comes
 * from the plan's `floor` list.
 */
export type Placed = { machine: Machine; x: number; z: number; turn: number; zone: Zone }
export type Zone = 'forming' | 'lamination' | 'trimming'
export type Look = { status: Lamp; color: string }

const FORMER_PITCH = 5.2
/** Each former's back is half a metre from the shared centre line. */
const ROW_Z = 1.25
const LAMINATION_X = 4 * FORMER_PITCH + 3
const TRIMMING_X = LAMINATION_X + 6.5

export const ZONES: { zone: Zone; title: string; from: number; to: number }[] = [
  { zone: 'forming', title: 'Thermoforming', from: -2.8, to: 3 * FORMER_PITCH + 2.8 },
  { zone: 'lamination', title: 'Lamination', from: LAMINATION_X - 3.4, to: LAMINATION_X + 2.9 },
  { zone: 'trimming', title: 'Trimming', from: TRIMMING_X - 1.4, to: TRIMMING_X + 10.2 },
]
export const CENTRE: [number, number, number] = [(ZONES[0].from + ZONES[2].to) / 2, 0, 0]

export function place(floor: { forming_rows: [string[], string[]]; lamination: string[]; trimming: string[] }, machines: Machine[]): Placed[] {
  const byId = new Map(machines.map((m) => [m.id, m]))
  const out: Placed[] = []
  const put = (id: string, x: number, z: number, zone: Zone) => {
    const machine = byId.get(id)
    // A machine on the far side of the centre line faces away from it.
    if (machine) out.push({ machine, x, z, turn: z < 0 ? Math.PI : 0, zone })
  }
  floor.forming_rows[0].forEach((id, i) => put(id, i * FORMER_PITCH, -ROW_Z, 'forming'))
  floor.forming_rows[1].forEach((id, i) => put(id, i * FORMER_PITCH, ROW_Z, 'forming'))
  floor.lamination.forEach((id, i) => put(id, LAMINATION_X, i === 0 ? -2.6 : 2.6, 'lamination'))
  const manual = floor.trimming.filter((id) => !/auto/i.test(id))
  const auto = floor.trimming.filter((id) => /auto/i.test(id))
  manual.forEach((id, i) => put(id, TRIMMING_X + i * 3.4, -2.6, 'trimming'))
  auto.forEach((id, i) => put(id, TRIMMING_X + 1.2 + i * 5, 2.7, 'trimming'))
  return out
}

function Model({ type, auto, ...props }: ModelProps & { type: Machine['type']; auto: boolean }) {
  if (type === 'forming') return <Thermoformer {...props} />
  if (type === 'lamination') return <Laminator {...props} />
  return auto ? <AutoTrimmer {...props} /> : <ManualTrimmer {...props} />
}

/** `M1`, `Lam 1`, `Manual 1`: labels small enough for a phone. */
const tiny = (name: string) => shortName(name).replace(/^Machine /, 'M').replace(/^Lamination /, 'Lam ')

const LABEL_Y: Record<Zone, number> = { forming: 4.1, lamination: 3.6, trimming: 3.5 }

export default function Floor({
  placed,
  looks,
  selected,
  hovered,
  moving,
  flow,
  onSelect,
  onHover,
  compact = false,
}: {
  placed: Placed[]
  looks: Map<string, Look>
  selected: string | null
  hovered: string | null
  moving: boolean
  /** Colours of the products moving down the line today. */
  flow: string[]
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  /** Short labels, for a phone. */
  compact?: boolean
}) {
  const length = ZONES[2].to - ZONES[0].to + 2
  return (
    <group>
      {/* Floor and the painted stage zones */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTRE[0], 0, 0]} receiveShadow>
        <planeGeometry args={[ZONES[2].to - ZONES[0].from + 120, 120]} />
        <meshStandardMaterial color={T.floor} roughness={0.95} />
      </mesh>
      {ZONES.map((z) => (
        <group key={z.zone}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(z.from + z.to) / 2, 0.005, 0]} receiveShadow>
            <planeGeometry args={[z.to - z.from, 9.6]} />
            <meshStandardMaterial color={T.mist} roughness={0.9} />
          </mesh>
          {/* Yellow safety lines around each zone */}
          {[-4.8, 4.8].map((zz) => (
            <mesh key={zz} rotation={[-Math.PI / 2, 0, 0]} position={[(z.from + z.to) / 2, 0.01, zz]}>
              <planeGeometry args={[z.to - z.from, 0.12]} />
              <meshStandardMaterial color={T.yellow} />
            </mesh>
          ))}
          {[z.from, z.to].map((xx) => (
            <mesh key={xx} rotation={[-Math.PI / 2, 0, 0]} position={[xx, 0.01, 0]}>
              <planeGeometry args={[0.12, 9.6]} />
              <meshStandardMaterial color={T.yellow} />
            </mesh>
          ))}
          <Html position={[(z.from + z.to) / 2, 0.02, 5.5]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <span className="whitespace-nowrap text-small font-bold uppercase tracking-wide text-press-2">{z.title}</span>
          </Html>
        </group>
      ))}

      {/* The conveyor from forming, through lamination, to trimming */}
      <Conveyor from={ZONES[0].to - 1} length={length} flow={flow} moving={moving} />

      {placed.map((p) => {
        const look = looks.get(p.machine.id) ?? { status: 'none' as const, color: T.rule }
        const ring = p.machine.id === selected || p.machine.id === hovered
        const over = (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          onHover(p.machine.id)
        }
        return (
          <group
            key={p.machine.id}
            position={[p.x, 0, p.z]}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(p.machine.id)
            }}
            onPointerOver={over}
            onPointerOut={() => onHover(null)}
          >
            <group rotation={[0, p.turn, 0]}>
              <Model
                type={p.machine.type}
                auto={/auto/i.test(p.machine.name)}
                product={look.color}
                status={look.status}
                moving={moving && look.status === 'running'}
              />
            </group>
            {ring && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[p.zone === 'forming' ? 2.45 : 1.75, p.zone === 'forming' ? 2.6 : 1.9, 48]} />
                <meshBasicMaterial color={T.yellow} />
              </mesh>
            )}
            <Html position={[0, LABEL_Y[p.zone], 0]} center zIndexRange={[10, 0]}>
              <button
                type="button"
                onClick={() => onSelect(p.machine.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-sheet/95 px-2 py-0.5 text-[11px] font-semibold text-press shadow-card ${ring ? 'border-press' : 'border-rule'}`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: look.status === 'running' ? look.color : look.status === 'maintenance' ? T.amber : look.status === 'stopped' ? T.red : T.rule }}
                  aria-hidden
                />
                {compact ? tiny(p.machine.name) : shortName(p.machine.name)}
              </button>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

/** A low belt conveyor down the centre aisle, with trays travelling along it. */
function Conveyor({ from, length, flow, moving }: { from: number; length: number; flow: string[]; moving: boolean }) {
  const trays = useRef<Group>(null)
  const count = 14
  useFrame(({ clock }) => {
    if (!moving || !trays.current) return
    const t = clock.getElapsedTime()
    trays.current.children.forEach((child, i) => {
      child.position.x = from + (((t * 1.2 + (i * length) / count) % length) + length) % length
    })
  })
  return (
    <group>
      <mesh position={[from + length / 2, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, 0.08, 0.7]} />
        <meshStandardMaterial color={T.ink} roughness={0.8} />
      </mesh>
      {[-0.38, 0.38].map((z) => (
        <mesh key={z} position={[from + length / 2, 0.58, z]} castShadow>
          <boxGeometry args={[length, 0.12, 0.06]} />
          <meshStandardMaterial color={T.steel} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {Array.from({ length: Math.floor(length / 2) + 1 }, (_, i) =>
        [-0.3, 0.3].map((z) => (
          <mesh key={`${i}${z}`} position={[from + i * 2, 0.26, z]}>
            <cylinderGeometry args={[0.035, 0.035, 0.52, 10]} />
            <meshStandardMaterial color={T.steel} metalness={0.5} />
          </mesh>
        )),
      )}
      {flow.length > 0 && (
        <group ref={trays}>
          {Array.from({ length: count }, (_, i) => (
            <mesh key={i} position={[from + (i * length) / count, 0.66, 0]} castShadow>
              <boxGeometry args={[0.36, 0.1, 0.46]} />
              <meshStandardMaterial color={flow[i % flow.length]} roughness={0.5} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}
