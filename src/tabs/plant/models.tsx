import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { T } from './palette'

/**
 * The plant's machines, built from simple solids to the photographs Izhar sent:
 * the twin-station fibre forming press, the laminating press, the manual
 * hydraulic trimming press and the automatic travelling-head trimmer. Each is
 * drawn front-facing +z, standing on the floor at the origin, in metres.
 *
 * `product` colours the trays in the mould, `status` lights the stack light, and
 * `moving` runs the press cycle while the machine is running and motion is on.
 */
/** The stack light: green running, amber in maintenance, red not running, dark with no plan. */
export type Lamp = 'running' | 'maintenance' | 'stopped' | 'none'
export type ModelProps = { product: string; status: Lamp; moving: boolean }

type V3 = [number, number, number]

function Box({
  size,
  at,
  color,
  metal = 0.1,
  rough = 0.6,
  opacity,
  rotation,
}: {
  size: V3
  at: V3
  color: string
  metal?: number
  rough?: number
  opacity?: number
  rotation?: V3
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        metalness={metal}
        roughness={rough}
        transparent={opacity !== undefined}
        opacity={opacity ?? 1}
        depthWrite={opacity === undefined}
      />
    </mesh>
  )
}

function Cyl({ r, h, at, color, rotation, metal = 0.3 }: { r: number; h: number; at: V3; color: string; rotation?: V3; metal?: number }) {
  return (
    <mesh position={at} rotation={rotation} castShadow>
      <cylinderGeometry args={[r, r, h, 20]} />
      <meshStandardMaterial color={color} metalness={metal} roughness={0.45} />
    </mesh>
  )
}

function Ball({ r, at, color }: { r: number; at: V3; color: string }) {
  return (
    <mesh position={at}>
      <sphereGeometry args={[r, 12, 12]} />
      <meshStandardMaterial color={color} roughness={0.4} />
    </mesh>
  )
}

/** Red, amber and green lamps on a pole, lit by the machine's state on the day. */
export function StackLight({ at, status }: { at: V3; status: Lamp }) {
  const lamps: { color: string; lit: boolean }[] = [
    { color: T.red, lit: status === 'stopped' },
    { color: T.amber, lit: status === 'maintenance' },
    { color: T.green, lit: status === 'running' },
  ]
  return (
    <group position={at}>
      <Cyl r={0.025} h={0.25} at={[0, 0.125, 0]} color={T.steel} />
      {lamps.map((l, i) => (
        <mesh key={i} position={[0, 0.34 + (2 - i) * 0.13, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 16]} />
          <meshStandardMaterial
            color={l.color}
            emissive={l.color}
            emissiveIntensity={l.lit ? 2.4 : 0}
            toneMapped={!l.lit}
            transparent={!l.lit}
            opacity={l.lit ? 1 : 0.35}
          />
        </mesh>
      ))}
    </group>
  )
}

/** A press stroke: 0 at the top, 1 at the bottom, a short dwell at each end. */
function stroke(t: number, speed: number, phase = 0) {
  const s = Math.sin(t * speed + phase)
  return Math.min(1, Math.max(0, s * 0.75 + 0.5))
}

