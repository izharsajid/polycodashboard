import { useMemo } from 'react'
import { buildTracker, type Tracker } from '../engine/tracker'
import type { LineUsageRowT } from '../engine/trackerSchema'
import { TrackerPayload } from './schemas'
import { useApiData } from './useApiData'

/** efdashboard.com's PO tracker, live, built with its own rules. */
export function useTracker(): { tracker: Tracker | null; lineUsage: LineUsageRowT[]; error: string | null; loading: boolean } {
  const state = useApiData('/api/tracker', TrackerPayload, 'PO tracker')
  const tracker = useMemo(() => (state.status === 'ready' ? buildTracker(state.data) : null), [state])
  return {
    tracker,
    lineUsage: state.status === 'ready' ? state.data.line_usage : [],
    error: state.status === 'failed' ? state.error : null,
    loading: state.status === 'loading',
  }
}
