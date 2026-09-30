import { z } from 'zod'
import { FundsRequested } from '../engine/schema'
import { Entry, LedgerDisputes, StatementFile, Workbook } from '../engine/statementSchema'
import { TrackerPayload } from '../engine/trackerSchema'

/** What each endpoint returns, as the tabs validate it. */
export const FundsPayload = z.object({ funds: FundsRequested })

export const StatementPayload = z.object({
  workbook: Workbook,
  disputes: LedgerDisputes,
  entries: z.array(Entry),
  files: z.array(StatementFile),
  editor: z.object({ enabled: z.boolean() }),
})
export type StatementPayloadT = z.infer<typeof StatementPayload>

export { TrackerPayload }
