import type { Family, MachineStatus, MachineType } from '../../engine/machines'

/**
 * Line drawings of the plant's machines, side on: a semi-automatic thermoformer,
 * a laminator, a trimming press and an X-ray tunnel. Each carries a stack light
 * showing its status, and the product it is running in that product's colour.
 * Decorative: the card beside each says everything in words.
 */
export const FAMILY_FILL: Record<Family, string> = {
  medical: 'fill-cat-payroll',
  platinum: 'fill-cat-supplier',
  oasis: 'fill-cat-facility',
  pointfive: 'fill-cat-raw',
  destiny: 'fill-cat-logistics',
  other: 'fill-press-2',
}
export const FAMILY_BG: Record<Family, string> = {
  medical: 'bg-cat-payroll',
  platinum: 'bg-cat-supplier',
  oasis: 'bg-cat-facility',
  pointfive: 'bg-cat-raw',
  destiny: 'bg-cat-logistics',
  other: 'bg-press-2',
}
export const FAMILY_LABEL: Record<Family, string> = {
  medical: 'Medical trays',
  platinum: 'Platinum trays',
  oasis: 'Oasis trays',
  pointfive: 'Point Five',
  destiny: 'Destiny 7x7',
  other: 'Other work',
}

type Props = { type: MachineType; status: MachineStatus; family: Family | null; className?: string }

export default function MachineArt({ type, status, family, className }: Props) {
  const product = family ? FAMILY_FILL[family] : 'fill-rule'
  const on = status === 'running' || status === 'changing'
  return (
    <svg viewBox="0 0 260 150" className={className} aria-hidden>
      <line x1="4" x2="256" y1="136" y2="136" className="stroke-rule" strokeWidth="2" />
      {type === 'forming' && <Thermoformer product={product} on={on} />}
      {type === 'lamination' && <Laminator product={product} on={on} />}
      {type === 'trimming' && <Trimmer product={product} on={on} />}
      {type === 'xray' && <Xray product={product} on={on} />}
      <StackLight status={status} x={type === 'xray' ? 214 : 206} />
    </svg>
  )
}

/** The three-lamp tower: red, amber, green. Only the lamp for the status is lit. */
function StackLight({ status, x }: { status: MachineStatus; x: number }) {
  const lit = (lamp: 'red' | 'amber' | 'green') =>
    (lamp === 'green' && status === 'running') || (lamp === 'amber' && status === 'changing')
  return (
    <g>
      <rect x={x + 3} y="30" width="2" height="12" className="fill-press-2" />
      <rect x={x} y="6" width="8" height="8" rx="1.5" className={status === 'offline' || status === 'stopped' ? 'fill-press-2' : 'fill-mist stroke-rule'} />
      <rect x={x} y="14" width="8" height="8" rx="1.5" className={lit('amber') ? 'fill-marking' : 'fill-mist stroke-rule'} />
      <rect x={x} y="22" width="8" height="8" rx="1.5" className={lit('green') ? 'fill-cat-compliance' : 'fill-mist stroke-rule'} />
    </g>
  )
}

function Cabinet({ x = 186 }: { x?: number }) {
  return (
    <g>
      <rect x={x} y="44" width="42" height="74" rx="3" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <rect x={x + 6} y="52" width="30" height="18" rx="2" className="fill-info-wash stroke-press-2" />
      <circle cx={x + 12} cy="82" r="3.5" className="fill-cat-compliance" />
      <circle cx={x + 22} cy="82" r="3.5" className="fill-press-2" />
      <circle cx={x + 32} cy="82" r="3.5" className="fill-caution" />
      <line x1={x + 8} x2={x + 34} y1="96" y2="96" className="stroke-rule" strokeWidth="2" />
      <line x1={x + 8} x2={x + 34} y1="104" y2="104" className="stroke-rule" strokeWidth="2" />
      <rect x={x + 4} y="118" width="6" height="18" className="fill-press-2" />
      <rect x={x + 32} y="118" width="6" height="18" className="fill-press-2" />
    </g>
  )
}

function Thermoformer({ product, on }: { product: string; on: boolean }) {
  return (
    <g>
      {/* Film roll unwinding into the machine */}
      <circle cx="26" cy="98" r="17" className={`${product} stroke-press`} strokeWidth="1.5" />
      <circle cx="26" cy="98" r="5" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <path d="M26 81 L58 78" className="stroke-press-2" strokeWidth="1.5" fill="none" />
      <rect x="20" y="114" width="12" height="22" className="fill-press-2" />
      {/* Frame and guide pillars */}
      <rect x="54" y="92" width="126" height="26" rx="2" className="fill-mist stroke-press" strokeWidth="1.5" />
      <rect x="60" y="118" width="8" height="18" className="fill-press-2" />
      <rect x="166" y="118" width="8" height="18" className="fill-press-2" />
      <rect x="66" y="22" width="5" height="70" className="fill-press-2" />
      <rect x="163" y="22" width="5" height="70" className="fill-press-2" />
      {/* Heater oven with its elements */}
      <rect x="62" y="18" width="110" height="24" rx="2" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <path
        d="M72 34 l6 -8 l6 8 l6 -8 l6 8 l6 -8 l6 8 l6 -8 l6 8 l6 -8 l6 8 l6 -8 l6 8 l6 -8 l6 8 l6 -8"
        className={on ? 'stroke-cat-logistics' : 'stroke-rule'}
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />
      {/* Upper platen, clamp frame and the film being formed */}
      <rect x="72" y="50" width="90" height="8" rx="1" className="fill-press-2" />
      <line x1="58" x2="176" y1="66" y2="66" className="stroke-press" strokeWidth="1.5" />
      {/* Mould with formed trays in the product colour */}
      <rect x="74" y="68" width="86" height="20" rx="2" className="fill-sheet stroke-press" strokeWidth="1.5" />
      {[78, 99, 120, 141].map((x) => (
        <rect key={x} x={x} y="71" width="16" height="12" rx="3" className={product} />
      ))}
      {/* Output conveyor */}
      <line x1="176" x2="186" y1="88" y2="88" className="stroke-press-2" strokeWidth="2" />
      <Cabinet />
    </g>
  )
}

