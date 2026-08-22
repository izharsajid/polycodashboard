import { beforeEach, describe, expect, it } from 'vitest'
import documentsEndpoint from '../../functions/documents.mts'
import orderDocuments from '../../functions/order-documents.mts'
import orders from '../../functions/orders.mts'
import login from '../../functions/auth-login.mts'
import { listAudit } from '../audit'
import { getDocument, listDocuments, saveDocument, sniff, storageKey } from '../documents'
import { useMemoryStores } from '../kv'
import { ctx, get, post, seedUser, signedIn } from './helpers'

const PASSWORD = 'brackish tundra ledger'
const IZHAR = 'izhar@ecofibre.bh'
const SAMUEL = 'samuel.story-taylor@polycohealthline.com'
/** A real PO number from the tracker. */
const ORDER = '2678631-1'

beforeEach(() => {
  useMemoryStores()
})

const signIn = (email: string) => login(post('/api/auth/login', { email, password: PASSWORD }), ctx())

const bytes = (...values: number[]) => new Uint8Array(values.slice()) as Uint8Array<ArrayBuffer>
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37)
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0)
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0)

describe('what a file actually is', () => {
  it('reads the type from the bytes', () => {
    expect(sniff(PDF, 'po.pdf')).toEqual({ ok: true, contentType: 'application/pdf' })
    expect(sniff(PNG, 'photo.png')).toEqual({ ok: true, contentType: 'image/png' })
    expect(sniff(JPEG, 'photo.jpg')).toEqual({ ok: true, contentType: 'image/jpeg' })
  })

  it('is not fooled by the filename', () => {
    // The oldest trick there is: call it a PDF and hope nobody looks.
    const executable = bytes(0x4d, 0x5a, 0x90, 0x00)
    const verdict = sniff(executable, 'invoice.pdf')

    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.reason).toMatch(/not one we take/i)
  })

  it('accepts an Office file, and refuses a plain archive wearing the same magic bytes', () => {
    expect(sniff(ZIP, 'packing-list.xlsx')).toEqual({
      ok: true,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const zip = sniff(ZIP, 'everything.zip')
    expect(zip.ok).toBe(false)
    if (!zip.ok) expect(zip.reason).toMatch(/archive/i)
  })

  it('refuses an empty file', () => {
    expect(sniff(new Uint8Array(), 'nothing.pdf').ok).toBe(false)
  })
})

describe('storage keys', () => {
  it('is built from identifiers we generated, never from the filename', () => {
    const key = storageKey('2678631-1', 'abc-123')
    expect(key).toBe('2678631-1:abc-123')
    expect(key).not.toContain('/')
  })

  it('lets no separator survive, so a reference cannot shape a path', () => {
    // `..` on its own is inert in a flat key. A slash is not, so that is what has
    // to go. The endpoint also refuses any order that is not in the tracker, so
    // this is the second line rather than the first.
    const key = storageKey('../../etc/passwd', 'abc')
    expect(key).not.toContain('/')
    expect(key).not.toContain('\\')
    expect(key.startsWith('/')).toBe(false)
    expect(key).toBe('..%2F..%2Fetc%2Fpasswd:abc')
  })
})

describe('POST /api/orders/:id/documents', () => {
  const upload = (
    orderId: string,
    file: { name: string; bytes: Uint8Array; type?: string },
    headers: Record<string, string> = {},
    group = 'purchase-order',
  ) => {
    const form = new FormData()
    form.set('group', group)
    form.set('file', new File([new Uint8Array(file.bytes).buffer as ArrayBuffer], file.name, { type: file.type ?? 'application/pdf' }))
    return orderDocuments(
      new Request(`https://dashboard.ecofibre.bh/api/orders/${orderId}/documents`, {
        method: 'POST',
        body: form,
        headers,
      }),
      { params: { id: orderId }, ip: '203.0.113.7' } as unknown as Parameters<typeof orderDocuments>[1],
    )
  }

  it('refuses without a session', async () => {
    expect((await upload(ORDER, { name: 'po.pdf', bytes: PDF })).status).toBe(401)
  })

  it('lets a Polyco member upload, which is the point of the store', async () => {
    await seedUser({ email: SAMUEL, password: PASSWORD, name: 'Samuel Story-Taylor' })
    const headers = signedIn(await signIn(SAMUEL))

    const res = await upload(ORDER, { name: 'bill-of-lading.pdf', bytes: PDF }, headers)
    expect(res.status).toBe(201)

    const { document } = await res.json()
    expect(document.uploadedByEmail).toBe(SAMUEL)
    expect(document.contentType).toBe('application/pdf')
    expect(document.deletedAt).toBeNull()
  })

  it('refuses a file whose bytes do not match what it claims to be', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, role: 'admin' })
    const headers = signedIn(await signIn(IZHAR))

    const res = await upload(ORDER, { name: 'invoice.pdf', bytes: bytes(0x4d, 0x5a, 0x90) }, headers)
    expect(res.status).toBe(415)
    expect(await listDocuments(ORDER)).toHaveLength(0)

    const [entry] = await listAudit({ action: 'document_uploaded' })
    expect(entry.result).toBe('failure')
  })

  it('refuses an order that does not exist', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, role: 'admin' })
    const headers = signedIn(await signIn(IZHAR))
    expect((await upload('9999999-9', { name: 'po.pdf', bytes: PDF }, headers)).status).toBe(404)
  })

  it('records who uploaded what, against which order', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, role: 'admin' })
    const headers = signedIn(await signIn(IZHAR))
    await upload(ORDER, { name: 'po.pdf', bytes: PDF }, headers)

    const [entry] = await listAudit({ action: 'document_uploaded' })
    expect(entry.result).toBe('success')
    expect(entry.actorEmail).toBe(IZHAR)
    expect(entry.target).toContain(ORDER)
    expect(entry.detail).toContain('po.pdf')
  })
})

