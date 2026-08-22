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
    plain: 'border-solid border-rule-strong',
    leaf: 'border-solid border-leaf',
    ember: 'border-dashed border-ember',
    alert: 'border-dotted border-alert',
  }[tone]

  return (
    <div className={`card border-t-accent ${accent} flex flex-col`}>
      <div className="px-card pt-5 pb-card flex flex-col gap-1.5">
        <div className="eyebrow">{label}</div>

        <div className="num text-[30px] leading-none font-bold text-ink-strong">{value}</div>

        {sub && <div className="text-lede text-ink-muted mt-0.5">{sub}</div>}

        {asAt && (
          <div className="mt-3 self-start rounded-field border border-rule-field px-2.5 py-1 text-[13px] font-extrabold text-leaf-deep">
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
    <span className="inline-block bg-alert-wash text-alert text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5">
      {children}
    </span>
  )
}

/**
 * efdashboard opens every section with three things: a category label, a heading,
 * and one plain line saying what the section shows. It orients a reader in about
 * a second and costs a line of text. REDESIGN-SPEC section 3.
 */
export function SectionHead({
  kicker,
  title,
  lede,
  asAt,
}: {
  kicker: string
  title: string
  lede?: string
  asAt?: string
}) {
  return (
    <header className="mb-7">
      <p className="eyebrow">{kicker}</p>
      <h2 className="mt-1 text-section font-bold text-leaf-deep">{title}</h2>
      {lede && <p className="lede mt-1.5 max-w-3xl">{lede}</p>}
      {asAt && (
        <p className="mt-3 inline-block rounded-field border border-rule-field bg-paper-surface px-2.5 py-1 text-[13px] font-extrabold text-leaf-deep">
          {asAt}
        </p>
      )}
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
    <p className="mb-7 max-w-3xl text-[17px] leading-relaxed text-ink-strong sm:text-[19px]">
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
    <details open={defaultOpen} className="card mt-card-gap group print:!block">
      <summary className="cursor-pointer list-none px-card py-4 no-print">
        <span className="text-[15px] font-bold text-leaf-deep">{title}</span>
        <span className="ml-2 text-lede text-ink-muted group-open:hidden">Show</span>
        <span className="ml-2 text-lede text-ink-muted hidden group-open:inline">Hide</span>
        {lede && <span className="lede mt-1 block">{lede}</span>}
      </summary>
      <div className="px-card pb-card pt-1">{children}</div>
    </details>
  )
}

export function Note({ tone = 'plain', children }: { tone?: 'plain' | 'alert'; children: ReactNode }) {
  return (
    <div
      className={`border-l-2 pl-3 py-1 text-sm leading-relaxed ${
        tone === 'alert' ? 'border-alert text-ink' : 'border-rule-strong text-ink-muted'
      }`}
    >
      {children}
    </div>
  )
}
