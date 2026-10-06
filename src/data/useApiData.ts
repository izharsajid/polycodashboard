import { useCallback, useEffect, useState } from 'react'
import type { z } from 'zod'
import { cached, load } from './cache'

/**
 * Fetch one endpoint and validate it with Zod on receipt. CLAUDE.md: every
 * business number loads from /data and is validated at load. A shape mismatch
 * stops the tab with the field that failed, rather than rendering a blank where
 * a figure should be.
 */
export type ApiState<T> = (
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'failed'; error: string }
) & {
  /** Fetch again, keeping what is on screen until the new data arrives. */
  reload: () => void
}

type Loaded<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'failed'; error: string }

export function useApiData<S extends z.ZodTypeAny>(path: string, schema: S, what: string): ApiState<z.infer<S>> {
  const check = useCallback(
    (data: unknown): Loaded<z.infer<S>> => {
      const parsed = schema.safeParse(data)
      if (parsed.success) return { status: 'ready', data: parsed.data }
      const first = parsed.error.issues[0]
      return {
        status: 'failed',
        error:
          `The ${what} came back in a shape this page does not recognise ` +
          `(${first.path.join('.') || 'the file'}: ${first.message}). ` +
          `A file in /data has changed and the build needs looking at.`,
      }
    },
    [schema, what],
  )
  // Whatever another tab already fetched is on screen at once.
  const [state, setState] = useState<Loaded<z.infer<S>>>(() => {
    const hit = cached(path)
    return hit?.ok ? check(hit.data) : { status: 'loading' }
  })
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let live = true
    void load(path, { force: version > 0 }).then((result) => {
      if (!live) return
      if (result.ok) setState(check(result.data))
      // A failed refresh leaves the last good copy on screen.
      else setState((s) => (s.status === 'ready' ? s : { status: 'failed', error: result.error }))
    })
    return () => {
      live = false
    }
  }, [path, check, version])

  return { ...state, reload }
}
