import type { Family, MachineStatus, MachineType } from '../../engine/machines'

/**
 * Line drawings of the plant's machines, front on: the twin-station fibre
 * forming press, the laminating press, the manual hydraulic trimming press, the automatic
 * travelling-head trimmer and an X-ray tunnel. Each carries a stack light
 * showing its status, and the product it is running in that product's colour.
 * Decorative: the card beside each says everything in words.
 */
export const FAMILY_FILL: Record<Family, string> = {
  medical: 'fill-cat-payroll',
  platinum: 'fill-cat-supplier',
  oasis: 'fill-cat-facility',
  pointfive: 'fill-cat-raw',
  destiny: 'fill-cat-logistics',
  halfm: 'fill-cat-working',
  other: 'fill-press-2',
}
export const FAMILY_BG: Record<Family, string> = {
  medical: 'bg-cat-payroll',
  platinum: 'bg-cat-supplier',
  oasis: 'bg-cat-facility',
  pointfive: 'bg-cat-raw',
  destiny: 'bg-cat-logistics',
  halfm: 'bg-cat-working',
  other: 'bg-press-2',
}
export const FAMILY_LABEL: Record<Family, string> = {
  medical: 'Medical trays',
  platinum: 'Platinum trays',
  oasis: 'Oasis trays',
  pointfive: 'Point Five',
  destiny: 'Destiny 7x7 (Potato)',
  halfm: '1/2M lids and bowls',
  other: 'Other work',
}

type Props = {
  type: MachineType
  status: MachineStatus
  family: Family | null
  /** An automatic trimmer, drawn as the travelling-head press rather than the manual one. */
  auto?: boolean
  className?: string
}

export default function MachineArt({ type, status, family, auto = false, className }: Props) {
  const product = family ? FAMILY_FILL[family] : 'fill-rule'
  const on = status === 'running' || status === 'changing'
  return (
    <svg viewBox="0 0 260 150" className={className} aria-hidden>
      <line x1="4" x2="256" y1="136" y2="136" className="stroke-rule" strokeWidth="2" />
      {type === 'forming' && <Thermoformer product={product} on={on} />}
      {type === 'lamination' && <Laminator product={product} on={on} />}
      {type === 'trimming' && (auto ? <AutoTrimmer product={product} on={on} /> : <Trimmer product={product} on={on} />)}
      {type === 'xray' && <Xray product={product} on={on} />}
      <StackLight status={status} x={type === 'xray' ? 214 : type === 'forming' ? 126 : type === 'trimming' && auto ? 225 : type === 'lamination' ? 156 : 205} />
    </svg>
  )
}

/** The three-lamp tower: red, amber, green. Only the lamp for the status is lit. */
function StackLight({ status, x }: { status: MachineStatus; x: number }) {
  const lit = (lamp: 'red' | 'amber' | 'green') =>
    (lamp === 'green' && status === 'running') || (lamp === 'amber' && (status === 'changing' || status === 'maintenance'))
  return (
    <g>
      <rect x={x + 3} y="30" width="2" height="12" className="fill-press-2" />
      <rect x={x} y="6" width="8" height="8" rx="1.5" className={status === 'offline' || status === 'stopped' ? 'fill-press-2' : 'fill-mist stroke-rule'} />
      <rect x={x} y="14" width="8" height="8" rx="1.5" className={lit('amber') ? 'fill-marking' : 'fill-mist stroke-rule'} />
      <rect x={x} y="22" width="8" height="8" rx="1.5" className={lit('green') ? 'fill-cat-compliance' : 'fill-mist stroke-rule'} />
    </g>
  )
}

