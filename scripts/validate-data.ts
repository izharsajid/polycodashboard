/** Fails the build on bad data. Runs in CI and before every local build. */
import { readFileSync } from 'node:fs'
import { Ledger, PoTracker, Statements } from '../src/lib/schema'
import { reconcileTracker } from '../src/lib/engine/po-tracker'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const problems: string[] = []

const ledger = Ledger.parse(read('../data/polyco-ledger.json'))
const statements = Statements.parse(read('../data/monthly-funding-statements.json'))
const poTracker = PoTracker.parse(read('../data/po-tracker.json'))

const s = ledger.summary
const computed =
  Math.round(
    (s.total_received -
      s.total_delivered -
      s.pos_pending_to_deliver -
      s.containers_ready_next_month -
      s.containers_in_process_following_month) * 100,
  ) / 100

if (computed !== s.uncovered_advance) {
  problems.push(`Uncovered advance ${computed} does not match the stated ${s.uncovered_advance}`)
}

for (const st of statements.statements) {
  const total = Math.round(st.lines.reduce((a, l) => a + l.amount, 0) * 100) / 100
  if (Math.abs(total - st.stated_total) >= 0.01) {
    problems.push(`Statement ${st.id} foots to ${total} against a stated ${st.stated_total}`)
  }
}

const recon = reconcileTracker(poTracker, ledger)
console.log(
  `PO tracker: ${poTracker.row_count} orders pulled ${poTracker.pulled_at.slice(0, 10)}, ` +
    `${recon.exact.length} matched, ${recon.suffixOnly.length} on base number, ` +
    `${recon.trackerOnly.length} tracker only, ${recon.ledgerOnly.length} ledger only`,
)

const flagged = ledger.rows.filter((r) => r.flags.length).length
console.log(`Ledger: ${ledger.rows.length} rows, ${flagged} carrying flags`)
console.log(`Statements: ${statements.statements.length}, all footing to their lines`)
console.log(`Uncovered advance: ${computed.toLocaleString('en-US')}`)

if (problems.length) {
  console.error('\nData validation failed:')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log('Data validation passed.')
