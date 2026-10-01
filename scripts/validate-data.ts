/** Fails the build on bad data. Runs in CI and before every local build. */
import { readFileSync } from 'node:fs'
import { buildModel } from '../src/engine/funds'
import { buildStatement } from '../src/engine/statement'
import { LedgerDisputes, StatementRules, Workbook } from '../src/engine/statementSchema'
import { FundsRequested } from '../src/engine/schema'
import { MachinePlan, buildMachines } from '../src/engine/machines'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))

try {
  // Parsing checks the shape. Building the model checks the rest: every
  // statement's lines, less any income, foot to its own stated total. A failure
  // throws with the statement named.
  const data = FundsRequested.parse(read('../data/funds-requested.json'))
  const today = new Date().toISOString().slice(0, 10)
  const model = buildModel(data, today)

  console.log(
    `Funds requested: ${model.statements.length} statements, ` +
      `${model.statements.flatMap((s) => s.lines).length} lines, all footing`,
  )
  console.log(`Requests: ${model.requestCount}, excluded: ${model.excluded.map((s) => s.id).join(', ') || 'none'}`)
  console.log(model.headline)

  // The statement workbook as issued, read without efdashboard.com. Building
  // it proves every row parses; the discrepancies are reported, not fatal,
  // because the workbook is kept exactly as issued.
  const statement = buildStatement(
    Workbook.parse(read('../data/polyco-statement.json')),
    null,
    [],
    LedgerDisputes.parse(read('../data/ledger-disputes.json')),
    StatementRules.parse(read('../data/statement-rules.json')),
  )
  console.log(
    `Statement workbook: ${statement.lines.length} rows, ${statement.discrepancies.length} discrepancies ` +
      `before efdashboard.com is read, ${statement.unresolved.length} movements without a confirmed date`,
  )

  // The forming plan: shape, and every run's dates in order.
  const plan = MachinePlan.parse(read('../data/machine-plan.json'))
  for (const m of plan.machines) {
    for (const r of m.runs) {
      if (r.from && r.until && r.from > r.until) throw new Error(`${m.name}: ${r.product} ends before it starts`)
    }
  }
  const machines = buildMachines(plan, null)
  console.log(`Machine plan: ${machines.machines.length} machines, ${machines.months[0]} to ${machines.months.at(-1)}`)
} catch (error) {
  console.error('\nData validation failed:')
  console.error(`  - ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