/** Twin-station forming press: a cylinder, platen and mould set either side of the control column. */
function Thermoformer({ product, on }: { product: string; on: boolean }) {
  return (
    <g>
      {/* Cabinet base with its doors */}
      <rect x="12" y="96" width="236" height="34" rx="2" className="fill-cat-facility stroke-press" strokeWidth="1.5" />
      {[18, 56, 94, 132, 170, 208].map((x) => (
        <rect key={x} x={x} y="100" width="34" height="26" rx="1.5" className="fill-sheet stroke-press-2" />
      ))}
      {[16, 236].map((x) => (
        <rect key={x} x={x} y="130" width="8" height="6" className="fill-press-2" />
      ))}
      <rect x="8" y="90" width="244" height="6" rx="1" className="fill-mist stroke-press" strokeWidth="1.5" />
      {[18, 162].map((x) => (
        <Station key={x} x={x} product={product} on={on} />
      ))}
      {/* Control column: heater boxes, screen and buttons */}
      <rect x="100" y="14" width="24" height="18" rx="1.5" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <rect x="136" y="14" width="24" height="18" rx="1.5" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <rect x="102" y="32" width="56" height="58" rx="2" className="fill-mist stroke-press" strokeWidth="1.5" />
      <rect x="116" y="38" width="28" height="14" rx="1.5" className="fill-info-wash stroke-press-2" />
      <circle cx="109" cy="45" r="3" className="fill-sheet stroke-press-2" />
      <circle cx="151" cy="45" r="3" className="fill-sheet stroke-press-2" />
      {[116, 124, 132, 140].map((x, i) => (
        <circle key={x} cx={x + 2} cy="58" r="2.2" className={i % 2 ? 'fill-alert' : 'fill-cat-compliance'} />
      ))}
      {/* Centre transfer tray of formed product */}
      <rect x="108" y="70" width="44" height="18" rx="1.5" className="fill-press-2" />
      {[112, 122, 132, 142].map((x) => (
        <rect key={x} x={x} y="74" width="7" height="10" rx="2" className={product} />
      ))}
    </g>
  )
}

function Station({ x, product, on }: { x: number; product: string; on: boolean }) {
  return (
    <g>
      {/* Hood, pneumatic cylinder and its air line */}
      <path d={`M${x - 4} 50 L${x - 4} 30 L${x + 70} 26 L${x + 84} 30 L${x + 84} 50 Z`} className="fill-mist stroke-press" strokeWidth="1.5" />
      <rect x={x + 32} y="6" width="16" height="22" rx="2" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <path d={`M${x + 34} 10 C ${x + 24} 10, ${x + 24} 22, ${x + 30} 26`} className="stroke-cat-facility" strokeWidth="1.5" fill="none" />
      <circle cx={x + 16} cy="40" r="4" className="fill-sheet stroke-press-2" />
      <line x1={x + 40} x2={x + 40} y1="50" y2="56" className="stroke-press" strokeWidth="3" />
      {/* Guide posts */}
      <rect x={x} y="50" width="4" height="40" className="fill-marking" />
      <rect x={x + 76} y="50" width="4" height="40" className="fill-marking" />
      {/* Heated upper platen and mould */}
      <rect x={x - 2} y="56" width="84" height="5" rx="1" className="fill-press-2" />
      <rect x={x + 4} y="61" width="72" height="5" className={on ? 'fill-cat-logistics' : 'fill-rule'} />
      {/* Lower mould with the formed product in its cavities */}
      <rect x={x + 4} y="74" width="72" height="12" rx="1" className="fill-marking stroke-press" strokeWidth="1" />
      {[8, 24, 40, 56].map((dx) => (
        <rect key={dx} x={x + dx} y="77" width="12" height="7" rx="2" className={product} />
      ))}
    </g>
  )
}