describe('GET /api/documents/:id', () => {
  async function uploaded(email = IZHAR, role: 'admin' | 'member' = 'admin') {
    await seedUser({ email, password: PASSWORD, role, name: 'Someone' })
    const headers = signedIn(await signIn(email))
    const meta = await saveDocument({
      orderId: ORDER,
      group: 'delivery',
      filename: 'packing list.pdf',
      bytes: PDF,
      contentType: 'application/pdf',
      uploadedBy: 'u1',
      uploadedByEmail: email,
    })
    return { headers, meta }
  }

  const fetchDoc = (id: string, headers: Record<string, string> = {}, query = '') =>
    documentsEndpoint(
      get(`/api/documents/${id}${query}`, headers),
      { params: { id }, ip: '203.0.113.7' } as unknown as Parameters<typeof documentsEndpoint>[1],
    )

  it('serves nothing without a session', async () => {
    const { meta } = await uploaded()
    const res = await fetchDoc(meta.id)

    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('serves the bytes to a signed-in user, inline, and never caches them', async () => {
    const { headers, meta } = await uploaded()
    const res = await fetchDoc(meta.id, headers)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toBe('inline; filename="packing list.pdf"')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF)
  })

  it('sends it as an attachment when asked, and logs that separately', async () => {
    const { headers, meta } = await uploaded()
    await fetchDoc(meta.id, headers)
    await fetchDoc(meta.id, headers, '?download=1')

    expect((await listAudit({ action: 'document_viewed' }))).toHaveLength(1)
    expect((await listAudit({ action: 'document_downloaded' }))).toHaveLength(1)
  })

  it('cannot have a filename break out of the header', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, role: 'admin' })
    const headers = signedIn(await signIn(IZHAR))
    const meta = await saveDocument({
      orderId: ORDER,
      group: 'delivery',
      filename: 'evil"\r\nX-Injected: yes.pdf',
      bytes: PDF,
      contentType: 'application/pdf',
      uploadedBy: 'u1',
      uploadedByEmail: IZHAR,
    })

    const res = await fetchDoc(meta.id, headers)
    const disposition = res.headers.get('content-disposition')!
    expect(disposition).not.toContain('\r')
    expect(disposition).not.toContain('\n')
    expect(res.headers.get('x-injected')).toBeNull()
  })
})

