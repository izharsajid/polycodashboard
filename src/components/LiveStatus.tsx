import { TrackerPayload } from '../data/schemas'
import { useApiData } from '../data/useApiData'
import { clock } from '../lib/format'

/**
 * How fresh the efdashboard.com data is, in the header: a green dot and the
 * time it was read, or a muted note while it loads or when it cannot be read.
 * Shares the one copy every tab uses, so it costs no extra request.
 */
export default function LiveStatus() {
  const state = useApiData('/api/tracker', TrackerPayload, 'PO tracker')
  const ready = state.status === 'ready'
  return (
    <span className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-sheet/15 bg-sheet/5 px-3 text-small font-semibold text-sheet/80" aria-live="polite">
      <span className="relative flex h-2 w-2" aria-hidden>
        {ready && <span className="absolute inline-flex h-full w-full rounded-full bg-cat-compliance opacity-60 motion-safe:animate-ping-slow" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${ready ? 'bg-cat-compliance' : state.status === 'failed' ? 'bg-marking' : 'bg-sheet/40'}`} />
      </span>
      {ready ? (
        <span>
          Live from efdashboard.com <span className="hidden text-sheet/60 sm:inline">· read {clock(state.data.fetched_at)}</span>
        </span>
      ) : state.status === 'failed' ? (
        'efdashboard.com not reachable'
      ) : (
        'Connecting to efdashboard.com'
      )}
    </span>
  )
}
