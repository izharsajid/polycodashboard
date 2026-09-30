import { describe, expect, it } from 'vitest'
import dataHandler from '../../functions/data.mts'
import { FundsRequested } from '../../../src/engine/schema'
import { get, post } from './helpers'

const data = (req: Request) => dataHandler(req)

describe('GET /api/data', () => {
  it('serves the statements to anyone, and they still parse', async () => {
    const res = await data(get('/api/data'))
    expect(res.status).toBe(200)
    const funds = FundsRequested.parse((await res.json()).funds)
    expect(funds.statements.length).toBe(14)
  })

  it('asks every cache not to keep a copy and every crawler not to list it', async () => {
    const res = await data(get('/api/data'))
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it('refuses the wrong method', async () => {
    expect((await data(post('/api/data', {}))).status).toBe(405)
  })
})
