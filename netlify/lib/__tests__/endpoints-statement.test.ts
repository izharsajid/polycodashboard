import { beforeEach, describe, expect, it } from 'vitest'
import poDocument from '../../functions/po-document.mts'
import statement from '../../functions/statement.mts'
import entriesEndpoint from '../../functions/statement-entries.mts'
import { useMemoryStores } from '../kv'
import { ctx, get, seedUser, sessionFor } from './helpers'

const IZHAR = 'izhar@ecofibre.bh'
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://dashboard.ecofibre.bh${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  })

const payment = {
  action: 'create',
  entry: {
    kind: 'payment', date: '2026-09-30', amount: 1000, invoiceKind: null, po: null, row: null, field: null,
    reference: 'TT-1', description: 'Funds received from Polyco',
  },
}

beforeEach(async () => {
  useMemoryStores()
  await seedUser({ email: IZHAR, name: 'Izhar Sajid', role: 'admin' })
})

const signedIn = () => sessionFor(IZHAR)
const create = async (entry: Record<string, unknown>) =>
  entriesEndpoint(post('/api/statement/entries', { action: 'create', entry: { ...payment.entry, ...entry } }, await signedIn()), ctx())

describe('editing the statement', () => {
  it('refuses anyone not signed in, and records nothing', async () => {
    expect((await entriesEndpoint(post('/api/statement/entries', payment), ctx())).status).toBe(401)
    const body = await (await statement(get('/api/statement'))).json()
    expect(body.entries).toHaveLength(0)
  })

  it('records a change signed in, stamped with the account name, not a name the page sends', async () => {
    const res = await entriesEndpoint(post('/api/statement/entries', { ...payment, entry: { ...payment.entry, by: 'Someone else' } }, await signedIn()), ctx())
    expect(res.status).toBe(201)
    const body = await (await statement(get('/api/statement'))).json()
    expect(body.entries[0].by).toBe('Izhar Sajid')
  })

  it('lets anyone read the statement', async () => {
    expect((await statement(get('/api/statement'))).status).toBe(200)
  })

  it('voids a change without deleting it', async () => {
    const created = await (await create({})).json()
    const res = await entriesEndpoint(post('/api/statement/entries', { action: 'void', id: created.entry.id, reason: 'recorded twice' }, await signedIn()), ctx())
    expect(res.status).toBe(200)
    const body = await (await statement(get('/api/statement'))).json()
    expect(body.entries[0].voided.reason).toBe('recorded twice')
  })
})

describe('fixing a discrepancy', () => {
  it('records a resolution only when it names its discrepancy', async () => {
    expect((await create({ kind: 'resolution', amount: 0, key: 'broken-serials', description: 'Noted' })).status).toBe(201)
    expect((await create({ kind: 'resolution', amount: 0, description: 'Noted' })).status).toBe(400)
  })

  it('records a date fix only with a real date', async () => {
    expect((await create({ kind: 'correction', row: 150, field: 'received_date', value: '2026-02-11', amount: 0 })).status).toBe(201)
    expect((await create({ kind: 'correction', row: 150, field: 'received_date', value: 'soon', amount: 0 })).status).toBe(400)
  })

  it('adds a missing PO only when it names the PO', async () => {
    expect((await create({ kind: 'correction', row: null, field: 'po_amount', po: '2679969', amount: 40000 })).status).toBe(201)
    expect((await create({ kind: 'correction', row: null, field: 'po_amount', po: null, amount: 40000 })).status).toBe(400)
  })
})

describe('PO files from efdashboard.com', () => {
  it('refuses anything but a PO number and a plain filename', async () => {
    const bad = (q: string) => poDocument(get(`/api/po-document?${q}`))
    expect((await bad('po=../x&file=a.pdf')).status).toBe(400)
    expect((await bad('po=2679713&file=../../etc/passwd')).status).toBe(400)
  })
})
