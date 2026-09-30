import { Upload } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { Line } from '../../engine/statement'
import type { TrackerPo } from '../../engine/tracker'
import { amount } from '../../lib/format'
import { recordEntry, uploadFile, voidEntry, type Editor, type NewEntry } from './editor'
import { Field } from './parts'

/**
 * The forms behind every change to the statement. Each one records who made the
 * change, never overwrites the workbook, and can carry a supporting file.
 */
const today = () => new Date().toISOString().slice(0, 10)

function Form({ onSubmit, busy, error, submit, children }: { onSubmit: () => void; busy: boolean; error: string | null; submit: string; children: ReactNode }) {
  return (
    <form
      className="space-y-4 text-table"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      {children}
      {error && (
        <p role="alert" className="rounded bg-caution-wash px-3 py-2 text-caution">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? 'Saving…' : submit}
      </button>
    </form>
  )
}

function useSubmit() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (work: () => Promise<string | null>) => {
    setBusy(true)
    setError(null)
    const problem = await work()
    setBusy(false)
    if (problem) setError(problem)
    return problem === null
  }
  return { busy, error, setError, run }
}

const cents = (text: string) => {
  const n = Number(text.replace(/[,$\s]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

/** Save an entry, then any file with it. */
async function save(editor: Editor, entry: NewEntry, file: File | null, fileTarget?: (id: string) => string): Promise<string | null> {
  const result = await recordEntry(editor, entry)
  if (!result.ok) return result.error
  if (file) {
    const problem = await uploadFile(editor, fileTarget ? fileTarget(result.entry.id) : `entry-${result.entry.id}`, file)
    if (problem) return `The change was recorded, but the file was not uploaded: ${problem}`
  }
  return null
}

function FileField({ onChange, hint }: { onChange: (f: File | null) => void; hint?: string }) {
  return (
    <Field label="Supporting file (optional)" hint={hint ?? 'PDF, image or Office file, up to 20 MB.'}>
      <input type="file" className="field py-1.5" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </Field>
  )
}

export function PaymentForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const [date, setDate] = useState(today())
  const [value, setValue] = useState('')
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('Funds received from Polyco')
  const [file, setFile] = useState<File | null>(null)
  const s = useSubmit()
  return (
    <Form
      submit="Record payment"
      busy={s.busy}
      error={s.error}
      onSubmit={() =>
        void s.run(async () => {
          const n = cents(value)
          if (!(n > 0)) return 'Give the amount received, in US$.'
          const problem = await save(editor, { kind: 'payment', date, amount: n, invoiceKind: null, po: null, row: null, field: null, reference: reference.trim() || null, description: description.trim() }, file)
          if (!problem) onDone()
          return problem
        })
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date received">
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Amount received (US$)">
          <input className="field num" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" required />
        </Field>
      </div>
      <Field label="Bank reference (optional)">
        <input className="field" value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>
      <Field label="Description">
        <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} required />
      </Field>
      <FileField onChange={setFile} hint="The remittance advice or bank confirmation." />
    </Form>
  )
}

export function InvoiceForm({ editor, pos, po: presetPo, onDone }: { editor: Editor; pos: TrackerPo[]; po?: string; onDone: () => void }) {
  const [kind, setKind] = useState<'goods' | 'recharge' | 'other'>(presetPo ? 'goods' : 'goods')
  const [po, setPo] = useState(presetPo ?? '')
  const [date, setDate] = useState(today())
  const [value, setValue] = useState('')
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const s = useSubmit()
  return (
    <Form
      submit="Record invoice"
      busy={s.busy}
      error={s.error}
      onSubmit={() =>
        void s.run(async () => {
          const n = cents(value)
          if (!(n > 0)) return 'Give the invoice amount, in US$.'
          if (kind === 'goods' && !po) return 'Choose the PO the goods were invoiced against.'
          const text = description.trim() || (kind === 'goods' ? `Goods invoiced against PO ${po}` : kind === 'recharge' ? 'Recharge' : 'Charge')
          const problem = await save(editor, { kind: 'invoice', invoiceKind: kind, date, amount: n, po: po || null, row: null, field: null, reference: reference.trim() || null, description: text }, file)
          if (!problem) onDone()
          return problem
        })
      }
    >
      <fieldset>
        <legend className="kicker">What is being invoiced</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          {([
            ['goods', 'Goods against a PO'],
            ['recharge', 'Recharge: clearance, freight, courier'],
            ['other', 'Something else'],
          ] as const).map(([v, label]) => (
            <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-card border px-3 py-2 ${kind === v ? (v === 'recharge' ? 'border-recharge bg-recharge-wash' : 'border-press bg-mist') : 'border-rule'}`}>
              <input type="radio" name="invoice-kind" checked={kind === v} onChange={() => setKind(v)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={kind === 'goods' ? 'PO' : 'PO it relates to (optional)'}>
        <select className="field" value={po} onChange={(e) => setPo(e.target.value)}>
          <option value="">{kind === 'goods' ? 'Choose a PO' : 'None'}</option>
          {pos.map((p) => (
            <option key={p.po} value={p.po}>
              PO {p.po}, {p.product.slice(0, 60)} ({p.state.label.toLowerCase()})
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Invoice date">
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Amount (US$)">
          <input className="field num" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" required />
        </Field>
      </div>
      <Field label="Invoice number (optional)">
        <input className="field" value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>
      <Field label="Description" hint={kind === 'recharge' ? 'For example: Cargo clearance, PET film 150 rolls.' : undefined}>
        <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <FileField onChange={setFile} hint="The invoice itself." />
    </Form>
  )
}

export function CorrectionForm({ editor, lines, line: preset, onDone }: { editor: Editor; lines: Line[]; line?: Line; onDone: () => void }) {
  const [rowKey, setRowKey] = useState(preset?.key ?? '')
  const line = lines.find((l) => l.key === rowKey) ?? null
  const [field, setField] = useState<'delivered' | 'received' | 'po_amount'>(preset?.receivedCents && !preset.deliveredCents ? 'received' : 'delivered')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const s = useSubmit()
  const current = line ? (field === 'delivered' ? line.deliveredCents : field === 'received' ? line.receivedCents : line.poAmountCents) : null
  return (
    <Form
      submit="Record correction"
      busy={s.busy}
      error={s.error}
      onSubmit={() =>
        void s.run(async () => {
          if (!line || line.row === null) return 'Choose the workbook line to correct.'
          const n = cents(value)
          if (!Number.isFinite(n)) return 'Give the corrected amount, in US$.'
          if (reason.trim().length < 3) return 'Say why the figure is being corrected.'
          const problem = await save(
            editor,
            { kind: 'correction', date: today(), amount: n, invoiceKind: null, po: line.po, row: line.row, field, reference: null, description: reason.trim() },
            file,
            () => `row-${line.row}`,
          )
          if (!problem) onDone()
          return problem
        })
      }
    >
      <p className="text-press-2">
        A correction replaces one figure on a workbook line. The workbook is not changed: the statement shows the
        corrected figure, the one it replaced, who corrected it and why.
      </p>
      <Field label="Workbook line">
        <select className="field" value={rowKey} onChange={(e) => setRowKey(e.target.value)} required>
          <option value="">Choose a line</option>
          {lines
            .filter((l) => l.source === 'workbook')
            .map((l) => (
              <option key={l.key} value={l.key}>
                Row {l.row}: {l.kind === 'order' && l.po ? `PO ${l.po}` : l.name}
                {l.receivedCents ? `, received ${amount(l.receivedCents)}` : ''}
                {l.deliveredCents ? `, delivered ${amount(l.deliveredCents)}` : ''}
              </option>
            ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Figure to correct">
          <select className="field" value={field} onChange={(e) => setField(e.target.value as typeof field)}>
            <option value="delivered">Delivered value</option>
            <option value="received">Amount received</option>
            <option value="po_amount">PO value</option>
          </select>
        </Field>
        <Field label="Corrected amount (US$)" hint={current !== null ? `Now ${amount(current)}` : undefined}>
          <input className="field num" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" required />
        </Field>
      </div>
      <Field label="Reason">
        <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: the bank credit was 205,689.86" required />
      </Field>
      <FileField onChange={setFile} hint="Evidence for the correction, such as the bank advice." />
    </Form>
  )
}

export function VoidForm({ editor, id, what, onDone }: { editor: Editor; id: string; what: string; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const s = useSubmit()
  return (
    <Form
      submit="Void this change"
      busy={s.busy}
      error={s.error}
      onSubmit={() =>
        void s.run(async () => {
          if (reason.trim().length < 3) return 'Say why it is being voided.'
          const problem = await voidEntry(editor, id, reason.trim())
          if (!problem) onDone()
          return problem
        })
      }
    >
      <p className="text-press-2">
        Voiding takes {what} out of every total. It stays in the history with your name and reason; nothing is deleted.
      </p>
      <Field label="Reason">
        <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: recorded twice" required />
      </Field>
    </Form>
  )
}

export function UploadBox({ editor, target, onDone }: { editor: Editor; target: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const s = useSubmit()
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void s.run(async () => {
          if (!file) return 'Choose a file first.'
          const problem = await uploadFile(editor, target, file)
          if (!problem) {
            setFile(null)
            onDone()
          }
          return problem
        })
      }}
    >
      <input type="file" className="field max-w-xs py-1.5" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Choose a file to upload" />
      <button type="submit" className="btn-secondary" disabled={s.busy}>
        <Upload size={15} aria-hidden /> {s.busy ? 'Uploading…' : 'Upload'}
      </button>
      {s.error && <p role="alert" className="w-full text-small text-caution">{s.error}</p>}
    </form>
  )
}