/** Twin-station forming press: a cylinder, platen and mould set either side of the control column. */
export function Thermoformer({ product, status, moving }: ModelProps) {
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!moving) return
    const t = clock.getElapsedTime()
    if (left.current) left.current.position.y = 1.78 - 0.5 * stroke(t, 1.6)
    if (right.current) right.current.position.y = 1.78 - 0.5 * stroke(t, 1.6, Math.PI)
  })
  const hot = status === 'running'
  return (
    <group>
      {/* Cabinet base with its doors */}
      <Box size={[4.2, 0.84, 1.4]} at={[0, 0.5, 0]} color={T.teal} />
      {[-1.75, -1.05, -0.35, 0.35, 1.05, 1.75].map((x) => (
        <Box key={x} size={[0.6, 0.62, 0.02]} at={[x, 0.5, 0.71]} color={T.sheet} />
      ))}
      {[-1.95, 1.95].map((x) => (
        <Box key={x} size={[0.22, 0.08, 1.3]} at={[x, 0.04, 0]} color={T.steel} />
      ))}
      <Box size={[4.4, 0.08, 1.5]} at={[0, 0.96, 0]} color={T.mist} metal={0.4} />

      {[-1.35, 1.35].map((sx, i) => (
        <group key={sx} position={[sx, 0, 0]}>
          {/* Guide posts */}
          {[
            [-0.7, -0.45],
            [0.7, -0.45],
            [-0.7, 0.45],
            [0.7, 0.45],
          ].map(([dx, dz]) => (
            <Cyl key={`${dx}${dz}`} r={0.05} h={1.3} at={[dx, 1.65, dz]} color={T.yellow} metal={0.2} />
          ))}
          {/* Lower mould with formed trays in the product's colour */}
          <Box size={[1.3, 0.14, 0.85]} at={[0, 1.07, 0]} color={T.yellow} />
          {[0, 1, 2, 3].flatMap((a) =>
            [0, 1].map((b) => <Box key={`${a}${b}`} size={[0.26, 0.06, 0.3]} at={[-0.45 + a * 0.3, 1.17, -0.2 + b * 0.4]} color={product} />),
          )}
          {/* Heated upper platen and mould, with the rod up into the hood */}
          <group ref={i === 0 ? left : right} position={[0, 1.78, 0]}>
            <Box size={[1.5, 0.1, 0.95]} at={[0, 0, 0]} color={T.steel} metal={0.5} />
            <Box size={[1.3, 0.08, 0.85]} at={[0, -0.09, 0]} color={hot ? T.heat : T.rule} />
            <Cyl r={0.045} h={0.9} at={[0, 0.5, 0]} color={T.mist} metal={0.7} />
          </group>
          {/* Hood and pneumatic cylinder */}
          <Box size={[1.75, 0.5, 1.25]} at={[0, 2.55, 0]} color={T.mist} />
          <Cyl r={0.16} h={0.55} at={[0, 3.08, 0]} color={T.sheet} />
          <Cyl r={0.2} h={0.06} at={[0, 3.38, 0]} color={T.steel} />
          <Box size={[0.08, 0.08, 0.08]} at={[-0.62, 2.6, 0.63]} color={T.ink} />
        </group>
      ))}

      {/* Control column: screen, buttons, heater boxes and the stack light */}
      <Box size={[0.9, 1.72, 1.05]} at={[0, 1.86, 0]} color={T.mist} />
      <Box size={[0.5, 0.3, 0.02]} at={[0, 2.25, 0.53]} color={T.glass} />
      {[-0.24, -0.08, 0.08, 0.24].map((x, i) => (
        <Ball key={x} r={0.035} at={[x, 1.98, 0.54]} color={i % 2 ? T.red : T.green} />
      ))}
      <Box size={[0.38, 0.32, 0.45]} at={[-0.23, 2.88, 0.2]} color={T.sheet} />
      <Box size={[0.38, 0.32, 0.45]} at={[0.23, 2.88, 0.2]} color={T.sheet} />
      <StackLight at={[0, 2.72, -0.32]} status={status} />
    </group>
  )
}

