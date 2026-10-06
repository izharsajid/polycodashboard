import { lazy, type ComponentType } from 'react'
import FundsRequestedTab from './funds-requested/FundsRequestedTab'
import StatementTab from './statement/StatementTab'
import TrackerTab from './tracker/TrackerTab'
import MachinesTab from './machines/MachinesTab'
import InventoryTab from './inventory/InventoryTab'

/** The 3D plant pulls in three.js, so it loads only when someone opens it. */
const loadPlant = () => import('./plant/PlantTab')
const PlantTab = lazy(loadPlant)

/**
 * The dashboard's tabs, in order. Each tab loads its own data and owns its own
 * page, so adding one is an entry here and nothing else.
 */
export type Tab = {
  id: string
  label: string
  Component: ComponentType
  /** Start downloading a heavy tab when the reader points at it. */
  preload?: () => void
}

export const TABS: readonly Tab[] = [
  { id: 'funds-requested', label: 'Funds requested', Component: FundsRequestedTab },
  { id: 'statement', label: 'PHL/EcoFibre statement', Component: StatementTab },
  { id: 'po-tracker', label: 'PO tracker', Component: TrackerTab },
  { id: 'machines', label: 'Machines', Component: MachinesTab },
  { id: 'inventory', label: 'Inventory', Component: InventoryTab },
  { id: 'plant', label: 'Plant 3D', Component: PlantTab, preload: () => void loadPlant() },
]
