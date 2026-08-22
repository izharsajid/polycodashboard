import { useSyncExternalStore } from 'react'

/**
 * The browser half of the router. Pushes onto the history stack, tells React,
 * and listens for the back button. Everything that can be decided without a
 * window lives in router.ts.
 */
const listeners = new Set<() => void>()

function announce() {
  for (const listener of listeners) listener()
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  if (options.replace) window.history.replaceState({}, '', to)
  else window.history.pushState({}, '', to)
  announce()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  // Changing only the fragment is a same-document navigation: no reload, and no
  // popstate. Invitation and reset links live in the fragment, so without this a
  // second link opened in the same tab would leave the page showing the first
  // one's state.
  window.addEventListener('hashchange', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
    window.removeEventListener('hashchange', listener)
  }
}

const href = () => window.location.href

export function useLocation(): { path: string; search: string; hash: string } {
  const current = useSyncExternalStore(subscribe, href, href)
  const url = new URL(current)
  return { path: url.pathname, search: url.search, hash: url.hash }
}
