import type { Movement } from '../../engine/ledger'

/** A movement in words: what it was and what it refers to, from the ledger as recorded. */
export function describe(m: Movement): string {
  const what =
    m.kind === 'receipt'
      ? m.rowType === 'receipt'
        ? 'Payment received'
        : m.rowType === 'recharge'
          ? 'Payment against recharge'
          : 'Payment against PO'
      : m.rowType === 'recharge'
        ? 'Recharge'
        : 'Delivery'
  const detail = [m.ref, m.product].filter(Boolean).join(', ')
  return detail ? `${what}: ${detail}` : what
}