/** Laminating press: film tray sliding in from one side, the press housing, roller conveyor out. */
export function Laminator({ product, status, moving }: ModelProps) {
  const tray = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (moving && tray.current) tray.current.position.x = -2.3 + 0.7 * stroke(clock.getElapsedTime(), 1.1)
  })
  const hot = status === 'running'
  return (
    <group>
      {/* Base platform */}
      <Box size={[3.4, 0.9, 2.2]} at={[0, 0.45, 0]} color={T.rule} metal={0.3} />
      <Box size={[3.5, 0.05, 2.3]} at={[0, 0.92, 0]} color={T.mist} metal={0.4} />
      {/* Press housing with its opening, heated platen and grid top */}
      <Box size={[1.6, 1.1, 1.7]} at={[0, 1.5, 0]} color={T.sheet} />
      <Box size={[1.2, 0.6, 0.02]} at={[0, 1.3, 0.86]} color={T.ink} />
      <Box size={[1.05, 0.08, 0.03]} at={[0, 1.52, 0.87]} color={hot ? T.heat : T.rule} />
      <Box size={[1.75, 0.12, 1.85]} at={[0, 2.11, 0]} color={T.mist} />
      {[-0.3, 0.3].map((x) => (
        <Box key={x} size={[0.03, 0.03, 1.85]} at={[x, 2.18, 0]} color={T.steel} />
      ))}
      {/* Cylinder frame, cylinder and rod */}
      {[-0.35, 0.35].map((x) => (
        <Box key={x} size={[0.08, 0.6, 0.08]} at={[x, 2.47, 0]} color={T.steel} />
      ))}
      <Box size={[0.82, 0.08, 0.14]} at={[0, 2.8, 0]} color={T.steel} />
      <Cyl r={0.13} h={0.5} at={[0, 2.45, 0]} color={T.sheet} />
      <Cyl r={0.03} h={0.6} at={[0, 3.12, 0]} color={T.steel} metal={0.7} />
      {/* Film tray on its rails */}
      <group ref={tray} position={[-2.3, 0, 0]}>
        <Box size={[1.6, 0.05, 1.5]} at={[0, 1.25, 0]} color={T.glass} opacity={0.75} />
      </group>
      {[-0.75, 0.75].map((z) => (
        <Box key={z} size={[1.9, 0.06, 0.06]} at={[-2.2, 1.2, z]} color={T.steel} />
      ))}
      {[-0.7, 0.7].map((z) => (
        <Cyl key={z} r={0.04} h={1.2} at={[-3.05, 0.6, z]} color={T.steel} />
      ))}
      {/* Roller conveyor carrying sealed trays out */}
      <Box size={[1.6, 0.08, 1.2]} at={[1.85, 0.98, 0]} color={T.steel} metal={0.4} />
      {Array.from({ length: 8 }, (_, i) => (
        <Cyl key={i} r={0.05} h={1.15} at={[1.15 + i * 0.2, 1.06, 0]} rotation={[Math.PI / 2, 0, 0]} color={T.mist} metal={0.6} />
      ))}
      {[1.3, 1.8, 2.3].map((x) => (
        <Box key={x} size={[0.3, 0.08, 0.4]} at={[x, 1.15, 0]} color={product} />
      ))}
      <Box size={[0.45, 0.8, 0.3]} at={[-1.25, 1.35, 0.85]} color={T.sheet} />
      <Box size={[0.3, 0.18, 0.02]} at={[-1.25, 1.55, 1.01]} color={T.glass} />
      <StackLight at={[0.65, 2.17, 0.7]} status={status} />
    </group>
  )
}

/** Manual hydraulic four-post trimming press behind red mesh guards, control box beside it. */
export function ManualTrimmer({ product, status, moving }: ModelProps) {
  const platen = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (moving && platen.current) platen.current.position.y = 1.9 - 0.55 * stroke(clock.getElapsedTime(), 2)
  })
  return (
    <group>
      {/* Base cabinet, feet, yellow edge and two-hand buttons */}
      <Box size={[1.4, 0.95, 1.1]} at={[0, 0.57, 0]} color={T.blue} />
      {[-0.5, 0.5].map((x) => (
        <Box key={x} size={[0.32, 0.1, 1.22]} at={[x, 0.05, 0]} color={T.blue} />
      ))}
      <Box size={[1.42, 0.04, 1.12]} at={[0, 1.06, 0]} color={T.yellow} />
      <Box size={[0.8, 0.08, 0.02]} at={[0, 0.78, 0.56]} color={T.ink} />
      {[-0.4, 0.4].map((x) => (
        <group key={x}>
          <Box size={[0.14, 0.12, 0.12]} at={[x, 0.95, 0.6]} color={T.sheet} />
          <Ball r={0.04} at={[x, 1.04, 0.6]} color={T.red} />
        </group>
      ))}
      {/* Bed, posts, crown, cylinder and gauge */}
      <Box size={[1.25, 0.06, 0.95]} at={[0, 1.11, 0]} color={T.mist} metal={0.5} />
      {[
        [-0.5, -0.35],
        [0.5, -0.35],
        [-0.5, 0.35],
        [0.5, 0.35],
      ].map(([x, z]) => (
        <Cyl key={`${x}${z}`} r={0.045} h={1.3} at={[x, 1.78, z]} color={T.mist} metal={0.8} />
      ))}
      <Box size={[1.3, 0.22, 0.95]} at={[0, 2.45, 0]} color={T.blue} />
      <Cyl r={0.17} h={0.45} at={[0, 2.78, 0]} color={T.blue} />
      <Cyl r={0.22} h={0.07} at={[0, 3.03, 0]} color={T.blue} />
      <Cyl r={0.1} h={0.03} at={[0.3, 2.75, 0.2]} rotation={[Math.PI / 2, 0, 0]} color={T.sheet} />
      {/* Yellow moving platen with the cutting die */}
      <group ref={platen} position={[0, 1.9, 0]}>
        <Box size={[1.2, 0.12, 0.88]} at={[0, 0, 0]} color={T.yellow} />
        <Box size={[0.6, 0.1, 0.5]} at={[0, -0.11, 0]} color={T.rule} metal={0.5} />
      </group>
      {[-0.35, 0, 0.35].map((x) => (
        <Box key={x} size={[0.24, 0.07, 0.3]} at={[x, 1.18, 0]} color={product} />
      ))}
      {/* Red mesh guards */}
      {[-0.7, 0.7].map((x) => (
        <group key={x}>
          <Box size={[0.03, 1.3, 1.0]} at={[x, 1.78, 0]} color={T.red} opacity={0.28} />
          {[-0.5, 0.5].map((z) => (
            <Box key={z} size={[0.05, 1.3, 0.05]} at={[x, 1.78, z]} color={T.red} />
          ))}
          <Box size={[0.05, 0.05, 1.0]} at={[x, 2.43, 0]} color={T.red} />
          <Box size={[0.05, 0.05, 1.0]} at={[x, 1.13, 0]} color={T.red} />
        </group>
      ))}
      {/* Control box */}
      <Box size={[0.32, 0.55, 0.14]} at={[0.98, 1.75, 0.1]} color={T.sheet} />
      <Box size={[0.2, 0.08, 0.02]} at={[0.98, 1.92, 0.18]} color={T.ink} />
      <Box size={[0.04, 0.04, 0.3]} at={[0.82, 1.75, 0.1]} color={T.steel} />
      <StackLight at={[0.98, 2.02, 0.1]} status={status} />
    </group>
  )
}

