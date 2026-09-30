import type { StatementKindT } from '../../engine/schema'
import { kindLabel } from '../../engine/funds'

/**
 * The statement kind as a stamp, drawn the way the chart draws it: a solid edge
 * for a request, a hatched block for a request carrying actuals, a dashed edge
 * for actuals. The distinction executives most often get wrong, so it is never
 * carried by colour alone.
 */
export default function KindStamp({ kind }: { kind: StatementKindT }) {
  const edge = kind === 'actuals' ? 'border-dashed border-press-2 text-press-2' : 'border-press text-press'
  return (
    <span className={`inline-flex items-center gap-1.5 border-2 px-2 py-0.5 text-small font-bold uppercase tracking-wide ${edge}`}>
      {kind === 'request_with_actuals' && (
<span aria-hidden className="hatch-utilised inline-block h-2.5 w-2.5 bg-press" />
      )}
      {kindLabel(kind)}
    </span>
  )
}