/** Laminating press: film tray sliding in from the side, press housing on a cylinder, roller conveyors out. */
function Laminator({ product, on }: { product: string; on: boolean }) {
  return (
    <g>
      {/* Base platform */}
      <rect x="14" y="92" width="222" height="40" rx="2" className="fill-rule stroke-press" strokeWidth="1.5" />
      <line x1="14" x2="236" y1="100" y2="100" className="stroke-press-2" strokeWidth="1" opacity="0.5" />
      {/* Film tray on its rails, sliding in from the left */}
      <path d="M8 56 L84 56 L84 66 L16 66 Z" className="fill-info-wash stroke-press-2" strokeWidth="1.2" />
      {[24, 40, 56, 72].map((x) => (
        <line key={x} x1={x} x2={x - 3} y1="57" y2="65" className="stroke-press-2" strokeWidth="0.8" opacity="0.6" />
      ))}
      <rect x="18" y="66" width="66" height="4" className="fill-mist stroke-press-2" />
      {[22, 76].map((x) => (
        <rect key={x} x={x} y="70" width="4" height="22" className="fill-press-2" />
      ))}
      {/* Press housing with its grid top, cylinder and rod */}
      <rect x="84" y="40" width="84" height="52" rx="1.5" className="fill-mist stroke-press" strokeWidth="1.5" />
      <rect x="80" y="34" width="92" height="8" rx="1" className="fill-sheet stroke-press" strokeWidth="1.2" />
      {[103, 126, 149].map((x) => (
        <line key={x} x1={x} x2={x} y1="34" y2="42" className="stroke-press-2" strokeWidth="1" />
      ))}
      <rect x="112" y="16" width="3" height="18" className="fill-press-2" />
      <rect x="137" y="16" width="3" height="18" className="fill-press-2" />
      <rect x="110" y="14" width="32" height="4" className="fill-press-2" />
      <rect x="120" y="18" width="12" height="16" rx="1.5" className="fill-sheet stroke-press" strokeWidth="1.2" />
      <line x1="126" x2="126" y1="2" y2="14" className="stroke-press-2" strokeWidth="2" />
      {/* The opening: heated platen over trays being sealed */}
      <rect x="92" y="58" width="68" height="34" className="fill-press-2" />
      <rect x="96" y="62" width="60" height="6" rx="1" className={on ? 'fill-cat-logistics' : 'fill-rule'} />
      {[100, 116, 132].map((x) => (
        <rect key={x} x={x} y="82" width="12" height="8" rx="2" className={product} />
      ))}
      {/* Roller conveyors carrying sealed trays out */}
      <rect x="168" y="84" width="64" height="8" className="fill-mist stroke-press-2" />
      {[174, 184, 194, 204, 214, 224].map((x) => (
        <circle key={x} cx={x} cy="88" r="2.5" className="fill-sheet stroke-press-2" />
      ))}
      {[176, 196, 216].map((x) => (
        <rect key={x} x={x} y="76" width="12" height="8" rx="2" className={product} />
      ))}
    </g>
  )
}

function Trimmer({ product, on }: { product: string; on: boolean }) {
  return (
    <g>
      {/* Base cabinet, feet and two-hand start buttons */}
      <rect x="66" y="84" width="128" height="44" rx="2" className="fill-info stroke-press" strokeWidth="1.5" />
      <rect x="66" y="82" width="128" height="3" className="fill-marking" />
      <rect x="100" y="98" width="60" height="6" rx="1" className="fill-press" opacity="0.35" />
      {[96, 156].map((x) => (
        <g key={x}>
          <rect x={x} y="88" width="9" height="7" rx="1" className="fill-sheet stroke-press-2" />
          <circle cx={x + 4.5} cy="88" r="2.2" className="fill-alert" />
        </g>
      ))}
      {[62, 182].map((x) => (
        <rect key={x} x={x} y="128" width="16" height="8" className="fill-info" />
      ))}
      {/* Bed, posts, crown, cylinder and pressure gauge */}
      <rect x="84" y="76" width="92" height="6" className="fill-mist stroke-press-2" />
      {[96, 160].map((x) => (
        <rect key={x} x={x} y="26" width="4" height="50" className="fill-mist stroke-press-2" />
      ))}
      <rect x="88" y="22" width="84" height="8" rx="1" className="fill-info stroke-press" strokeWidth="1" />
      <rect x="122" y="6" width="16" height="17" className="fill-info stroke-press" strokeWidth="1" />
      <rect x="118" y="3" width="24" height="5" rx="1" className="fill-info stroke-press" strokeWidth="1" />
      <circle cx="150" cy="15" r="6" className="fill-sheet stroke-press" strokeWidth="1.2" />
      <line x1="150" y1="15" x2="153" y2="11" className="stroke-alert" strokeWidth="1.2" />
      {/* Moving platen with the cutting die; lowered onto the work while running */}
      <rect x="90" y={on ? 52 : 42} width="80" height="7" rx="1" className="fill-marking stroke-press" strokeWidth="1" />
      <rect x="112" y={on ? 59 : 49} width="36" height="6" className="fill-rule stroke-press-2" />
      {[104, 124, 144].map((x) => (
        <rect key={x} x={x} y="68" width="13" height="8" rx="2" className={product} />
      ))}
      {/* Red mesh guards either side */}
      {[70, 174].map((x) => (
        <g key={x}>
          <rect x={x} y="20" width="16" height="62" className="fill-alert stroke-alert" fillOpacity="0.12" strokeWidth="2.5" />
          {[4, 8, 12].map((dx) => (
            <line key={dx} x1={x + dx} x2={x + dx} y1="24" y2="78" className="stroke-alert" strokeWidth="0.6" opacity="0.6" />
          ))}
        </g>
      ))}
      {/* Control box */}
      <rect x="198" y="30" width="22" height="44" rx="1.5" className="fill-sheet stroke-press" strokeWidth="1.5" />
      <rect x="202" y="34" width="14" height="5" className="fill-press" />
      <circle cx="205" cy="47" r="2.2" className="fill-alert" />
      <circle cx="213" cy="47" r="2.2" className="fill-cat-compliance" />
      <circle cx="205" cy="56" r="2.2" className="fill-marking" />
      <circle cx="213" cy="56" r="2.2" className="fill-alert" />
      <rect x="203" y="63" width="12" height="6" rx="1" className="fill-marking stroke-press-2" />
      <line x1="194" x2="198" y1="52" y2="52" className="stroke-press-2" strokeWidth="2" />
    </g>
  )
}

