/** Fails the build on bad data. Runs in CI and before every local build. */
import { readFileSync } from 'node:fs'
import { buildModel } from '../src/engine/funds'
import { FundsRequested } from '../src/engine/schema'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))

try {
  // Parsing checks the shape. Building the model checks the rest: every line
  // classifies into exactly one category, and every statement foots to its own
  // stated total. Either failure throws with the statement and line named.
  const data = FundsRequested.parse(read('../data/funds-requested.json'))
  const today = new Date().toISOString().slice(0, 10)
  const model = buildModel(data, today)

  console.log(
    `Funds requested: ${model.statements.length} statements, ` +
      `${model.statements.flatMap((s) => s.lines).length} lines, all footing and all classified`,
  )
  console.log(`Requests: ${model.requestCount}, excluded: ${model.excluded.map((s) => s.id).join(', ') || 'none'}`)
  console.log(model.headline)
} catch (error) {
  console.error('\nData validation failed:')
  console.error(`  - ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
