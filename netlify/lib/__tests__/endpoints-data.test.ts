import { beforeEach, describe, expect, it } from 'vitest'
import data from '../../functions/data.mts'
import login from '../../functions/auth-login.mts'
import { Ledger, Statements } from '../../../src/lib/schema'
import { useMemoryStores } from '../kv'
import { saveUser } from '../users'
import { ctx, get, post, seedUser, signedIn } from './helpers'

const PASSWORD = 'brackish tundra ledger'
const IZHAR = 'izhar@ecofibre.bh'

beforeEach(() => {
  useMemoryStores()
})

const signIn = () => login(post('/api/auth/login', { email: IZHAR, password: PASSWORD }), ctx())

describe('GET /api/data', () => {
  it('refuses without a session', async () => {
    const res = await data(get('/api/data'))
    expect(res.status).toBe(401)
    // Nothing of the ledger comes back with the refusal.
    expect(await res.text()).not.toMatch(/uncovered_advance|source_row/)
  })

  it('refuses a made-up cookie', async () => {
    const res = await data(get('/api/data', { cookie: '__Host-ef_session=invented' }))
    expect(res.status).toBe(401)
  })

  it('serves both files to a signed-in user, and they still parse', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    const res = await data(get('/api/data', signedIn(await signIn())))

    expect(res.status).toBe(200)
    const body = await res.json()

    const ledger = Ledger.parse(body.ledger)
    const statements = Statements.parse(body.statements)
    expect(ledger.rows.length).toBeGreaterThan(150)
    expect(ledger.summary.uncovered_advance).toBe(1410206.34)
    expect(statements.statements.length).toBe(14)
  })

  it('is never cached, wherever it passes through', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    const res = await data(get('/api/data', signedIn(await signIn())))
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('stops the moment the account is deactivated', async () => {
    const user = await seedUser({ email: IZHAR, password: PASSWORD })
    const headers = signedIn(await signIn())
    expect((await data(get('/api/data', headers))).status).toBe(200)

    await saveUser({ ...user, status: 'deactivated' })
    expect((await data(get('/api/data', headers))).status).toBe(401)
  })

  it('refuses the wrong method', async () => {
    expect((await data(post('/api/data', {}))).status).toBe(405)
  })
})
