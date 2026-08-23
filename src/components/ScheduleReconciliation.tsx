import { useState } from 'react'
import type { LedgerT, MachineScheduleT, PoTrackerT } from '../lib/schema'
import { reconcileSchedule, scheduledPos } from '../lib/engine/machines'
import { dateProse, money } from '../lib/format'

/**
 * The schedule against the ledger and the tracker. CAPACITY-SPEC section 4.
 *
 * A standing output rather than a one-off report, because it has already found
 * real gaps. Three lists, each with its count and its total, and each headed with
 * what it means rather than what it is: two of the three are expected conditions
 * and only one of them is a gap. Flagging a normal operating pattern trains a
 * reader to ignore the flags that matter.
 */
const product = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim()

export default function ScheduleReconciliation({
  schedule,
  ledger,
  tracker,
}: {
  schedule: MachineScheduleT
  ledger: LedgerT
  tracker: PoTrackerT
}) {
  const recon = reconcileSchedule(schedule, ledger, tracker)
  const derived = scheduledPos(schedule).filter((po) => po.basis === 'derived')
  const derivedRefs = new Set(derived.map((po) => po.ref))
  const notInLedger = recon.foundInTracker.length + recon.foundInNeither.length

  return (
    <div className="mt-6 page-break">
      {/* Both directions in one line. A heading that says only "every order on
          the schedule is accounted for" sits directly above a list of nine
          orders with no machine, and reads as a contradiction of it. */}
      <h3 className="subtitle">
        {recon.ordersWithNoMachine.length} pending orders have no machine
        {recon.foundInNeither.length === 0
          ? ', and every order on the schedule is in the ledger or the tracker'
          : `, and ${recon.foundInNeither.length} on the schedule are in neither`}
      </h3>
      <p className="lede mt-1 max-w-prose">
        Checked on every load, against both sources.{' '}
        {derivedRefs.size > 0 && (
          <>
            {derivedRefs.size} of the purchase order assignments below were derived by matching
            product rather than taken from the production schedule, and every one of them is
            marked.
          </>
        )}
      </p>

      <NoMachine recon={recon} />
      <NotInLedger recon={recon} count={notInLedger} asAt={ledger.summary.as_at} />
      <MultiMachine recon={recon} />

      {recon.matchedOnBaseNumber.length > 0 && (
        <p className="mt-3 text-label text-ink-50">
          {recon.matchedOnBaseNumber.length} matched on the base number rather than the full
          reference:{' '}
          {recon.matchedOnBaseNumber.map((m) => `${m.ref} to ${m.ledgerRef}`).join(', ')}. The two
          systems write the suffix differently.
        </p>
      )}
    </div>
  )
}

type Recon = ReturnType<typeof reconcileSchedule>

/**
 * Pending orders on no machine. Shown with the total and not raised as an alarm:
 * section 4 records that these are being worked through separately.
 */