function Laminator({ product, on }: { product: string; on: boolean }) {
  return (
    <g>
      {/* Film reel feeding down */}
      <circle cx="46" cy="34" r="16" className={`${product} stroke-press`} strokeWidth="1.5" />
      <circle cx="46" cy="34" r="5" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <path d="M58 44 Q 90 60 100 66" className="stroke-press-2" strokeWidth="1.5" fill="none" />
      {/* Frame */}
      <rect x="40" y="96" width="140" height="22" rx="2" className="fill-mist stroke-press" strokeWidth="1.5" />
      <rect x="46" y="118" width="8" height="18" className="fill-press-2" />
      <rect x="166" y="118" width="8" height="18" className="fill-press-2" />
      <rect x="84" y="40" width="6" height="56" className="fill-press-2" />
      <rect x="146" y="40" width="6" height="56" className="fill-press-2" />
      {/* Heated nip rollers */}
      <circle cx="118" cy="56" r="18" className={on ? 'fill-caution-wash stroke-press' : 'fill-sheet stroke-press'} strokeWidth="1.5" />
      <circle cx="118" cy="56" r="4" className="fill-press-2" />
      <circle cx="118" cy="82" r="10" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <circle cx="118" cy="82" r="3" className="fill-press-2" />
      {/* Trays passing through, laminated */}
      <line x1="24" x2="186" y1="92" y2="92" className="stroke-press" strokeWidth="1.5" />
      {[40, 62, 140, 162].map((x) => (
        <rect key={x} x={x} y="84" width="16" height="8" rx="2" className={product} />
      ))}
      <Cabinet />
    </g>
  )
}

function Trimmer({ product, on }: { product: string; on: boolean }) {
  return (
    <g>
      {/* Four-post press: crown, cylinder, ram and die */}
      <rect x="70" y="16" width="96" height="16" rx="2" className="fill-press-2" />
      <rect x="108" y="32" width="20" height="16" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <rect x="76" y="32" width="6" height="64" className="fill-press-2" />
      <rect x="154" y="32" width="6" height="64" className="fill-press-2" />
      <rect x="84" y="48" width="68" height="12" rx="1" className={on ? 'fill-press' : 'fill-press-2'} />
      {/* Cutting die with the blade line */}
      <rect x="90" y="60" width="56" height="8" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <path d="M92 68 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4" className="stroke-press" strokeWidth="1.2" fill="none" />
      {/* Bed and conveyor with formed sheet in, trimmed trays out */}
      <rect x="40" y="88" width="140" height="10" className="fill-mist stroke-press" strokeWidth="1.5" />
      <rect x="40" y="98" width="140" height="20" rx="2" className="fill-mist stroke-press" strokeWidth="1.5" />
      <rect x="46" y="118" width="8" height="18" className="fill-press-2" />
      <rect x="166" y="118" width="8" height="18" className="fill-press-2" />
      <rect x="20" y="78" width="54" height="10" rx="2" className={product} opacity="0.6" />
      {[150, 168].map((x) => (
        <rect key={x} x={x} y="78" width="14" height="10" rx="3" className={product} />
      ))}
      <Cabinet x={190} />
    </g>
  )
}

function Xray({ product, on }: { product: string; on: boolean }) {
  return (
    <g>
      {/* Inspection tunnel over a conveyor */}
      <rect x="66" y="30" width="110" height="66" rx="6" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <rect x="80" y="70" width="82" height="26" className="fill-mist stroke-press-2" />
      {/* Radiation mark */}
      <circle cx="121" cy="50" r="10" className={on ? 'fill-marking stroke-press' : 'fill-mist stroke-press'} strokeWidth="1.2" />
      <circle cx="121" cy="50" r="2.5" className="fill-press" />
      {[0, 120, 240].map((a) => (
        <path key={a} d="M121 50 L121 42 A8 8 0 0 1 127.9 46 Z" className="fill-press" transform={`rotate(${a} 121 50)`} />
      ))}
      <rect x="20" y="96" width="196" height="8" rx="2" className="fill-press-2" />
      {[30, 52, 186].map((x) => (
        <rect key={x} x={x} y="86" width="16" height="10" rx="3" className={product} />
      ))}
      <rect x="40" y="104" width="8" height="32" className="fill-press-2" />
      <rect x="190" y="104" width="8" height="32" className="fill-press-2" />
      <rect x="196" y="40" width="34" height="40" rx="3" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <rect x="201" y="46" width="24" height="14" rx="2" className="fill-info-wash stroke-press-2" />
    </g>
  )
}
