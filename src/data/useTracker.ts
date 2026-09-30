import { useMemo } from 'react'
import { buildTracker, type Tracker } from '../engine/tracker'
import { TrackerPayload } from './schemas'
import { useApiData } from './useApiData'

/** efdashboard.com's PO tracker, live, built with its own rules. */
export function useTracker(): { tracker: Tracker | null; error: string | null; loading: boolean } {
  const state = useApiData('/api/tracker', TrackerPayload, 'PO tracker')
  const tracker = useMemo(() => (state.status === 'ready' ? buildTracker(state.data) : null), [state])
  return {
    tracker,
    error: state.status === 'failed' ? state.error : null,
    loading: state.status === 'loading',
  }
}
