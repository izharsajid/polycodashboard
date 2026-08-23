import type { ReactNode } from 'react'
import { fmt } from '../lib/engine'

/**
 * A headline figure. No box.
 *
 * The eyebrow above, the figure, the descriptor beneath, separated from its
 * neighbours by space and a vertical hairline. DESIGN-SYSTEM-SPEC section 5.
 *
 * `tone` no longer draws a coloured bar. Section 3 forbids a coloured ground
 * behind a figure, and four tones on three tiles was a fourth colour system.
 * A figure that needs marking gets its mark in the descriptor, where it can say
 * why.
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
    <div className="flex flex-col gap-1 border-rule sm:border-l sm:pl-3 sm:first:border-l-0 sm:first:pl-0">
      <p className="eyebrow">{label}</p>
      <p className={`figure-xl ${tone === 'critical' ? 'text-critical' : ''}`}>{value}</p>
      {sub && <p className="text-label text-ink-50">{sub}</p>}
    </div>
  )
}

export function Money({ n, dp = 0 }: { n: number; dp?: number }) {
  return <span className="num">{n < 0 ? `(${fmt(Math.abs(n), dp)})` : fmt(n, dp)}</span>
}

export function Flag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block bg-critical-soft text-critical text-eyebrow font-semibold uppercase tracking-wider px-1 py-1">
      {children}
    </span>
  )
}

/**
 * Eyebrow, serif title, one line of description, and the as-at date
 * right-aligned on the title line. Then 24px of space.
 * DESIGN-SYSTEM-SPEC section 5.
 *
 * The as-at date sits on the title line rather than in a pill beneath it. It is
 * apparatus, not a figure, and boxing it gave it the weight of one.
 */
export function SectionHead({
  kicker,
  title,
  lede,
  asAt,
  icon,
}: {
  kicker: string
  title: string
  lede?: string
  asAt?: string
  icon?: ReactNode
}) {
  return (
    <header className="mb-3">
      <p className="eyebrow">{kicker}</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="title flex items-center gap-1">
          {icon}
          {title}
        </h2>
        {asAt && <p className="text-label text-ink-50">{asAt}</p>}
      </div>
      {lede && <p className="lede mt-1 max-w-prose">{lede}</p>}
    </header>
  )
}

/**
 * The one sentence stating what the numbers mean, set above the figures.
 * REDESIGN-SPEC section 4: a statement, not a chart title and not a caption.
 * Always generated from the engine, never written here.
 */
export function Finding({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 max-w-3xl text-subtitle leading-relaxed text-ink sm:text-figure">
      {children}
    </p>
  )
}

/**
 * The working, kept present but not competing with the answer. Open by default on
 * a wide screen where there is room, closed on a phone.
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
    <details open={defaultOpen} className="mt-6 border-t border-rule pt-2 group print:!block">
      <summary className="cursor-pointer list-none px-2 py-2 no-print">
        <span className="text-body font-semibold text-accent">{title}</span>
        <span className="ml-1 text-label text-ink-70 group-open:hidden">Show</span>
        <span className="ml-1 text-label text-ink-70 hidden group-open:inline">Hide</span>
        {lede && <span className="lede mt-1 block">{lede}</span>}
      </summary>
      <div className="px-2 pb-2 pt-1">{children}</div>
    </details>
  )
}

export function Note({ tone = 'plain', children }: { tone?: 'plain' | 'alert'; children: ReactNode }) {
  return (
    <div
      className={`border-l-2 pl-2 py-1 text-body leading-relaxed ${
        tone === 'alert' ? 'border-critical text-ink' : 'border-rule text-ink-70'
      }`}
    >
      {children}
    </div>
  )
}
