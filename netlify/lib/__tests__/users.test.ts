import { beforeEach, describe, expect, it } from 'vitest'
import { useMemoryStores } from '../kv'
import { createUser, getUser, getUserByEmail, listUsers, saveUser } from '../users'

const NOW = new Date('2026-08-22T09:00:00.000Z')

beforeEach(() => {
  useMemoryStores()
})

describe('users', () => {
  it('lowercases and trims the address on the way in', async () => {
    const user = await createUser(
      { email: '  Izhar@EcoFibre.BH  ', name: 'Izhar Sajid', role: 'admin' },
      NOW,
    )
    expect(user.email).toBe('izhar@ecofibre.bh')
    expect((await getUser(user.id))?.email).toBe('izhar@ecofibre.bh')
  })

  it('finds a user whatever casing the address is typed in', async () => {
    await createUser({ email: 'izhar@ecofibre.bh', name: 'Izhar Sajid', role: 'admin' }, NOW)
    expect((await getUserByEmail('IZHAR@ECOFIBRE.BH'))?.name).toBe('Izhar Sajid')
    expect(await getUserByEmail('someone@polycohealthline.com')).toBeNull()
  })

  it('refuses a second account for the same address in different casing', async () => {
    await createUser({ email: 'izhar@ecofibre.bh', name: 'Izhar Sajid', role: 'admin' }, NOW)
    await expect(
      createUser({ email: 'Izhar@Ecofibre.bh', name: 'Izhar Again', role: 'member' }, NOW),
    ).rejects.toThrow(/already exists/)
    expect(await listUsers()).toHaveLength(1)
  })

  it('creates an invited user with no password, which is how everyone starts', async () => {
    const user = await createUser(
      { email: 'hamza@ecofibre.bh', name: 'Hamza Sajid', role: 'admin' },
      NOW,
    )
    expect(user.status).toBe('invited')
    expect(user.passwordHash).toBeNull()
    expect(user.failedAttempts).toBe(0)
    expect(user.lastLoginAt).toBeNull()
  })

  it('refuses to hold an active user who has no password', async () => {
    await expect(
      createUser(
        { email: 'nobody@ecofibre.bh', name: 'No Password', role: 'member', status: 'active' },
        NOW,
      ),
    ).rejects.toThrow()
  })

  it('refuses an address that is not an address', async () => {
    await expect(
      createUser({ email: 'not-an-address', name: 'Nope', role: 'member' }, NOW),
    ).rejects.toThrow()
  })

  it('lists in email order', async () => {
    await createUser({ email: 'izhar@ecofibre.bh', name: 'Izhar Sajid', role: 'admin' }, NOW)
    await createUser({ email: 'andy.blewett@polycohealthline.com', name: 'Andy Blewett', role: 'member' }, NOW)
    await createUser({ email: 'hamza@ecofibre.bh', name: 'Hamza Sajid', role: 'admin' }, NOW)

    expect((await listUsers()).map((u) => u.email)).toEqual([
      'andy.blewett@polycohealthline.com',
      'hamza@ecofibre.bh',
      'izhar@ecofibre.bh',
    ])
  })

  it('saves a change back', async () => {
    const user = await createUser(
      { email: 'izhar@ecofibre.bh', name: 'Izhar Sajid', role: 'admin' },
      NOW,
    )
    await saveUser({ ...user, passwordHash: '$argon2id$stub', status: 'active' })

    const reloaded = await getUser(user.id)
    expect(reloaded?.status).toBe('active')
    expect(reloaded?.passwordHash).toBe('$argon2id$stub')
  })

  it('records who did the inviting', async () => {
    const admin = await createUser(
      { email: 'izhar@ecofibre.bh', name: 'Izhar Sajid', role: 'admin' },
      NOW,
    )
    const invited = await createUser(
      {
        email: 'jack.prichard@polycohealthline.com',
        name: 'Jack Prichard',
        role: 'member',
        createdBy: admin.id,
      },
      NOW,
    )
    expect(admin.createdBy).toBeNull()
    expect(invited.createdBy).toBe(admin.id)
  })
})
