import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import editor from '../../functions/editor.mts'
import poDocument from '../../functions/po-document.mts'
import statement from '../../functions/statement.mts'
import entriesEndpoint from '../../functions/statement-entries.mts'
import { useMemoryStores } from '../kv'
import { ctx, get } from './helpers'

const KEY = 'test-passcode-for-editing'
const post = (path: string, body: unknown, key?: string) =>
  new Request(`https://dashboard.ecofibre.bh${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(key ? { 'x-editor-key': key } : {}) },
  })

const payment = {
  action: 'create',
  entry: {
    kind: 'payment', date: '2026-09-30', amount: 1000, invoiceKind: null, po: null, row: null, field: null,
    reference: 'TT-1', description: 'Funds received from Polyco', by: 'Test Editor',
  },
}

beforeEach(() => {
  useMemoryStores()
  process.env.EDITOR_KEY = KEY
})
afterEach(() => {
  delete process.env.EDITOR_KEY
})

describe('editing the statement', () => {
  it('is switched off when no passcode is set', async () => {
    delete process.env.EDITOR_KEY
    expect((await entriesEndpoint(post('/api/statement/entries', payment, KEY), ctx())).status).toBe(503)
    expect((await editor(post('/api/editor', {}, KEY))).status).toBe(503)
  })

  it('refuses a wrong passcode, and records nothing', async () => {
    expect((await entriesEndpoint(post('/api/statement/entries', payment, 'wrong'), ctx())).status).toBe(401)
    const body = await (await statement(get('/api/statement'))).json()
    expect(body.entries).toHaveLength(0)
  })

  it('records a payment with the right passcode, and shows it to everyone', async () => {
    const res = await entriesEndpoint(post('/api/statement/entries', payment, KEY), ctx())
    expect(res.status).toBe(201)
    const body = await (await statement(get('/api/statement'))).json()
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0].by).toBe('Test Editor')
    expect(body.editor.enabled).toBe(true)
  })

  it('voids a change without deleting it', async () => {
    const created = await (await entriesEndpoint(post('/api/statement/entries', payment, KEY), ctx())).json()
    const res = await entriesEndpoint(post('/api/statement/entries', { action: 'void', id: created.entry.id, by: 'Test Editor', reason: 'recorded twice' }, KEY), ctx())
    expect(res.status).toBe(200)
    const body = await (await statement(get('/api/statement'))).json()
    expect(body.entries[0].voided.reason).toBe('recorded twice')
  })

  it('refuses a correction that does not say which figure', async () => {
    const correction = { action: 'create', entry: { ...payment.entry, kind: 'correction' } }
    expect((await entriesEndpoint(post('/api/statement/entries', correction, KEY), ctx())).status).toBe(400)
  })
})

describe('PO files from efdashboard.com', () => {
  it('refuses anything but a PO number and a plain filename', async () => {
    const bad = (q: string) => poDocument(get(`/api/po-document?${q}`))
    expect((await bad('po=../x&file=a.pdf')).status).toBe(400)
    expect((await bad('po=2679713&file=../../etc/passwd')).status).toBe(400)
    expect((await bad('po=2679713&file=')).status).toBe(400)
  })
})
