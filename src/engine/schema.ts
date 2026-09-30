import { z } from 'zod'

/**
 * The shape of `data/funds-requested.json`, the fourteen Financial Overview
 * statements exactly as issued. Parsed at build time by `scripts/validate-data.ts`
 * and again when the page receives the file, so a shape change fails loudly
 * instead of rendering `undefined`.
 */
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

export const StatementKind = z.enum(['request', 'request_with_actuals', 'actuals'])

export const FundsLine = z.object({
  amount: z.number().finite(),
  description: z.string().min(1),
  remarks: z.string().nullable(),
})

/** Money received that the statement sets against its costs, such as other income. */
export const FundsIncome = z.object({
  amount: z.number().finite(),
  description: z.string().min(1),
  remarks: z.string().nullable(),
})

export const FundsStatement = z.object({
  id: z.string().regex(/^\d{4}-\d{2}$/, 'expected YYYY-MM'),
  period_start: IsoDate,
  period_end: IsoDate,
  prepared_date: IsoDate.nullable(),
  kind: StatementKind,
  stated_total: z.number().finite(),
  lines: z.array(FundsLine).min(1),
  /** Absent on the statements that set nothing against their costs. */
  income: z.array(FundsIncome).default([]),
  notes: z.array(z.string()),
})

export const FundsRequested = z.object({
  source: z.string(),
  currency: z.literal('USD'),
  statements: z.array(FundsStatement).min(1),
})

export type StatementKindT = z.infer<typeof StatementKind>
export type FundsLineT = z.infer<typeof FundsLine>
export type FundsStatementT = z.infer<typeof FundsStatement>
export type FundsRequestedT = z.infer<typeof FundsRequested>
