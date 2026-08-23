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

/**
 * The order tracker, pulled from efdashboard's `po_data`.
 *
 * Every field the source holds as free text is kept as free text, and any date we
 * could parse out of it is kept alongside under a `_date` name. Nothing is
 * corrected in place: `cargo_ready` carries values like "ON HOLD (Miami)" and
 * "CARGO READY" as well as dates, and flattening those into a date column would
 * throw away what the row actually says.
 */
export const PoOrder = z.object({
  id: z.number(),
  row_no: z.string(),
  po_number: z.string(),
  product: z.string(),
  film: z.string(),
  rolls: z.string(),
  qty: z.string(),
  /** "Dispatched", "Booked", "Processing", "Cancelled", and two spellings of air freight. */
  order_status: z.string(),
  cargo_ready: z.string(),
  cargo_ready_date: z.string().nullable(),
  dispatched: z.string(),
  dispatched_date: z.string().nullable(),
  remarks: z.string(),
  is_new: z.boolean(),
  sort_order: z.number(),
})

export const PoTracker = z.object({
  source: z.string(),
  /** When the pull happened, not when the page was opened. */
  pulled_at: z.string(),
  row_count: z.number(),
  orders: z.array(PoOrder),
})

/**
 * The machine schedule. CAPACITY-SPEC section 2.
 *
 * Hand-entered from the production schedule rather than pulled from a system, so
 * every date carries how it was established and every purchase order carries
 * whether the assignment was confirmed or derived. Section 6: an estimate is
 * labelled as an estimate everywhere it flows through, not only where it was
 * entered.
 */
export const DateBasis = z.enum(['confirmed', 'estimated'])

/**
 * `in_progress` is a run that was already going at the as-at date, so its start
 * is not a scheduled date and must not be drawn as one. `horizon` is the edge of
 * the schedule rather than a stop, which is what a continuous machine's bar ends
 * at.
 */
export const EdgeBasis = z.enum(['confirmed', 'estimated', 'in_progress', 'horizon'])

export const SchedulePo = z.object({
  ref: z.string().min(1),
  /** `confirmed` where the spec names the machines; `derived` where matched by product. */
  basis: z.enum(['confirmed', 'derived']),
  note: z.string().nullable(),
})

export const MachineRun = z.object({
  product: z.string().min(1),
  from: z.string(),
  fromBasis: EdgeBasis,
  to: z.string(),
  toBasis: EdgeBasis,
  /**
   * The day the mould went on, where one did. Hours, not days: this is a marker
   * on the timeline and never a segment that consumes calendar. Section 2.
   */
  mouldChangeBefore: z.string().nullable(),
  note: z.string().nullable(),
  purchaseOrders: z.array(SchedulePo),
})

export const Machine = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['running', 'mould_changing', 'stopped']),
  currentProduct: z.string().min(1),
  /** True where the machine runs on repeat monthly orders and has no stop date. */
  continuous: z.boolean(),
  stopDate: z.string().nullable(),
  stopDateBasis: DateBasis.nullable(),
  /** Every machine here stops for one reason, and the tab has to say so. Section 2. */
  stopReason: z.enum(['purchase_orders_run_out']).nullable(),
  note: z.string().nullable(),
  runs: z.array(MachineRun).min(1),
})

export const MachineSchedule = z
  .object({
    source: z.string(),
    as_at: z.string(),
    horizon_end: z.string(),
    horizon_note: z.string(),
    /** The minimum viable configuration. A business number, so it lives here. */
    viable_floor: z.number().int().positive(),
    viable_floor_source: z.string(),
    assignment_basis: z.string(),
    machines: z.array(Machine).min(1),
    unscheduled_reasons: z.array(
      z.object({ ref: z.string().min(1), reason: z.string().min(1), basis: DateBasis }),
    ),
  })
  .superRefine((schedule, ctx) => {
    for (const machine of schedule.machines) {
      // A continuous machine with a stop date, or a stopping machine without one,
      // would drive the count chart off a claim the schedule does not make.
      if (machine.continuous && machine.stopDate !== null) {
        ctx.addIssue({
          code: 'custom',
          message: `${machine.id} is continuous and carries a stop date.`,
          path: ['machines'],
        })
      }
      if (!machine.continuous && machine.stopDate === null) {
        ctx.addIssue({
          code: 'custom',
          message: `${machine.id} is not continuous and carries no stop date.`,
          path: ['machines'],
        })
      }
    }
  })

export type LedgerT = z.infer<typeof Ledger>
export type LedgerRowT = z.infer<typeof LedgerRow>
export type StatementsT = z.infer<typeof Statements>
export type StatementT = z.infer<typeof Statement>
export type ReconRowT = z.infer<typeof ReconRow>
export type PoOrderT = z.infer<typeof PoOrder>
export type PoTrackerT = z.infer<typeof PoTracker>
export type MachineScheduleT = z.infer<typeof MachineSchedule>
export type MachineT = z.infer<typeof Machine>
export type MachineRunT = z.infer<typeof MachineRun>
export type SchedulePoT = z.infer<typeof SchedulePo>
