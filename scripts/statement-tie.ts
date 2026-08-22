/**
 * Prints the statement reconciliation: opening plus movement equals closing, and
 * the unfiltered closing tied back to the ledger summary and to Tab 1.
 *
 *   npm run statement:tie
 *
 * The same functions the tab will use, so if this prints it, the page shows it.
 */
import ledgerRaw from '../data/polyco-ledger.json'
import { Ledger } from '../src/lib/schema'
import { round2 } from '../src/lib/engine'
import { statementTie, statementView } from '../src/lib/engine/statement'

const ledger = Ledger.parse(ledgerRaw)

const money = (v: number) =>
  v < 0
    ? `(${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 })})`
    : v.toLocaleString('en-US', { minimumFractionDigits: 2 })

const line = (label: string, value: string) => `  ${label.padEnd(38)}${value.padStart(16)}`
const rule = () => `  ${'-'.repeat(54)}`

const view = statementView(ledger)
const tie = statementTie(ledger)
const last = view.entries[view.entries.length - 1]

console.log('\nUNFILTERED STATEMENT')
console.log(line('Opening balance', money(view.opening)))
console.log(line('Movement in period', money(view.movement)))
console.log(rule())
console.log(line('Closing balance', money(view.closing)))
console.log(line('Balance on the last row', money(last.balance)))
console.log(line('opening + movement = closing', String(view.closing === round2(view.opening + view.movement))))

console.log('\nTIE TO THE LEDGER SUMMARY')
console.log(line('Total received from Polyco', money(ledger.summary.total_received)))
console.log(line('Less total delivered', money(-ledger.summary.total_delivered)))
console.log(rule())
console.log(line('Received less delivered', money(tie.receivedLessDelivered)))
console.log(line('Statement closing balance', money(tie.closing)))
console.log(line('agree', String(tie.tiesToLedgerSummary)))

console.log('\nTIE TO TAB 1')
console.log(line('Statement closing balance', money(tie.closing)))
console.log(line('Less open orders and containers made', money(-tie.orderCover)))
console.log(rule())
console.log(line('Advance not yet covered', money(round2(tie.closing - tie.orderCover))))
console.log(line('Tab 1 headline figure', money(tie.uncoveredAdvance)))
console.log(line('agree', String(tie.tiesToTab1)))

console.log('\nCOMPOSITION')
console.log(line('Ledger rows', String(ledger.rows.length)))
console.log(line('Statement entries', String(view.entries.length)))
console.log(line('Undated, carried at the end', `${view.undated.length} = ${money(view.undatedTotal)}`))
console.log(line('Dates not yet confirmed', String(view.unconfirmedDates)))
console.log('')
