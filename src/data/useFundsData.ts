import { useEffect, useState } from 'react'
import { FundsRequested, type FundsRequestedT } from '../engine/schema'
import { api } from '../lib/api'

/**
 * The statements arrive from `/api/data` rather than being compiled into the
 * bundle, so a data change needs no rebuild of the page and the tabs that follow
 * can load their own files the same way.
 *
 * Parsed here, on receipt. CLAUDE.md: every business number loads from /data and
 * is validated by Zod at load. A shape mismatch stops the page with the field
 * that failed, rather than rendering a blank where a figure should be.
 */
export type FundsState =
  | { status: 'loading' }
  | { status: 'ready'; data: FundsRequestedT }
  | { status: 'failed'; error: string }

export function useFundsData(): FundsState {
  const [state, setState] = useState<FundsState>({ status: 'loading' })

  useEffect(() => {
    let live = true

    void (async () => {
      const result = await api.get<{ funds: unknown }>('/api/data')
      if (!live) return

      if (!result.ok) {
        setState({ status: 'failed', error: result.error })
        return
      }

      const parsed = FundsRequested.safeParse(result.data.funds)
      if (!parsed.success) {
        const first = parsed.error.issues[0]
        setState({
          status: 'failed',
          error:
            `The statements came back in a shape this page does not recognise ` +
            `(${first.path.join('.') || 'the file'}: ${first.message}). ` +
            `data/funds-requested.json has changed and the build needs looking at.`,
        })
        return
      }

      setState({ status: 'ready', data: parsed.data })
    })()

    return () => {
      live = false
    }
  }, [])

  return state
}
