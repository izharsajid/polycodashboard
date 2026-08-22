import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
// Type only, and it must stay that way. Importing a value from netlify/ would
// pull server code into the browser bundle. Keeping the shape in one place means
// the interface cannot quietly disagree with what the API actually returns.
import type { PublicUser } from '../../netlify/lib/http'
import { api } from '../lib/api'

export type SessionState =
  | { status: 'loading' }
  | { status: 'out' }
  | { status: 'in'; user: PublicUser }

type SignInResult = { ok: true } | { ok: false; error: string }

type SessionValue = SessionState & {
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
  /** Called when any request comes back 401. The session is over, wherever we are. */
  expire: () => void
  /**
   * For the flows that end with the server having signed somebody in already:
   * accepting an invitation, and completing a reset. The cookie is set, so this
   * only tells the interface what the server has done.
   */
  adopt: (user: PublicUser) => void
}

const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession was called outside SessionProvider')
  return value
}

/**
 * Asks the server who the caller is, once, on load. The answer is the server's,
 * not the page's: nothing here decides whether somebody is signed in, it only
 * reports what the session cookie turned out to be worth.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  const load = useCallback(async () => {
    const result = await api.get<{ user: PublicUser }>('/api/auth/me')
    setState(result.ok ? { status: 'in', user: result.data.user } : { status: 'out' })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const result = await api.post<{ user: PublicUser }>('/api/auth/login', { email, password })
    if (!result.ok) return { ok: false, error: result.error }
    setState({ status: 'in', user: result.data.user })
    return { ok: true }
  }, [])

  const signOut = useCallback(async () => {
    await api.post('/api/auth/logout')
    // Signed out locally whatever the server said. A failed call must not leave
    // somebody looking signed in at a session that is gone.
    setState({ status: 'out' })
  }, [])

  const expire = useCallback(() => {
    setState({ status: 'out' })
  }, [])

  const adopt = useCallback((user: PublicUser) => {
    setState({ status: 'in', user })
  }, [])

  return (
    <SessionContext.Provider value={{ ...state, signIn, signOut, expire, adopt }}>
      {children}
    </SessionContext.Provider>
  )
}
