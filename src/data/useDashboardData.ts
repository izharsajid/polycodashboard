import { useEffect, useState } from 'react'
import { useSession } from '../auth/session'
import { api } from '../lib/api'
import {
  Ledger,
  MachineSchedule,
  PoTracker,
  Statements,
  type LedgerT,
  type MachineScheduleT,
  type PoTrackerT,
  type StatementsT,
} from '../lib/schema'

/**
 * The figures arrive from `/api/data` once there is a session, rather than being
 * compiled into the bundle where anyone could read them without one.
 *
 * They are parsed here, on receipt, the same way they were when this was an
 * import. CLAUDE.md: every business number loads from /data and is validated by
 * Zod at load. The load moved; the validation did not.
 */
export type DashboardData = {
  ledger: LedgerT
  statements: StatementsT
  poTracker: PoTrackerT
  machineSchedule: MachineScheduleT
}

export type DataState =
  | { status: 'loading' }
  | { status: 'ready'; data: DashboardData }
  | { status: 'failed'; error: string }

const MALFORMED =
  'The figures came back in a shape this page does not recognise. Reload, and if it ' +
  'happens again a file in /data has changed and the build needs looking at.'

export function useDashboardData(): DataState {
  const { expire } = useSession()
  const [state, setState] = useState<DataState>({ status: 'loading' })

  useEffect(() => {
    let live = true

    void (async () => {
      const result = await api.get<{
        ledger: unknown
        statements: unknown
        poTracker: unknown
        machineSchedule: unknown
      }>('/api/data')
      if (!live) return

      if (!result.ok) {
        // A 401 here means the session ended between loading the page and asking
        // for the figures. Say so once, in one place, and let the router send
        // them back to sign in.
        if (result.status === 401) expire()
        else setState({ status: 'failed', error: result.error })
        return
      }

      const ledger = Ledger.safeParse(result.data.ledger)
      const statements = Statements.safeParse(result.data.statements)
      const poTracker = PoTracker.safeParse(result.data.poTracker)
      const machineSchedule = MachineSchedule.safeParse(result.data.machineSchedule)
      if (!ledger.success || !statements.success || !poTracker.success || !machineSchedule.success) {
        setState({ status: 'failed', error: MALFORMED })
        return
      }

      setState({
        status: 'ready',
        data: {
          ledger: ledger.data,
          statements: statements.data,
          poTracker: poTracker.data,
          machineSchedule: machineSchedule.data,
        },
      })
    })()

    return () => {
      live = false
    }
  }, [expire])

  return state
}
