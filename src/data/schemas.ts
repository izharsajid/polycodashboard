import { z } from 'zod'
import { LedgerDisputes, Ledger } from '../engine/ledgerSchema'
import { FundsRequested } from '../engine/schema'

/** What each endpoint returns, as the tabs validate it. */
export const FundsPayload = z.object({ funds: FundsRequested })
export const LedgerPayload = z.object({ ledger: Ledger, disputes: LedgerDisputes })
