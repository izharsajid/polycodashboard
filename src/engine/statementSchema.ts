import { z } from 'zod'

/**
 * `data/polyco-statement.json`: the EcoFibre x Polyco statement workbook copied
 * cell for cell by `scripts/import-statement.py`, with no correction. A date cell
 * arrives as YYYY-MM-DD; anything typed as text stays text.
 */
const Cell = z.union([z.string(), z.number()]).nullable()

export const WorkbookRow = z.object({
  row: z.number().int(),
  sno: Cell,
  ref: Cell,
  product: Cell,
  po_amount: Cell,
  proforma: Cell,
  proforma_amount: Cell,
  delivered: Cell,
  received: Cell,
  received_date: Cell,
  loaded: Cell,
  delivered_k: Cell,
  pending_l: Cell,
  delivery_date: Cell,
})

export const Workbook = z.object({
  source: z.string(),
  file: z.string(),
  as_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z.array(WorkbookRow).min(1),
  summary: z.array(
    z.union([
      z.object({
        row: z.number(),
        kind: z.literal('totals'),
        po_amount: Cell,
        proforma_amount: Cell,
        delivered: Cell,
        received: Cell,
        delivered_k: Cell,
        pending_l: Cell,
      }),
      z.object({ row: z.number(), kind: z.literal('line'), label: z.string(), value: Cell }),
    ]),
  ),
})

/**
 * A change recorded on this site: a payment in, an invoice out, or a correction
 * to a workbook figure. Recorded changes are added to the statement; nothing in
 * the workbook is overwritten, and a correction shows the figure it replaces.
 */
export const EntryKind = z.enum(['payment', 'invoice', 'correction'])
export const InvoiceKind = z.enum(['goods', 'recharge', 'other'])

export const Entry = z.object({
  id: z.string().min(1),
  kind: EntryKind,
  /** The date of the payment or invoice itself, not when it was recorded. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** US$, to the cent. A correction's amount is the corrected figure. */
  amount: z.number().finite(),
  /** An invoice: goods against a PO, a recharge (clearance, freight), or other. */
  invoiceKind: InvoiceKind.nullable(),
  po: z.string().max(40).nullable(),
  /** A correction: the workbook row and which figure on it. */
  row: z.number().int().nullable(),
  field: z.enum(['delivered', 'received', 'po_amount']).nullable(),
  reference: z.string().max(120).nullable(),
  description: z.string().min(1).max(300),
  by: z.string().min(1).max(80),
  at: z.string(),
  voided: z.object({ by: z.string(), at: z.string(), reason: z.string() }).nullable(),
})

/** A file uploaded against a workbook row, a recorded entry or a PO. */
export const StatementFile = z.object({
  id: z.string(),
  target: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  uploadedBy: z.string(),
  uploadedAt: z.string(),
})

export type WorkbookT = z.infer<typeof Workbook>
export type WorkbookRowT = z.infer<typeof WorkbookRow>
export type EntryT = z.infer<typeof Entry>
export type StatementFileT = z.infer<typeof StatementFile>

/**
 * `data/ledger-disputes.json`: workbook dates another document of record
 * contradicts. Shown as unresolved until agreed, never corrected silently.
 */
export const LedgerDisputes = z.object({
  note: z.string(),
  disputes: z.array(
    z.object({
      source_row: z.number().int(),
      movement: z.enum(['received', 'delivered']),
      ledger_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      other_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      other_source: z.string().min(1),
    }),
  ),
})

export type LedgerDisputesT = z.infer<typeof LedgerDisputes>
