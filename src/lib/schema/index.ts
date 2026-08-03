import { z } from 'zod'

export const LedgerRow = z.object({
  source_row: z.number(),
  ref: z.string(),
  po_number: z.string().nullable(),
  product: z.string().nullable(),
  type: z.enum(['delivery', 'pending_po', 'receipt', 'recharge']),
  po_amount: z.number().nullable(),
  proforma_ref: z.string().nullable(),
  proforma_amount: z.number().nullable(),
  delivered_value: z.number().nullable(),
  received: z.number().nullable(),
  received_date: z.string().nullable(),
  received_date_source: z.string().nullable(),
  loaded: z.string().nullable(),
  delivery_date: z.string().nullable(),
  delivery_date_source: z.string().nullable(),
  flags: z.array(z.string()),
})

export const LedgerSummary = z.object({
  as_at: z.string(),
  total_po_value: z.number(),
  total_delivered: z.number(),
  total_received: z.number(),
  pos_pending_to_deliver: z.number(),
  containers_ready_next_month: z.number(),
  containers_in_process_following_month: z.number(),
  uncovered_advance: z.number(),
  recharges_included_in_delivered: z.number(),
})

export const Ledger = z.object({
  source: z.string(),
  currency: z.string(),
  summary: LedgerSummary,
  rows: z.array(LedgerRow),
})

export const StatementLine = z.object({
  amount: z.number(),
  description: z.string(),
  remarks: z.string().nullable(),
})

export const Statement = z.object({
  id: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  prepared_date: z.string().nullable(),
  kind: z.enum(['request', 'request_with_actuals', 'actuals']),
  stated_total: z.number(),
  lines: z.array(StatementLine),
  notes: z.array(z.string()),
})

export const ReconRow = z.object({
  period: z.string(),
  requested: z.number(),
  receipts: z.array(z.object({
    date: z.string(),
    amount: z.number(),
    note: z.string().nullable(),
  })),
  received_total: z.number(),
  variance: z.number(),
  match_confidence: z.enum(['confirmed', 'probable', 'partial', 'unmatched']),
})

export const Statements = z.object({
  source: z.string(),
  currency: z.string(),
  statements: z.array(Statement),
  reconciliation_to_ledger: z.array(ReconRow),
  reconciliation_notes: z.array(z.string()),
})

export type LedgerT = z.infer<typeof Ledger>
export type LedgerRowT = z.infer<typeof LedgerRow>
export type StatementsT = z.infer<typeof Statements>
export type StatementT = z.infer<typeof Statement>
export type ReconRowT = z.infer<typeof ReconRow>
