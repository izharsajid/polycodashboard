import { STORES } from './config'
import { DocumentMeta, type DocumentMetaT } from './documents'
import { kv } from './kv'

/**
 * The statement's own records: entries (payments, invoices, corrections) and the
 * files uploaded against a workbook row, an entry or a PO. Files reuse the
 * document store, under an order id of `stmt-<target>`, so they are sniffed,
 * size-limited and kept exactly like PO documents.
 */
export const entries = () => kv(STORES.statementEntries)

export const TARGET = /^(row-\d{1,4}|entry-[A-Za-z0-9_-]{1,40}|po-[A-Za-z0-9-]{1,40})$/

/**
 * The document-store id for a statement target: `stmt-row-180`. No colon or
 * other character that would be percent-encoded in the store key; the live
 * store did not find keys holding an encoded colon.
 */
export const orderIdFor = (target: string) => `stmt-${target}`
export const targetOf = (orderId: string) => orderId.replace(/^stmt-/, '')
const PREFIX = 'stmt-'

export async function listEntries(): Promise<unknown[]> {
  const store = entries()
  const keys = await store.keys()
  const all = await Promise.all(keys.map((k) => store.get(k)))
  return all.filter((x) => x !== null)
}

export async function listStatementFiles(): Promise<DocumentMetaT[]> {
  const meta = kv(STORES.documentMeta)
  const keys = (await meta.keys()).filter((k) => k.startsWith(PREFIX))
  const all = await Promise.all(keys.map((k) => meta.get(k)))
  return all
    .map((x) => DocumentMeta.safeParse(x))
    .filter((p) => p.success && p.data.deletedAt === null)
    .map((p) => (p as { data: DocumentMetaT }).data)
}
