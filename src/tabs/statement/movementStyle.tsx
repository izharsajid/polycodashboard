import { Banknote, Ship, Truck, type LucideIcon } from 'lucide-react'
import type { Movement } from '../../engine/ledger'

/** An icon for each kind of movement: goods out, a recharge, money in. */
export function movementIcon(m: Movement): LucideIcon {
  if (m.kind === 'receipt') return Banknote
  return m.rowType === 'recharge' ? Ship : Truck
}
