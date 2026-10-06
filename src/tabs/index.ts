import { lazy, type ComponentType } from 'react'
import FundsRequestedTab from './funds-requested/FundsRequestedTab'
import StatementTab from './statement/StatementTab'
import TrackerTab from './tracker/TrackerTab'
import MachinesTab from './machines/MachinesTab'

/** The 3D plant pulls in three.js, so it loads only when someone opens it. */
const PlantTab = lazy(() => import('./plant/PlantTab'))

/**
 * The dashboard's tabs, in order. Each tab loads its own data and owns its own
 * page, so adding one is an entry here and nothing else. BRIEF-TAB1 section 1:
 * an Inventory tab follows.
 */
export type Tab = { id: string; label: string; Component: ComponentType }

export const TABS: readonly Tab[] = [
  { id: 'funds-requested', label: 'Funds requested', Component: FundsRequestedTab },
  { id: 'statement', label: 'PHL/EcoFibre statement', Component: StatementTab },
  { id: 'po-tracker', label: 'PO tracker', Component: TrackerTab },
  { id: 'machines', label: 'Machines', Component: MachinesTab },
  { id: 'plant', label: 'Plant 3D', Component: PlantTab },
]
