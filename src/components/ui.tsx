import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { money } from '../lib/format'

/**
 * The four parts every tab is built from. DESIGN-SYSTEM-V2-SPEC section 3.
 *
 * The card, the tinted header block inside it, the filter pills, and the table.
 * Nothing sits loose on the page: if it is on a screen, it is inside a card.
 */

/**
 * One card per section. White, 14px radius, a soft green shadow, and a 5px leaf
 * bar across the top.
 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

/**
 * The tinted header block, inside the top of the card.
 *
 * The as-at line sits beneath the lede in leaf-deep bold rather than beside the
 * title, which is where efdashboard puts it. Search, where a tab has it, is
 * right-aligned on the title line.
 */
export function CardHead({
  kicker,
  title,
  lede,
  asAt,
  icon,
  search,
  actions,
}: {
  kicker: string
  title: string
  lede?: string
  asAt?: string
  icon?: ReactNode
  search?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="card-head">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker">{kicker}</p>
          <h2 className="title mt-1.5 flex items-center gap-2">
            {icon}
            {title}
          </h2>
          {lede && <p className="lede mt-1 max-w-prose">{lede}</p>}
          {asAt && <p className="as-at mt-2">{asAt}</p>}
        </div>

        {(search || actions) && (
          <div className="flex shrink-0 items-center gap-2 no-print">
            {search}
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}

export function CardBody({
  children,
  flush = false,
  className = '',
}: {
  children: ReactNode
  /** A full-bleed ledger runs to the card's own edges. */
  flush?: boolean
  className?: string
}) {
  return <div className={`${flush ? 'card-body-flush' : 'card-body'} ${className}`}>{children}</div>
}

/** The rounded search field the header block carries, with its magnifier. */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  label,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  label: string
}) {
  return (
    <div className="relative">
      <Search
        size={14}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="field field-search w-full sm:w-64"
      />
    </div>
  )
}

/**
 * Headline figures, in a row inside a card, divided by rule hairlines rather
 * than by separate cards. Section 4.
 */
export function Figures({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 sm:auto-cols-fr sm:grid-flow-col sm:gap-0">{children}</div>
  )
}

/**
 * One headline figure: the label above in kicker, the figure, the descriptor
 * beneath in sub.
 *
 * `critical` is the only tone, and it is for a figure that is a shortfall. There
 * is no coloured ground behind a figure.
 */
export function Tile({
  label,
  value,
  sub,
  tone = 'plain',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'plain' | 'critical'
}) {
  return (
    <div className="border-rule sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-0">
      <p className="kicker">{label}</p>
      <p className={`figure-xl mt-2 ${tone === 'critical' ? '!text-critical' : ''}`}>{value}</p>
      {sub && <p className="sub mt-1.5">{sub}</p>}
    </div>
  )
}

/**
 * A table cell carrying a value and its qualifier: the value in figure weight,
 * the qualifier beneath in sub. Section 3, "38 Tons over Min. 50 Tons".
 */
export function TwoLine({
  value,
  note,
  tone = 'plain',
}: {
  value: ReactNode
  note?: ReactNode
  tone?: 'plain' | 'critical'
}) {
  return (
    <>
      <span className={`figure block ${tone === 'critical' ? '!text-critical' : ''}`}>{value}</span>
      {note && <span className="sub block">{note}</span>}
    </>
  )
}

export function Money({ n, dp = 2 }: { n: number; dp?: 0 | 2 }) {
  return <span className="num">{money(n, dp)}</span>
}

/** A placeholder or a shortfall. The only red in the system. */
export function Flag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-critical-wash px-2.5 py-1 text-sub font-semibold uppercase text-critical">
      {children}
    </span>
  )
}

/**
 * The one sentence stating what the numbers mean, set above the figures.
 * Always generated from the engine, never written here.
 */
export function Finding({ children }: { children: ReactNode }) {
  return <p className="mb-5 max-w-prose text-figure leading-relaxed text-ink-strong">{children}</p>
}

/**
 * The working, kept present but not competing with the answer. Open by default
 * on a wide screen where there is room, closed on a phone.
 */
export function Working({
  title,
  lede,
  children,
  defaultOpen = false,
}: {
  title: string
  lede?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen} className="mt-6 border-t border-rule pt-3 group print:!block">
      <summary className="cursor-pointer list-none no-print">
        <span className="text-sub font-semibold text-leaf">{title}</span>
        <span className="ml-1.5 text-sub text-ink-muted group-open:hidden">Show</span>
        <span className="ml-1.5 hidden text-sub text-ink-muted group-open:inline">Hide</span>
        {lede && <span className="lede mt-1 block">{lede}</span>}
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  )
}

export function Note({
  tone = 'plain',
  children,
}: {
  tone?: 'plain' | 'alert'
  children: ReactNode
}) {
  return (
    <div
      className={`rounded border-l-2 py-2 pl-3 pr-3 text-table leading-relaxed ${
        tone === 'alert' ? 'border-critical bg-critical-wash text-ink' : 'border-rule bg-page text-ink-muted'
      }`}
    >
      {children}
    </div>
  )
}

/**
 * A block heading inside a card body. Section 3 gives the card one heading, so
 * anything below it is a smaller step down rather than a second title.
 */
export function BlockHead({
  title,
  lede,
  actions,
}: {
  title: string
  lede?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-figure font-bold text-leaf-deep">{title}</h3>
        {lede && <p className="lede mt-1 max-w-prose">{lede}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 no-print">{actions}</div>}
    </div>
  )
}
