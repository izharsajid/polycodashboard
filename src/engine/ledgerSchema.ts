import { z } from 'zod'

/**
 * `data/polyco-ledger.json`: every PO, delivery, recharge and receipt between
 * EcoFibre and Polyco, from the statement workbook, with the workbook's own
 * summary. And `data/ledger-disputes.json`: dates another document of record
 * contradicts. Parsed at build time and again on receipt.
 */
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
const Money = z.number().finite()

export const LedgerRow = z.object({
  source_row: z.number().int(),
  ref: z.string().nullable(),
  po_number: z.string().nullable(),
  product: z.string().nullable(),
  type: z.enum(['delivery', 'receipt', 'recharge', 'pending_po']),
  po_amount: Money.nullable(),
  proforma_ref: z.string().nullable(),
  proforma_amount: Money.nullable(),
  delivered_value: Money.nullable(),
  received: Money.nullable(),
  received_date: IsoDate.nullable(),
  received_date_source: z.string().nullable(),
  loaded: z.string().nullable(),
  delivery_date: IsoDate.nullable(),
  delivery_date_source: z.string().nullable(),
  flags: z.array(z.string()),
})

export const Ledger = z.object({
  source: z.string(),
  currency: z.literal('USD'),
  summary: z.object({
    as_at: IsoDate,
    total_po_value: Money,
    total_delivered: Money,
    total_received: Money,
    pos_pending_to_deliver: Money,
    containers_ready_next_month: Money,
    containers_in_process_following_month: Money,
    uncovered_advance: Money,
    recharges_included_in_delivered: Money,
  }),
  rows: z.array(LedgerRow).min(1),
})

export const LedgerDisputes = z.object({
  note: z.string(),
  disputes: z.array(
    z.object({
      source_row: z.number().int(),
      movement: z.enum(['received', 'delivered']),
      ledger_date: IsoDate,
      other_date: IsoDate,
      other_source: z.string().min(1),
    }),
  ),
})

export type LedgerRowT = z.infer<typeof LedgerRow>
export type LedgerT = z.infer<typeof Ledger>
export type LedgerDisputesT = z.infer<typeof LedgerDisputes>