describe('DELETE /api/documents/:id', () => {
  const remove = (id: string, headers: Record<string, string>) =>
    documentsEndpoint(
      new Request(`https://dashboard.ecofibre.bh/api/documents/${id}`, { method: 'DELETE', headers }),
      { params: { id }, ip: '203.0.113.7' } as unknown as Parameters<typeof documentsEndpoint>[1],
    )

  async function withDocument() {
    await seedUser({ email: IZHAR, password: PASSWORD, role: 'admin', name: 'Izhar Sajid' })
    await seedUser({ email: SAMUEL, password: PASSWORD, name: 'Samuel Story-Taylor' })
    const meta = await saveDocument({
      orderId: ORDER,
      group: 'purchase-order',
      filename: 'po.pdf',
      bytes: PDF,
      contentType: 'application/pdf',
      uploadedBy: 'u1',
      uploadedByEmail: SAMUEL,
    })
    return meta
  }

  it('refuses a member', async () => {
    const meta = await withDocument()
    const res = await remove(meta.id, signedIn(await signIn(SAMUEL)))

    expect(res.status).toBe(403)
    expect((await getDocument(meta.id))?.deletedAt).toBeNull()
  })

  it('lets an administrator delete, softly, and the file stays retrievable', async () => {
    const meta = await withDocument()
    const headers = signedIn(await signIn(IZHAR))

    const res = await remove(meta.id, headers)
    expect(res.status).toBe(200)

    const after = await getDocument(meta.id)
    expect(after?.deletedAt).not.toBeNull()
    expect(after?.deletedByEmail).toBe(IZHAR)

    // Section 4: a store that can lose a bill of lading without trace is not a record.
    const served = await documentsEndpoint(
      get(`/api/documents/${meta.id}`, headers),
      { params: { id: meta.id }, ip: '::1' } as unknown as Parameters<typeof documentsEndpoint>[1],
    )
    expect(served.status).toBe(200)
  })

  it('records the deletion with a name on it', async () => {
    const meta = await withDocument()
    await remove(meta.id, signedIn(await signIn(IZHAR)))

    const [entry] = await listAudit({ action: 'document_deleted' })
    expect(entry.actorEmail).toBe(IZHAR)
    expect(entry.detail).toMatch(/still retrievable/i)
  })
})

describe('GET /api/orders', () => {
  const call = (id?: string, headers: Record<string, string> = {}) =>
    orders(
      get(id ? `/api/orders/${id}` : '/api/orders', headers),
      { params: id ? { id } : {}, ip: '::1' } as unknown as Parameters<typeof orders>[1],
    )

  it('refuses without a session', async () => {
    expect((await call()).status).toBe(401)
  })

  it('serves the tracker to a signed-in user', async () => {
    await seedUser({ email: SAMUEL, password: PASSWORD })
    const res = await call(undefined, signedIn(await signIn(SAMUEL)))

    expect(res.status).toBe(200)
    expect((await res.json()).tracker.orders.length).toBe(102)
  })

  it('serves one order with its documents', async () => {
    await seedUser({ email: SAMUEL, password: PASSWORD })
    const headers = signedIn(await signIn(SAMUEL))
    await saveDocument({
      orderId: ORDER, group: 'delivery', filename: 'x.pdf', bytes: PDF,
      contentType: 'application/pdf', uploadedBy: 'u1', uploadedByEmail: SAMUEL,
    })

    const body = await (await call(ORDER, headers)).json()
    expect(body.order.po_number).toBe(ORDER)
    expect(body.documents).toHaveLength(1)
  })

  it('refuses an order that does not exist', async () => {
    await seedUser({ email: SAMUEL, password: PASSWORD })
    expect((await call('9999999-9', signedIn(await signIn(SAMUEL)))).status).toBe(404)
  })
})