function NoMachine({ recon }: { recon: Recon }) {
  return (
    <section className="mt-4">
      <h4 className="text-body font-medium text-ink">
        {recon.ordersWithNoMachine.length} pending orders sit on no machine, worth{' '}
        {money(recon.ordersWithNoMachineValue)}
      </h4>
      <p className="lede">
        Open in the ledger with no campaign against them. Being worked through separately, so
        this is a list rather than an exception to act on here.
      </p>

      <div className="overflow-x-auto print:overflow-visible">
      <table className="mt-2 w-full min-w-[520px] max-w-4xl text-table">
        <thead>
          <tr className="border-b border-rule text-left">
            <th className="eyebrow py-1 pr-2">Purchase order</th>
            <th className="eyebrow py-1 pr-2">Product</th>
            <th className="eyebrow py-1 pr-2 text-right">PO amount</th>
            <th className="eyebrow py-1">Known reason</th>
          </tr>
        </thead>
        <tbody>
          {recon.ordersWithNoMachine.map((order) => (
            <tr key={order.row.source_row} className="border-b border-rule-soft align-top">
              <td className="py-1 pr-2 num whitespace-nowrap text-ink">{order.row.po_number}</td>
              <td className="py-1 pr-2 text-ink-70">{product(order.row.product)}</td>
              <td className="py-1 pr-2 text-right num whitespace-nowrap">{money(order.value)}</td>
              <td className="py-1 text-label text-ink-70">{order.reason ?? ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-rule">
            <td className="py-1 pr-2 text-label text-ink-70" colSpan={2}>
              {recon.ordersWithNoMachine.length} orders
            </td>
            <td className="py-1 pr-2 text-right num font-medium">
              {money(recon.ordersWithNoMachineValue)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
      </div>
    </section>
  )
}

/**
 * Schedule orders the ledger does not carry, split by whether the tracker
 * explains them. Only the second list is a real gap, and section 4 is explicit
 * that the first must not be assumed to explain all of them.
 */
function NotInLedger({ recon, count, asAt }: { recon: Recon; count: number; asAt: string }) {
  const [open, setOpen] = useState(false)

  return (
    <section className="mt-4">
      <h4 className="text-body font-medium text-ink">
        {count} orders on the schedule are not in the ledger
      </h4>
      <p className="lede">
        The statement is as at {dateProse(asAt)}, so an order placed since will not be in it. Checked
        against the tracker one by one before calling any of them missing.
      </p>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
        <p className="text-body text-ink">
          <span className="num font-medium">{recon.foundInTracker.length}</span> found in the
          tracker
          {recon.foundInTracker.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="btn-text ml-1 no-print"
            >
              {open ? 'Hide' : 'Show'}
            </button>
          )}
        </p>
        <p className={`text-body ${recon.foundInNeither.length > 0 ? 'text-critical' : 'text-ink'}`}>
          <span className="num font-medium">{recon.foundInNeither.length}</span> found in neither.
          {recon.foundInNeither.length === 0 && (
            <span className="text-ink-50"> Nothing unaccounted for.</span>
          )}
        </p>
      </div>

      {recon.foundInNeither.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-l-2 border-critical pl-2">
          {recon.foundInNeither.map((entry) => (
            <li key={entry.po.ref} className="text-body text-ink">
              <span className="num">{entry.po.ref}</span> on {entry.po.machineId},{' '}
              {entry.po.product}. In no system but the schedule.
            </li>
          ))}
        </ul>
      )}

      {/* Always rendered, hidden on screen until asked for. Section 6: the
          reconciliation never silently drops a row, and paper has no control to
          click. */}
      <div className={`overflow-x-auto print:overflow-visible ${open ? '' : 'hidden print:block'}`}>
        <table className="mt-2 w-full min-w-[520px] max-w-4xl text-table">
          <thead>
            <tr className="border-b border-rule text-left">
              <th className="eyebrow py-1 pr-2">Purchase order</th>
              <th className="eyebrow py-1 pr-2">Machine</th>
              <th className="eyebrow py-1 pr-2">Campaign</th>
              <th className="eyebrow py-1">What the tracker calls it</th>
            </tr>
          </thead>
          <tbody>
            {recon.foundInTracker.map((entry) => (
              <tr key={entry.po.ref} className="border-b border-rule-soft align-top">
                <td className="py-1 pr-2 num whitespace-nowrap text-ink">{entry.po.ref}</td>
                <td className="py-1 pr-2 whitespace-nowrap text-ink-70">{entry.po.machineId}</td>
                <td className="py-1 pr-2 text-ink-70">{entry.po.product}</td>
                <td className="py-1 text-ink-70">{product(entry.trackerOrder!.product)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * One order on two machines. Expected, not an error: a single purchase order can
 * carry several SKUs and those run at once. Headed as a condition and never
 * flagged.
 */
function MultiMachine({ recon }: { recon: Recon }) {
  if (recon.multiMachine.length === 0) return null

  return (
    <section className="mt-4">
      <h4 className="text-body font-medium text-ink">
        {recon.multiMachine.length} orders run on more than one machine
      </h4>
      <p className="lede">
        Expected. One purchase order can carry several SKUs, and those run at once on different
        machines. Listed so the machine count is not read as a double count.
      </p>

      <div className="overflow-x-auto print:overflow-visible">
      <table className="mt-2 w-full min-w-[460px] max-w-4xl text-table">
        <thead>
          <tr className="border-b border-rule text-left">
            <th className="eyebrow py-1 pr-2">Purchase order</th>
            <th className="eyebrow py-1">Runs on</th>
          </tr>
        </thead>
        <tbody>
          {recon.multiMachine.map((entry) => (
            <tr key={entry.ref} className="border-b border-rule-soft align-top">
              <td className="py-1 pr-2 num whitespace-nowrap text-ink">{entry.ref}</td>
              <td className="py-1 text-ink-70">
                {entry.machines.map((m) => `${m.id}, ${m.product}`).join('   ·   ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  )
}
