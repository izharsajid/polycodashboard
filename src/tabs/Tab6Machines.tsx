import { Factory } from 'lucide-react'
import Gantt from '../components/Gantt'
import { machineFinding } from '../lib/engine/findings'
import type { LedgerT, MachineScheduleT, PoTrackerT } from '../lib/schema'
import { dateProse } from '../lib/format'
import { Finding, SectionHead } from '../components/ui'

/**
 * What each machine is running, when it stops, and what that leaves.
 * CAPACITY-SPEC.
 *
 * The tab shows what runs and when. What it costs and what it produces is a
 * different tab and stays unbuilt until the output rates, headcount and
 * cases-per-container arrive: section 5 is explicit that none of it may be
 * estimated in the meantime.
 */
export default function Tab6Machines({
  schedule,
  ledger,
}: {
  schedule: MachineScheduleT
  ledger: LedgerT
  tracker: PoTrackerT
}) {
  const finding = machineFinding(schedule)

  return (
    <section>
      <SectionHead
        icon={<Factory size={19} className="text-ink-50" aria-hidden />}
        kicker="Machine schedule"
        title="What runs, and when it stops"
        lede="Every machine here comes off because its purchase orders run out, not because a mould comes off or a decision has been taken."
        asAt={`Schedule as at ${dateProse(schedule.as_at)}`}
      />

      <Finding>{finding.sentence}</Finding>

      <Gantt schedule={schedule} ledger={ledger} />
    </section>
  )
}
