import {
  ArrowDownLeft,
  CalendarX2,
  ChevronDown,
  CircleCheck,
  History,
  LogIn,
  PenLine,
  Plus,
  Radio,
  Scale,
  Ship,
  TriangleAlert,
  Truck,
  Unlock,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import Panel from '../../components/Panel'
import { navigate } from '../../lib/navigation'
import { LOGIN } from '../../lib/router'
import { StatementPayload, type StatementPayloadT } from '../../data/schemas'
import { useApiData } from '../../data/useApiData'
import { useTracker } from '../../data/useTracker'
import { buildStatement, type Discrepancy, type Month } from '../../engine/statement'
import type { StatementFileT } from '../../engine/statementSchema'
import type { Tracker } from '../../engine/tracker'
import { amount, day, monthLong, usd } from '../../lib/format'
import { useEditor } from './editor'
import FixView from './FixView'
import { CorrectionForm, InvoiceForm, PaymentForm, VoidForm } from './Forms'
import { MovementRow, PoChip, Tile } from './parts'
import { LineView, MonthView, PoView, type Nav } from './Views'

/**
 * Tab 2, the PHL/EcoFibre statement, live. efdashboard.com is the master for
 * orders and dispatches; the workbook supplies values and history back to 2022;
 * payments, invoices, corrections and files recorded here appear for EcoFibre
 * and Polyco at once. Every disagreement is a numbered discrepancy.
 */
type View =
  | { k: 'month'; month: string }
  | { k: 'line'; key: string }
  | { k: 'po'; po: string }
  | { k: 'unlock' }
  | { k: 'payment' }
  | { k: 'invoice'; po?: string }
  | { k: 'correction'; lineKey?: string }
  | { k: 'void'; id: string }
  | { k: 'fix'; key: string }

export default function StatementTab() {
  const statement = useApiData('/api/statement', StatementPayload, 'statement')
  const { tracker, error: trackerError, loading: trackerLoading } = useTracker()

  if (statement.status === 'loading' || trackerLoading) {
    return <p className="mt-8 text-body text-press-2" aria-busy="true">Loading the statement and reading efdashboard.com.</p>
  }
  if (statement.status === 'failed') {
    return (
      <p role="alert" className="mt-8 max-w-prose rounded-card border-l-3 border-alert bg-sheet py-3 pl-4 pr-4 text-body text-alert">
        {statement.error}
      </p>
    )
  }
  return <Page data={statement.data} tracker={tracker} trackerError={trackerError} reload={statement.reload} />
}

function Page({ data, tracker, trackerError, reload }: { data: StatementPayloadT; tracker: Tracker | null; trackerError: string | null; reload: () => void }) {
  const model = useMemo(() => buildStatement(data.workbook, tracker, data.entries, data.disputes, data.rules), [data, tracker])
  const { editor } = useEditor()
  const [views, setViews] = useState<View[]>([])
  const [severity, setSeverity] = useState<'all' | Discrepancy['severity']>('all')
  const [showFixed, setShowFixed] = useState(false)
  const [discOpen, setDiscOpen] = useState(false)

  const go = (v: View) => setViews((s) => [...s, v])
  const back = () => setViews((s) => s.slice(0, -1))
  const close = () => setViews([])
  const done = () => {
    reload()
    back()
  }
  const nav: Nav = {
    line: (key) => go({ k: 'line', key }),
    po: (po) => go({ k: 'po', po }),
    correct: (lineKey) => go({ k: 'correction', lineKey }),
    invoice: (po) => go({ k: 'invoice', po }),
    voidEntry: (id) => go({ k: 'void', id }),
    fix: (key) => go({ k: 'fix', key }),
  }
  const needEditor = (v: View) => (editor ? go(v) : go({ k: 'unlock' }))

  const filesFor = (target: string): StatementFileT[] => data.files.filter((f) => f.target === target)
  const p = model.position
  const view = views[views.length - 1] ?? null
  const newestFirst = [...model.months].reverse()
  const years = [...new Set(newestFirst.map((m) => m.month.slice(0, 4)))]
  const openOrders = model.lines.filter((l) => l.status === 'awaiting' || l.status === 'on-hold')
  const counts = { high: 0, medium: 0, low: 0 }
  for (const d of model.discrepancies) if (!d.resolved) counts[d.severity] += 1
  const fixedCount = model.discrepancies.length - model.openDiscrepancies
  const shown = model.discrepancies.filter((d) => (showFixed || !d.resolved) && (severity === 'all' || d.severity === severity))
  const pos = tracker ? tracker.pos.filter((x) => !x.isInternal) : []

  // What the panel shows.
  let title = ''
  let eyebrow: string | undefined
  let body: ReactNode = null
  if (view?.k === 'month') {
    const i = model.months.findIndex((m) => m.month === view.month)
    const m = model.months[i]
    title = monthLong(m.month)
    eyebrow = 'PHL/EcoFibre statement'
    body = <MonthView m={m} opening={i > 0 ? model.months[i - 1].balanceCents : 0} filesFor={filesFor} nav={nav} />
  } else if (view?.k === 'line') {
    const line = model.lines.find((l) => l.key === view.key)!
    title = line.kind === 'order' && line.po ? `PO ${line.po}` : line.name
    eyebrow = line.source === 'workbook' ? `Workbook row ${line.row}` : `Recorded by ${line.statusNote.replace(/^Recorded by /, '')}`
    body = (
      <LineView
        line={line}
        raw={data.workbook.rows.find((r) => r.row === line.row) ?? null}
        model={model}
        files={filesFor(line.row !== null ? `row-${line.row}` : `entry-${line.entryId}`)}
        editor={editor}
        onChanged={reload}
        nav={nav}
      />
    )
  } else if (view?.k === 'po') {
    title = `PO ${view.po}`
    eyebrow = 'Purchase order'
    body = <PoView po={view.po} tracker={tracker?.byPo.get(view.po) ?? null} model={model} files={filesFor(`po-${view.po}`)} editor={editor} onChanged={reload} nav={nav} />
  } else if (view?.k === 'fix') {
    const d = model.discrepancies.find((x) => x.key === view.key)
    title = d ? `${d.id}. ${d.title}` : 'Discrepancy'
    eyebrow = d?.resolved ? 'Fixed' : 'Fix a discrepancy'
    body = d ? (
      <FixView d={d} tracker={tracker} editor={editor} onUnlock={() => go({ k: 'unlock' })} onDone={() => { reload(); back() }} />
    ) : (
      <p className="text-table">This discrepancy no longer appears on the statement.</p>
    )
  } else if (view?.k === 'unlock') {
    title = 'Sign in to make changes'
    body = (
      <div className="space-y-4 text-table">
        <p>
          Anyone with the link can read the statement. Recording a payment or invoice, correcting a figure, fixing a
          discrepancy or uploading a file needs you to sign in, so each change shows who made it.
        </p>
        <button type="button" className="btn-primary" onClick={() => navigate(LOGIN)}>
          <LogIn size={16} aria-hidden /> Sign in
        </button>
      </div>
    )
  } else if (view && editor) {
    if (view.k === 'payment') {
      title = 'Record a payment from Polyco'
      body = <PaymentForm editor={editor} onDone={done} />
    } else if (view.k === 'invoice') {
      title = 'Record an invoice to Polyco'
      body = <InvoiceForm editor={editor} pos={pos} po={view.po} onDone={done} />
    } else if (view.k === 'correction') {
      title = 'Correct a figure'
      body = <CorrectionForm editor={editor} lines={model.lines} line={model.lines.find((l) => l.key === view.lineKey)} onDone={done} />
    } else if (view.k === 'void') {
      const e = data.entries.find((x) => x.id === view.id)!
      title = 'Void a recorded change'
      body = <VoidForm editor={editor} id={view.id} what={`${e.description} (${amount(Math.round(e.amount * 100))})`} onDone={done} />
    }
  }

  return (
    <div className="space-y-8 pt-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="condensed flex items-center gap-2 text-figure font-bold">
            PHL/EcoFibre statement
            {model.trackerLive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-income-wash px-2.5 py-1 text-small font-semibold text-income">
                <Radio size={13} aria-hidden /> Live
              </span>
            ) : null}
          </h1>
          <p className="mt-1 max-w-prose text-table text-press-2">
            Every order, delivery, recharge and payment between Eco Fibre Bahrain W.L.L. and Polyco Healthline Ltd.
            efdashboard.com is the master for orders and dispatches: once a container is dispatched there, it counts
            as delivered here. Values and history back to 2022 come from the statement workbook; changes recorded here
            appear for both companies at once.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editor ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-income-wash px-3 py-1.5 text-small font-semibold text-income">
              <Unlock size={13} aria-hidden /> Editing as {editor.name}
            </span>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => navigate(LOGIN)}>
              <LogIn size={15} aria-hidden /> Sign in to make changes
            </button>
          )}
        </div>
      </header>

      {!model.trackerLive && (
        <p role="status" className="flex gap-2 rounded-card bg-caution-wash p-3 text-table text-caution">
          <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
          efdashboard.com could not be read just now ({trackerError ?? 'no answer'}). Orders show the workbook's own
          status until it answers; reload to try again.
        </p>
      )}

      {/* Actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        <ActionButton Icon={ArrowDownLeft} tile="bg-income-wash text-income" title="Record a payment" text="Money received from Polyco" onClick={() => needEditor({ k: 'payment' })} />
        <ActionButton Icon={Plus} tile="bg-recharge-wash text-recharge" title="Record an invoice" text="Goods, or a clearance, freight or courier recharge" onClick={() => needEditor({ k: 'invoice' })} />
        <ActionButton Icon={PenLine} tile="bg-caution-wash text-caution" title="Correct a figure" text="Keeps the original visible" onClick={() => needEditor({ k: 'correction' })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[6fr_5fr]">
        <section aria-labelledby="position-title" className="rounded-card bg-sheet p-5 shadow-card">
          <h2 id="position-title" className="flex items-center gap-2 text-title font-bold">
            <Scale size={20} aria-hidden /> The position, live
          </h2>
          <dl className="mt-3 space-y-1.5 text-table">
            <Row label="Received from Polyco" cents={p.receivedCents} tone="income" />
            <Row label="Less delivered to Polyco" cents={-p.deliveredCents} />
            <p className="flex justify-between gap-4 pl-4 text-small text-recharge">
              <span className="flex items-center gap-1.5">
                <Ship size={12} aria-hidden /> Of which clearance, freight and courier recharges, not deducted again
              </span>
              <span className="num">{amount(p.rechargesCents)}</span>
            </p>
            <Row label="Balance held by EcoFibre" cents={p.balanceCents} strong />
            <Row label="Less orders awaiting dispatch" cents={-p.awaitingCents} />
            <Row label="Less orders on hold" cents={-p.onHoldCents} />
          </dl>
          <div className="mt-3 flex items-baseline justify-between gap-4 rounded-card bg-press px-3 py-2.5 text-sheet">
            <span className="font-semibold">Exposure (US$)</span>
            <span className="num text-title font-bold">{amount(p.exposureCents)}</span>
          </div>
          {model.workbook.exposureCents !== null && (
            <p className="mt-2 text-small text-press-2">
              The workbook states {usd(model.workbook.exposureCents)}; the difference of{' '}
              {usd(model.workbook.exposureCents - p.exposureCents)} is explained in the discrepancies below.
            </p>
          )}
        </section>

        <section aria-labelledby="open-title" className="rounded-card bg-sheet p-5 shadow-card">
          <h2 id="open-title" className="flex items-center gap-2 text-title font-bold">
            <Truck size={20} aria-hidden /> Orders not yet dispatched
          </h2>
          <p className="mt-1 text-small text-press-2">From efdashboard.com. Each moves into delivered value when its container is dispatched.</p>
          <ul className="mt-3 divide-y divide-rule">
            {openOrders.map((l) => (
              <li key={l.key} className="flex items-center justify-between gap-3 py-2 text-table">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {l.po ? <PoChip po={l.po} onOpen={nav.po} /> : <span>{l.ref}</span>}
                  <span className="text-small text-press-2">{l.statusNote}</span>
                </span>
                <span className={`num shrink-0 ${l.status === 'on-hold' ? 'text-caution' : ''}`}>{amount(l.openCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Discrepancies: folded away until opened */}
      <section aria-labelledby="disc-title" className="rounded-card bg-sheet p-5 shadow-card">
        <h2 id="disc-title" className="text-title font-bold">
          <button
            type="button"
            aria-expanded={discOpen}
            aria-controls="disc-body"
            onClick={() => setDiscOpen((o) => !o)}
            className="flex w-full min-h-[44px] items-center gap-2 text-left"
          >
            <TriangleAlert size={20} aria-hidden className="text-caution" />
            Discrepancies
            <ChevronDown size={20} aria-hidden className={`ml-auto text-press-2 transition-transform ${discOpen ? 'rotate-180' : ''}`} />
          </button>
        </h2>
        {discOpen && (
          <div id="disc-body" className="mt-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex flex-wrap items-center gap-2 text-table font-semibold">
                <span className="rounded-full bg-caution-wash px-2.5 py-1 text-small text-caution">{model.openDiscrepancies} open</span>
                {fixedCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-income-wash px-2.5 py-1 text-small font-semibold text-income">
                    <CircleCheck size={13} aria-hidden /> {fixedCount} fixed
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show by importance">
                {([
                  ['all', `All ${model.openDiscrepancies}`],
                  ['high', `High ${counts.high}`],
                  ['medium', `Medium ${counts.medium}`],
                  ['low', `Low ${counts.low}`],
                ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={severity === v}
                    onClick={() => setSeverity(v)}
                    className={`rounded-full border px-3 py-1 text-small font-semibold ${severity === v ? 'border-press bg-press text-sheet' : 'border-rule'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 max-w-prose text-small text-press-2">
              Where the workbook ({data.workbook.file}) and efdashboard.com disagree, this statement follows efdashboard.com.
              Open any item to see what each side reads and fix it. Every fix is signed, and can be undone.
            </p>
            {fixedCount > 0 && (
              <label className="mt-2 inline-flex items-center gap-2 text-small">
                <input type="checkbox" checked={showFixed} onChange={(e) => setShowFixed(e.target.checked)} className="h-4 w-4" />
                Show the {fixedCount} fixed
              </label>
            )}
            <ol className="mt-4 divide-y divide-rule">
              {shown.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => nav.fix(d.key)}
                    aria-haspopup="dialog"
                    className="flex w-full items-start gap-3 py-2.5 text-left hover:bg-mist"
                  >
                    <span
                      className={`mt-0.5 inline-flex h-6 min-w-[2.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-small font-bold ${
                        d.resolved
                          ? 'bg-income-wash text-income'
                          : d.severity === 'high'
                            ? 'bg-caution text-sheet'
                            : d.severity === 'medium'
                              ? 'bg-caution-wash text-caution'
                              : 'bg-mist text-press-2'
                      }`}
                      aria-label={`${d.resolved ? 'fixed' : `${d.severity} importance`}, number ${d.id}`}
                    >
                      {d.id}
                    </span>
                    <span className="min-w-0 flex-1 text-table">
                      <span className={`block font-semibold ${d.resolved ? 'text-press-2 line-through' : ''}`}>{d.title}</span>
                      <span className="block text-press-2">
                        {d.resolved ? `Fixed by ${d.resolved.by}, ${day(d.resolved.at.slice(0, 10))}: ${d.resolved.note}` : d.detail}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 self-center rounded-full px-3 py-1 text-small font-semibold ${
                        d.resolved ? 'bg-income-wash text-income' : 'bg-press text-sheet'
                      }`}
                    >
                      {d.resolved ? 'Fixed' : 'Fix'}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* Months */}
      {years.map((year) => (
        <section key={year} aria-labelledby={`st-year-${year}`}>
          <h2 id={`st-year-${year}`} className="condensed mb-3 text-title font-bold text-press-2">
            {year}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {newestFirst
              .filter((m) => m.month.startsWith(year))
              .map((m) => (
                <li key={m.month}>
                  <MonthCard m={m} onOpen={() => go({ k: 'month', month: m.month })} />
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section aria-labelledby="unres-title" className="rounded-card bg-sheet p-5 shadow-card">
        <h2 id="unres-title" className="flex items-center gap-2 text-title font-bold">
          <CalendarX2 size={20} aria-hidden /> Not in a month: no confirmed date
        </h2>
        <p className="mt-1 max-w-prose text-small text-press-2">
          These count in every total but sit in no month until their date is agreed. Open one to see why.
        </p>
        <ul className="mt-3 divide-y divide-rule rounded-card bg-mist px-1">
          {model.unresolved.map((m) => (
            <MovementRow key={m.key} m={m} files={filesFor(m.line.key).length} onLine={nav.line} onPo={nav.po} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="hist-title" className="rounded-card bg-sheet p-5 shadow-card">
        <h2 id="hist-title" className="flex items-center gap-2 text-title font-bold">
          <History size={20} aria-hidden /> Changes recorded here
        </h2>
        {data.entries.length === 0 ? (
          <p className="mt-2 text-table text-press-2">Nothing recorded yet. Payments, invoices and corrections will be listed here with who recorded them.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule">
            {[...data.entries].sort((a, b) => b.at.localeCompare(a.at)).map((e) => (
              <li key={e.id} className={`flex flex-wrap items-center justify-between gap-3 py-2 text-table ${e.voided ? 'text-press-2 line-through' : ''}`}>
                <span>
                  <span className="font-semibold capitalize">{e.kind}</span>: {e.description}
                  {e.po && <> · PO {e.po}</>}
                  <span className="block text-small text-press-2 no-underline">
                    {e.by}, {day(e.at.slice(0, 10))}
                    {e.voided && ` · voided by ${e.voided.by}: ${e.voided.reason}`}
                  </span>
                </span>
                <span className="num">{amount(Math.round(e.amount * 100))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Panel open={view !== null} onClose={close} onBack={views.length > 1 ? back : undefined} title={title} eyebrow={eyebrow}>
        {body}
      </Panel>
    </div>
  )
}

function ActionButton({ Icon, tile, title, text, onClick }: { Icon: typeof Plus; tile: string; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-haspopup="dialog" className="flex items-center gap-3 rounded-card bg-sheet p-4 text-left shadow-card transition-shadow hover:shadow-lift">
      <Tile Icon={Icon} tile={tile} size={38} />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-small text-press-2">{text}</span>
      </span>
    </button>
  )
}

function Row({ label, cents, strong = false, tone }: { label: string; cents: number; strong?: boolean; tone?: 'income' }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'border-t-2 border-press pt-1.5 font-semibold' : ''} ${tone === 'income' ? 'font-semibold text-income' : ''}`}>
      <dt>{label}</dt>
      <dd className="num">{amount(cents)}</dd>
    </div>
  )
}

function MonthCard({ m, onOpen }: { m: Month; onOpen: () => void }) {
  if (m.movements.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-card border border-dashed border-rule p-4 text-press-2">
        <h3 className="condensed text-title font-bold">{monthLong(m.month)}</h3>
        <p className="mt-1 text-small">No movements</p>
        <p className="mt-auto pt-3 text-small">Balance {amount(m.balanceCents)}</p>
      </div>
    )
  }
  const recharges = m.movements.filter((x) => x.line.kind === 'recharge').length
  const issues = m.movements.filter((x) => x.line.discrepancies.length).length
  return (
    <button type="button" onClick={onOpen} aria-haspopup="dialog" className="flex h-full w-full flex-col rounded-card border border-rule bg-sheet p-4 text-left shadow-card transition-shadow hover:shadow-lift">
      <h3 className="condensed text-title font-bold">{monthLong(m.month)}</h3>
      <p className="mt-3 text-small text-press-2">Balance at month end</p>
      <p className="num text-figure font-bold">{usd(m.balanceCents)}</p>
      <dl className="mt-3 space-y-1 text-table">
        {m.receivedCents > 0 && (
          <div className="flex items-center justify-between gap-2 text-income">
            <dt className="flex items-center gap-1.5 font-semibold">
              <ArrowDownLeft size={15} aria-hidden /> Received
            </dt>
            <dd className="num font-semibold">{amount(m.receivedCents)}</dd>
          </div>
        )}
        {m.deliveredCents > 0 && (
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5">
              <Truck size={15} aria-hidden /> Delivered
            </dt>
            <dd className="num">{amount(-m.deliveredCents)}</dd>
          </div>
        )}
      </dl>
      {(recharges > 0 || issues > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {recharges > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-recharge-wash px-2.5 py-1 text-small font-semibold text-recharge">
              <Ship size={13} aria-hidden /> {recharges} {recharges === 1 ? 'recharge' : 'recharges'}
            </span>
          )}
          {issues > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-caution-wash px-2.5 py-1 text-small font-semibold text-caution">
              <TriangleAlert size={13} aria-hidden /> {issues} to check
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-income-wash px-2.5 py-1 text-small font-semibold text-income">
              <CircleCheck size={13} aria-hidden /> Agrees
            </span>
          )}
        </div>
      )}
    </button>
  )
}

