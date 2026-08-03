import type { ReactNode } from 'react'
import { fmt } from '../lib/engine'

export function Tile({
  label, value, sub, tone = 'plain',
}: { label: string; value: string; sub?: string; tone?: 'plain' | 'leaf' | 'ember' | 'alert' }) {
  const bar = {
    plain: 'bg-rule-strong', leaf: 'bg-leaf', ember: 'bg-ember', alert: 'bg-alert',
  }[tone]
  return (
    <div className="rulebox p-4 flex flex-col gap-2">
      <div className={`h-[3px] w-8 ${bar}`} />
      <div className="eyebrow">{label}</div>
      <div className="num text-[26px] leading-none font-semibold">{value}</div>
      {sub && <div className="text-xs text-ink-muted leading-snug">{sub}</div>}
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

export function SectionHead({ n, title, lede }: { n: string; title: string; lede?: string }) {
  return (
    <header className="mb-6 border-b border-rule pb-4">
      <div className="flex items-baseline gap-3">
        <span className="num text-ember text-sm font-semibold">{n}</span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {lede && <p className="mt-2 max-w-3xl text-sm text-ink-muted leading-relaxed">{lede}</p>}
    </header>
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