/** Automatic travelling-head cutting press: feed table through it, hydraulic pack, control cabinet. */
export function AutoTrimmer({ product, status, moving }: ModelProps) {
  const head = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!moving || !head.current) return
    const t = clock.getElapsedTime()
    head.current.position.x = 0.35 * Math.sin(t * 0.7)
    head.current.position.y = 1.62 - 0.3 * stroke(t, 2.8)
  })
  return (
    <group>
      {/* Body, side columns and top beam */}
      <Box size={[1.9, 0.9, 1.3]} at={[0, 0.45, 0]} color={T.blue} />
      {[-0.85, 0.85].map((x) => (
        <Box key={x} size={[0.3, 0.85, 1.3]} at={[x, 1.33, 0]} color={T.blue} />
      ))}
      <Box size={[2.1, 0.38, 1.35]} at={[0, 1.94, 0]} color={T.blue} />
      <Box size={[0.4, 0.15, 0.02]} at={[0, 1.94, 0.68]} color={T.sheet} />
      {/* Travelling cutting head */}
      <group ref={head} position={[0, 1.62, 0]}>
        <Box size={[0.7, 0.2, 1.1]} at={[0, 0, 0]} color={T.steel} metal={0.5} />
      </group>
      {/* Feed table through the press, with white side guards */}
      <Box size={[3.8, 0.06, 1.25]} at={[0, 0.98, 0]} color={T.sheet} />
      {[-1.65, 1.65].map((x) => (
        <Box key={x} size={[0.45, 0.28, 1.25]} at={[x, 1.15, 0]} color={T.sheet} />
      ))}
      {[-1.85, 1.85].map((x) =>
        [-0.5, 0.5].map((z) => <Cyl key={`${x}${z}`} r={0.04} h={0.95} at={[x, 0.48, z]} color={T.steel} />),
      )}
      {[-1.15, -0.55, 0.55, 1.15].map((x) => (
        <Box key={x} size={[0.3, 0.07, 0.4]} at={[x, 1.05, 0]} color={product} />
      ))}
      {/* Hydraulic pack: tank and motor */}
      <Box size={[0.7, 0.35, 0.5]} at={[-1.25, 0.18, 1.0]} color={T.blue} />
      <Cyl r={0.14} h={0.4} at={[-1.25, 0.48, 1.0]} rotation={[0, 0, Math.PI / 2]} color={T.yellow} />
      {/* Free-standing control cabinet */}
      <Box size={[0.55, 1.7, 0.5]} at={[2.35, 0.85, 0.3]} color={T.mist} />
      <Box size={[0.36, 0.26, 0.02]} at={[2.35, 1.4, 0.56]} color={T.glass} />
      {[2.25, 2.35, 2.45].map((x, i) => (
        <Ball key={x} r={0.03} at={[x, 1.15, 0.56]} color={[T.green, T.red, T.yellow][i]} />
      ))}
      <StackLight at={[2.35, 1.7, 0.3]} status={status} />
    </group>
  )
}
