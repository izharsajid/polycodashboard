import type { Movement } from '../../engine/ledger'
import { amount } from '../../lib/format'
import { describe } from './describe'

/**
 * Every movement whose date is missing or disputed, with the reason in the
 * ledger's own terms. None is placed in a month; all count in the closing
 * balance, so nothing is dropped and nothing is guessed.
 */
export default function UnresolvedTable({ movements }: { movements: Movement[] }) {
  const sorted = [...movements].sort((a, b) => a.sourceRow - b.sourceRow || a.kind.localeCompare(b.kind))
  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">Movements with a date not yet agreed</caption>
      <thead>
        <tr>
          <th scope="col" className="th pl-0">Movement</th>
          <th scope="col" className="th hidden md:table-cell">Why it is unresolved</th>
          <th scope="col" className="th text-right">US$</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((m) => (
          <tr key={m.key}>
            <th scope="row" className="td pl-0 text-left font-normal">
              <span className="font-semibold">{m.dateStatus === 'disputed' ? 'Date disputed' : 'No date'}</span>
              <span className="block">{describe(m)}</span>
              <span className="block text-small text-press-2">Workbook row {m.sourceRow}</span>
              <span className="mt-1 block text-small text-press-2 md:hidden">{m.dateNote}</span>
            </th>
            <td className="td hidden text-press-2 md:table-cell">{m.dateNote}</td>
            <td className="td num whitespace-nowrap text-right">
              {m.kind === 'receipt' ? amount(m.cents) : amount(-m.cents)}
              <span className="block text-small text-press-2">{m.kind === 'receipt' ? 'received' : 'delivered'}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
