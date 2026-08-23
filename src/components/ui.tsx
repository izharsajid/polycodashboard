import type { ReactNode } from 'react'
import { fmt } from '../lib/engine'

/**
 * A headline figure, in efdashboard's card: white surface, 14px corner, the soft
 * green shadow, and the 5px accent along the top that its section cards carry.
 *
 * The accent is the tone. efdashboard marks state with colour on a rounded wash,
 * so the tones here are its status palette rather than a set of our own, and
 * `alert` is the only red, kept for shortfalls and exceptions.
 *
 * The figure keeps this project's tabular numerals against efdashboard's
 * proportional ones, because these line up in a column and have to agree on the
 * decimal. It is set larger than efdashboard's inline stock number because
 * REDESIGN-SPEC section 4 asks for at most three figures a reader can remember,
 * which is a different job from a number inside a table.
 *
 * `asAt` is here because section 6 asks every screen to state its date, and a
 * figure carrying its own date cannot drift from the one in the heading.
 */
export function Tile({
  label,
  value,
  sub,
  asAt,
  tone = 'plain',
}: {
  label: string
  value: string
  sub?: string
  asAt?: string
  tone?: 'plain' | 'leaf' | 'ember' | 'alert'
}) {
  /**
   * Tone is carried by the accent's pattern as well as its colour, because these
   * are printed for board packs and four mid-toned colours are one grey in
   * greyscale. Solid pale, solid dark, dashed, dotted survive a monochrome
   * printer; four hues do not.
   */
  const accent = {
    plain: 'border-solid border-rule',
    leaf: 'border-solid border-accent',
    ember: 'border-dashed border-watch',
    alert: 'border-dotted border-critical',
  }[tone]

  return (
    <div className={`card border-t-2 ${accent} flex flex-col`}>
      <div className="px-2 pt-3 pb-2 flex flex-col gap-1">
        <div className="eyebrow">{label}</div>

        <div className="num text-figure-xl leading-none font-semibold text-ink">{value}</div>

        {sub && <div className="text-label text-ink-70 mt-1">{sub}</div>}

        {asAt && (
          <div className="mt-2 self-start rounded border border-rule px-2 py-1 text-label font-semibold text-accent">
            {asAt}
          </div>
        )}
      </div>
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
    <details open={defaultOpen} className="card mt-2 group print:!block">
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
