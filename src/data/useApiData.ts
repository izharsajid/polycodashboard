import { useEffect, useState } from 'react'
import type { z } from 'zod'
import { api } from '../lib/api'

/**
 * Fetch one endpoint and validate it with Zod on receipt. CLAUDE.md: every
 * business number loads from /data and is validated at load. A shape mismatch
 * stops the tab with the field that failed, rather than rendering a blank where
 * a figure should be.
 */
export type ApiState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'failed'; error: string }

export function useApiData<S extends z.ZodTypeAny>(path: string, schema: S, what: string): ApiState<z.infer<S>> {
  const [state, setState] = useState<ApiState<z.infer<S>>>({ status: 'loading' })

  useEffect(() => {
    let live = true

    void (async () => {
      const result = await api.get<unknown>(path)
      if (!live) return

      if (!result.ok) {
        setState({ status: 'failed', error: result.error })
        return
      }

      const parsed = schema.safeParse(result.data)
      if (!parsed.success) {
        const first = parsed.error.issues[0]
        setState({
          status: 'failed',
          error:
            `The ${what} came back in a shape this page does not recognise ` +
            `(${first.path.join('.') || 'the file'}: ${first.message}). ` +
            `A file in /data has changed and the build needs looking at.`,
        })
        return
      }

      setState({ status: 'ready', data: parsed.data })
    })()

    return () => {
      live = false
    }
  }, [path, schema, what])

  return state
}
