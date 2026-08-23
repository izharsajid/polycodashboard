/** Fails the build on bad data. Runs in CI and before every local build. */
import { readFileSync } from 'node:fs'
import { Ledger, MachineSchedule, PoTracker, Statements } from '../src/lib/schema'
import { reconcileTracker } from '../src/lib/engine/po-tracker'
import {
  floorBreachMonth,
  machineCountSteps,
  reconcileSchedule,
} from '../src/lib/engine/machines'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const problems: string[] = []

const ledger = Ledger.parse(read('../data/polyco-ledger.json'))
const statements = Statements.parse(read('../data/monthly-funding-statements.json'))
const poTracker = PoTracker.parse(read('../data/po-tracker.json'))
const schedule = MachineSchedule.parse(read('../data/machine-schedule.json'))

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

// CAPACITY-SPEC section 4: the reconciliation is a standing output of every run,
// not a one-off report, because it has already found real gaps.
const machines = reconcileSchedule(schedule, ledger, poTracker)
const steps = machineCountSteps(schedule)
const breach = floorBreachMonth(schedule)

for (const machine of schedule.machines) {
  const refs = machine.runs.flatMap((run) => run.purchaseOrders.map((po) => po.ref))
  if (refs.length === 0) {
    problems.push(`${machine.id} carries no purchase order on any campaign`)
  }
}

console.log(
  `Machines: ${steps.map((s) => `${s.count} from ${s.from}`).join(', ')}` +
    `${breach ? `; below the floor of ${schedule.viable_floor} in ${breach}` : ''}`,
)
console.log(
  `Schedule reconciliation: ${machines.ordersWithNoMachine.length} pending POs on no machine ` +
    `(${machines.ordersWithNoMachineValue.toLocaleString('en-US')}), ` +
    `${machines.foundInTracker.length} schedule POs in the tracker but not the ledger, ` +
    `${machines.foundInNeither.length} in neither, ` +
    `${machines.multiMachine.length} running on more than one machine, ` +
    `${machines.matchedOnBaseNumber.length} matched on base number`,
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