/** Automatic travelling-head cutting press: feed table through the press, hydraulic pack below, control cabinet beside. */
function AutoTrimmer({ product, on }: { product: string; on: boolean }) {
  return (
    <g>
      {/* Hydraulic pack: tank and motor */}
      <rect x="16" y="112" width="40" height="18" rx="1.5" className="fill-info stroke-press" strokeWidth="1.2" />
      <rect x="22" y="98" width="24" height="14" rx="3" className="fill-marking stroke-press" strokeWidth="1.2" />
      <path d="M46 104 C 54 104, 56 96, 62 96" className="stroke-press-2" strokeWidth="1.5" fill="none" />
      {/* Press body: base, side columns and top beam */}
      <rect x="60" y="78" width="120" height="50" rx="2" className="fill-info stroke-press" strokeWidth="1.5" />
      <rect x="72" y="88" width="96" height="30" rx="1.5" className="fill-info-wash" opacity="0.35" />
      {[62, 170].map((x) => (
        <rect key={x} x={x} y="128" width="8" height="8" className="fill-press-2" />
      ))}
      <rect x="60" y="30" width="14" height="48" className="fill-info stroke-press" strokeWidth="1.2" />
      <rect x="166" y="30" width="14" height="48" className="fill-info stroke-press" strokeWidth="1.2" />
      <rect x="56" y="20" width="128" height="16" rx="2" className="fill-info stroke-press" strokeWidth="1.5" />
      <rect x="112" y="24" width="16" height="8" rx="1" className="fill-sheet" />
      {/* Travelling cutting head, lowered while it runs */}
      <rect x="78" y={on ? 50 : 38} width="84" height="10" rx="1" className="fill-press-2 stroke-press" strokeWidth="1" />
      {/* Feed table running through the press, with white side guards */}
      <rect x="10" y="70" width="196" height="6" className="fill-sheet stroke-press" strokeWidth="1.2" />
      <rect x="12" y="58" width="30" height="12" rx="1.5" className="fill-sheet stroke-press-2" />
      <rect x="182" y="58" width="22" height="12" rx="1.5" className="fill-sheet stroke-press-2" />
      <rect x="46" y="62" width="30" height="8" rx="1" className={product} opacity="0.55" />
      {[86, 104, 122, 140].map((x) => (
        <rect key={x} x={x} y="62" width="14" height="8" rx="2" className={product} />
      ))}
      {/* Free-standing control cabinet with its screen */}
      <path d="M180 120 C 196 120, 200 126, 212 126" className="stroke-press-2" strokeWidth="1.5" fill="none" />
      <rect x="212" y="42" width="34" height="90" rx="2" className="fill-mist stroke-press" strokeWidth="1.5" />
      <rect x="217" y="48" width="24" height="16" rx="1.5" className="fill-info-wash stroke-press-2" />
      <circle cx="222" cy="72" r="2.4" className="fill-cat-compliance" />
      <circle cx="229" cy="72" r="2.4" className="fill-alert" />
      <circle cx="236" cy="72" r="2.4" className="fill-marking" />
      <line x1="218" x2="240" y1="84" y2="84" className="stroke-rule" strokeWidth="2" />
      <line x1="218" x2="240" y1="92" y2="92" className="stroke-rule" strokeWidth="2" />
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
