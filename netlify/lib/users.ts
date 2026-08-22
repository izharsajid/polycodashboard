import { STORES } from './config'
import { kv } from './kv'
import { Email, User, type RoleT, type UserStatusT, type UserT } from './schema'
import { newId } from './tokens'

const users = () => kv(STORES.users)

export async function getUser(id: string): Promise<UserT | null> {
  const raw = await users().get(id)
  return raw ? User.parse(raw) : null
}

/** Sorted by email so the admin user list has a stable order without sorting twice. */
export async function listUsers(): Promise<UserT[]> {
  const keys = await users().keys()
  const raw = await Promise.all(keys.map((key) => users().get(key)))
  return raw
    .filter((r) => r !== null)
    .map((r) => User.parse(r))
    .sort((a, b) => a.email.localeCompare(b.email))
}

/**
 * There is no email index. With a handful of users a scan is one list and one
 * read each, and it keeps exactly the four stores AUTH-SPEC section 6 names
 * rather than adding a fifth that can drift out of step with this one. Revisit if
 * the user count ever grows past a page.
 */
export async function getUserByEmail(email: string): Promise<UserT | null> {
  const wanted = Email.safeParse(email)
  if (!wanted.success) return null
  const all = await listUsers()
  return all.find((u) => u.email === wanted.data) ?? null
}

export type NewUser = {
  email: string
  name: string
  role: RoleT
  /** Defaults to 'invited'. Nobody is created active except through the seed script. */
  status?: UserStatusT
  createdBy?: string | null
  passwordHash?: string | null
}

/**
 * Throws on a duplicate address. The caller decides what the outside world hears:
 * an invite endpoint must not turn this into "that person already has an account".
 */
export async function createUser(input: NewUser, now = new Date()): Promise<UserT> {
  const user = User.parse({
    id: newId(),
    email: input.email,
    name: input.name,
    role: input.role,
    passwordHash: input.passwordHash ?? null,
    status: input.status ?? 'invited',
    createdAt: now.toISOString(),
    createdBy: input.createdBy ?? null,
    lastLoginAt: null,
    failedAttempts: 0,
    lockedUntil: null,
  })

  if (await getUserByEmail(user.email)) {
    throw new Error('A user with that email address already exists')
  }
  if (!(await users().create(user.id, user))) {
    throw new Error('User id collision')
  }
  return user
}

export async function saveUser(user: UserT): Promise<UserT> {
  const parsed = User.parse(user)
  await users().put(parsed.id, parsed)
  return parsed
}
