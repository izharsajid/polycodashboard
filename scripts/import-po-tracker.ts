/**
 * Pulls the order tracker from efdashboard's Supabase `po_data` into
 * `data/po-tracker.json`, then reconciles it against the statement ledger.
 *
 *   npm run import:po-tracker
 *
 * PO-TRACKER-SPEC section 1. The reconciliation is a standing output of every
 * import, not a one-off, because it has repeatedly found real errors.
 *
 * Needs SUPABASE_URL and SUPABASE_ANON_KEY, from a gitignored `.env` locally or
 * from the Netlify environment. The key is never printed and never written into
 * the output file.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { Ledger, PoTracker, type PoOrderT } from '../src/lib/schema'
import { reconcileTracker, trackerBegins } from '../src/lib/engine/po-tracker'

const SOURCE = 'efdashboard.com po_data'
const OUT = new URL('../data/po-tracker.json', import.meta.url)

function stop(message: string): never {
  console.error(`\n${message}\n`)
  process.exit(1)
}

/** Reads a gitignored .env so the script works from a laptop without exporting. */
function loadEnv() {
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.*)$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim()
    }
  } catch {
    // No .env is fine when the variables come from the environment.
  }
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/**
 * `11-Jul-2026` to `2026-07-11`. Anything else returns null and the original text
 * is kept, because `cargo_ready` legitimately holds things like "ON HOLD (Miami)"
 * and inventing a date for those would be worse than having none.
 */
function parseDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (!match) return null

  const month = MONTHS[match[2].toLowerCase()]
  if (month === undefined) return null

  const day = Number(match[1])
  const at = new Date(Date.UTC(Number(match[3]), month, day))
  // Reject a date that rolled over, such as 31-Feb.
  if (at.getUTCDate() !== day || at.getUTCMonth() !== month) return null

  return at.toISOString().slice(0, 10)
}

const text = (value: unknown) => String(value ?? '').trim()

type SupabaseRow = Record<string, unknown>

function toOrder(row: SupabaseRow): PoOrderT {
  const cargoReady = text(row.cargo_ready)
  const dispatched = text(row.dispatched)

  return {
    id: Number(row.id),
    row_no: text(row.row_no),
    po_number: text(row.po_number),
    product: text(row.product),
    film: text(row.film),
    rolls: text(row.rolls),
    qty: text(row.qty),
    // `shipping` is what the source calls it, but it holds the order status.
    order_status: text(row.shipping),
    cargo_ready: cargoReady,
    cargo_ready_date: parseDate(cargoReady),
    dispatched,
    dispatched_date: parseDate(dispatched),
    // `status` holds container and seal references, which read as remarks.
    remarks: text(row.status),
    is_new: Boolean(row.is_new),
    sort_order: Number(row.sort_order ?? 0),
  }
}

async function main() {
  loadEnv()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    stop(
      'Set SUPABASE_URL and SUPABASE_ANON_KEY first, in .env or the environment.\n' +
        'PO-TRACKER-SPEC section 1: this tab is blocked until a read-only key exists.',
    )
  }

  const pulledAt = new Date().toISOString()
  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/po_data?select=*&order=sort_order.asc&limit=5000`

  const res = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) {
    // The status, not the body: an upstream error message is someone else's
    // format and could carry back anything we sent it.
    stop(`Supabase returned ${res.status} ${res.statusText}.`)
  }

  const raw = (await res.json()) as SupabaseRow[]
  if (!Array.isArray(raw)) stop('Supabase returned something that is not a list of rows.')

  const orders = raw.map(toOrder)
  const tracker = PoTracker.parse({
    source: SOURCE,
    pulled_at: pulledAt,
    row_count: orders.length,
    orders,
  })

  writeFileSync(OUT, `${JSON.stringify(tracker, null, 2)}\n`)

  const ledger = Ledger.parse(
    JSON.parse(readFileSync(new URL('../data/polyco-ledger.json', import.meta.url), 'utf8')),
  )
  report(tracker, ledger)
}

function report(tracker: ReturnType<typeof PoTracker.parse>, ledger: ReturnType<typeof Ledger.parse>) {
  const recon = reconcileTracker(tracker, ledger)
  const begins = trackerBegins(tracker)

  const pad = (label: string, value: string | number) => `  ${label.padEnd(46)}${String(value).padStart(6)}`

  console.log(`\nPulled ${tracker.row_count} orders from ${SOURCE} at ${tracker.pulled_at}`)
  console.log(`Written to data/po-tracker.json`)

  console.log('\nRECONCILIATION AGAINST THE STATEMENT LEDGER')
  console.log(pad('Orders in the tracker', recon.trackerCount))
  console.log(pad('PO numbers in the ledger', recon.ledgerCount))
  console.log(pad('Matched on the same PO number', recon.exact.length))
  console.log(pad('Matched only after ignoring the -N suffix', recon.suffixOnly.length))
  console.log(pad('In the tracker, not in the ledger', recon.trackerOnly.length))
  console.log(pad('In the ledger, not in the tracker', recon.ledgerOnly.length))

  if (recon.suffixOnly.length) {
    console.log('\nSAME ORDER, DIFFERENT REFERENCE')
    console.log('  The two systems disagree about how the reference is written.')
    for (const match of recon.suffixOnly) {
      console.log(`    tracker ${match.trackerPo.padEnd(12)} ledger ${match.ledgerPo}`)
    }
  }

  if (recon.trackerOnly.length) {
    console.log('\nIN THE TRACKER, NOT IN THE LEDGER')
    for (const order of recon.trackerOnly) {
      const status = order.order_status || 'no status'
      console.log(`    ${order.po_number.padEnd(12)} ${status.padEnd(28)} ${order.product.slice(0, 34)}`)
    }
  }

  if (recon.ledgerOnly.length) {
    console.log('\nIN THE LEDGER, NOT IN THE TRACKER')
    const before = recon.ledgerOnly.filter(
      (row) => begins !== null && row.delivery_date !== null && row.delivery_date < begins,
    )
    for (const row of recon.ledgerOnly) {
      const when = row.delivery_date ?? 'no delivery date'
      console.log(`    ${(row.po_number ?? '').padEnd(12)} ${row.type.padEnd(12)} ${when}`)
    }
    if (begins) {
      console.log(
        `\n  ${before.length} of these were delivered before the tracker's first dispatch on ${begins}.`,
      )
    }
  }
  console.log('')
}

main().catch((error) => {
  stop(`Import failed: ${error instanceof Error ? error.message : 'unknown error'}`)
})
