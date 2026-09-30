import { CheckCircle2, CircleCheck, EyeOff, FileUp, Link2, PenLine, Plus, Undo2, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { Discrepancy, Fix } from '../../engine/statement'
import type { Tracker } from '../../engine/tracker'
import { amount, day } from '../../lib/format'
import { recordEntry, uploadFile, voidEntry, type Editor, type NewEntry } from './editor'
import { Field } from './parts'

/**
 * Fixing one discrepancy. What each side reads, then every way to settle it.
 * Each fix is a signed entry: the ones that change a figure, a date or a PO, or
 * leave a line out, change the statement at once; the rest record that it was
 * looked at and agreed. A fix can be undone, which voids its entry.
 */
const ICON: Record<Fix['type'], LucideIcon> = {
  acknowledge: CircleCheck,
  'set-value': PenLine,
  'set-date': PenLine,
  exclude: EyeOff,
  'assign-po': Link2,
  'add-po': Plus,
  upload: FileUp,
}

const today = () => new Date().toISOString().slice(0, 10)

export default function FixView({
  d,
  tracker,
  editor,
  onUnlock,
  onDone,
}: {
  d: Discrepancy
  tracker: Tracker | null
  editor: Editor | null
  onUnlock: () => void
  onDone: () => void
}) {
  const [chosen, setChosen] = useState<number>(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (work: () => Promise<string | null>) => {
    setBusy(true)
    setError(null)
    const problem = await work()
    setBusy(false)
    if (problem) setError(problem)
    else onDone()
  }

  return (
    <div className="space-y-5 text-table">
      <p>{d.detail}</p>

      {(d.workbook || d.master) && (
        <div className={`grid gap-2 ${d.workbook && d.master ? 'sm:grid-cols-2' : ''}`}>
          {d.workbook && <Side label="The workbook reads" value={d.workbook} tone="bg-caution-wash text-caution" />}
          {d.master && <Side label="efdashboard.com reads" value={d.master} tone="bg-info-wash text-info" />}
        </div>
      )}

      {d.resolved ? (
        <div className="space-y-3">
          <p className="flex gap-2 rounded-card bg-income-wash p-3 text-income">
            <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0" />
            <span>
              <span className="block font-semibold">Fixed by {d.resolved.by}, {day(d.resolved.at.slice(0, 10))}</span>
              <span className="block text-press">{d.resolved.note}</span>
            </span>
          </p>
          {editor && (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void run(() => voidEntry(editor, d.resolved!.entryId, 'Fix undone'))}
            >
              <Undo2 size={15} aria-hidden /> Undo this fix
            </button>
          )}
        </div>
      ) : !editor ? (
        <div className="rounded-card bg-mist p-4">
          <p>Fixing a discrepancy needs your name and the editor passcode.</p>
          <button type="button" className="btn-primary mt-3" onClick={onUnlock}>
            Unlock editing
          </button>
        </div>
      ) : (
        <fieldset className="space-y-2">
          <legend className="kicker mb-1">How to fix it</legend>
          {d.fixes.map((f, i) => {
            const Icon = ICON[f.type]
            const open = chosen === i
            return (
              <div key={i} className={`rounded-card border ${open ? 'border-press bg-sheet' : 'border-rule'}`}>
                <label className="flex cursor-pointer items-start gap-3 p-3">
                  <input type="radio" name="fix" className="mt-1" checked={open} onChange={() => setChosen(i)} />
                  <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-press-2" />
                  <span>
                    <span className="block font-semibold">{f.label}</span>
                    {'hint' in f && <span className="block text-small text-press-2">{f.hint}</span>}
                  </span>
                </label>
                {open && (
                  <div className="border-t border-rule p-3">
                    <FixForm f={f} d={d} tracker={tracker} editor={editor} busy={busy} run={run} />
                  </div>
                )}
              </div>
            )
          })}
        </fieldset>
      )}

      {error && (
        <p role="alert" className="rounded bg-caution-wash px-3 py-2 text-caution">
          {error}
        </p>
      )}
    </div>
  )
}

function Side({ label, value, tone }: { label: string; value: string | null; tone: string }) {
  return (
    <div className={`rounded-card px-3 py-2.5 ${tone}`}>
      <p className="text-small opacity-80">{label}</p>
      <p className="font-semibold">{value ?? '–'}</p>
    </div>
  )
}

function FixForm({
  f,
  d,
  tracker,
  editor,
  busy,
  run,
}: {
  f: Fix
  d: Discrepancy
  tracker: Tracker | null
  editor: Editor
  busy: boolean
  run: (work: () => Promise<string | null>) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [money, setMoney] = useState(f.type === 'set-value' && f.suggestions[0] ? (f.suggestions[0].cents / 100).toFixed(2) : '')
  const [date, setDate] = useState(f.type === 'set-date' && f.suggestions[0] ? f.suggestions[0].date : '')
  const [po, setPo] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const base = { key: d.key, reference: d.title.slice(0, 120), date: today(), invoiceKind: null, po: d.po, row: d.row } as const
  const record = async (entry: Partial<NewEntry> & Pick<NewEntry, 'kind' | 'description'>) => {
    const result = await recordEntry(editor, { amount: 0, field: null, value: null, ...base, ...entry } as NewEntry)
    return result.ok ? null : result.error
  }
  const toNumber = (t: string) => Number(t.replace(/[,$\s]/g, ''))

  const submit = () => {
    switch (f.type) {
      case 'acknowledge':
        return run(() => record({ kind: 'resolution', description: note.trim() || f.label }))
      case 'set-value': {
        const n = toNumber(money)
        if (!Number.isFinite(n)) return run(async () => 'Give the amount, in US$.')
        return run(() => record({ kind: 'correction', row: f.row, field: f.field, amount: Math.round(n * 100) / 100, description: note.trim() || f.label }))
      }
      case 'set-date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return run(async () => 'Choose the date.')
        return run(() => record({ kind: 'correction', row: f.row, field: f.field, value: date, description: note.trim() || `Date set to ${day(date)}` }))
      case 'exclude':
        if (note.trim().length < 3) return run(async () => 'Say why the line is being left out.')
        return run(() => record({ kind: 'correction', row: f.row, field: 'exclude', description: note.trim() }))
      case 'assign-po':
        if (!po) return run(async () => 'Choose the PO.')
        return run(() => record({ kind: 'correction', row: f.row, field: 'po', value: po, po, description: note.trim() || `Assigned to PO ${po}` }))
      case 'add-po': {
        const n = toNumber(money)
        if (!(n > 0)) return run(async () => "Give the PO's value, in US$.")
        return run(() => record({ kind: 'correction', row: null, field: 'po_amount', po: f.po, amount: Math.round(n * 100) / 100, description: note.trim() || `PO ${f.po} added at its value` }))
      }
      case 'upload':
        if (!file) return run(async () => 'Choose the file.')
        return run(async () => (await uploadFile(editor, f.target, file)) ?? record({ kind: 'resolution', description: note.trim() || `Invoice uploaded: ${file.name}` }))
    }
  }

  const candidates = f.type === 'assign-po' && tracker ? f.candidates.map((c) => tracker.byPo.get(c)).filter(Boolean) : []

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      {(f.type === 'set-value' || f.type === 'add-po') && (
        <Field label={f.type === 'add-po' ? 'PO value (US$)' : 'Amount (US$)'}>
          <input className="field num" inputMode="decimal" value={money} onChange={(e) => setMoney(e.target.value)} placeholder="0.00" />
          {f.type === 'set-value' && (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {f.suggestions.map((s) => (
                <button key={s.label} type="button" onClick={() => setMoney((s.cents / 100).toFixed(2))} className="rounded-full border border-rule px-2.5 py-1 text-small font-semibold hover:border-press">
                  {s.label}: {amount(s.cents)}
                </button>
              ))}
            </span>
          )}
        </Field>
      )}
      {f.type === 'set-date' && (
        <Field label="Date">
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {f.suggestions.length > 0 && (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {f.suggestions.map((s) => (
                <button key={s.label} type="button" onClick={() => setDate(s.date)} className="rounded-full border border-rule px-2.5 py-1 text-small font-semibold hover:border-press">
                  {s.label}: {day(s.date)}
                </button>
              ))}
            </span>
          )}
        </Field>
      )}
      {f.type === 'assign-po' && (
        <Field label="PO on efdashboard.com">
          <select className="field" value={po} onChange={(e) => setPo(e.target.value)}>
            <option value="">Choose a PO</option>
            {candidates.map((p) => (
              <option key={p!.po} value={p!.po}>
                PO {p!.po}, {p!.product.slice(0, 50)} ({p!.dispatchDate ? `dispatched ${day(p!.dispatchDate)}` : p!.state.label.toLowerCase()})
              </option>
            ))}
          </select>
        </Field>
      )}
      {f.type === 'upload' && (
        <Field label="Invoice file" hint="PDF, image or Office file, up to 20 MB.">
          <input type="file" className="field py-1.5" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
      )}
      <Field label={f.type === 'exclude' ? 'Why is it being left out?' : 'Note (optional)'}>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder={f.type === 'exclude' ? 'For example: copy of PO 2679302-1' : ''} />
      </Field>
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Apply this fix'}
      </button>
    </form>
  )
}
