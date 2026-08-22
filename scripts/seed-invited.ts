/**
 * Creates the four accounts that exist so the user list, the role model and the
 * admin panel can be built and tested against real addresses.
 *
 *   npm run seed:invited
 *
 * AUTH-SPEC section 1: seeded with status `invited` and no password. **No
 * invitation is generated and no email leaves the system.** This script issues no
 * token, so there is nothing that could be sent even by accident, and the people
 * themselves learn nothing until Izhar releases access. See section 11 for the
 * order that happens in.
 *
 * Safe to run twice. An account that already exists is left exactly as it is.
 */
import { record } from '../netlify/lib/audit'
import type { RoleT } from '../netlify/lib/schema'
import { createUser, getUserByEmail } from '../netlify/lib/users'

/**
 * Names given by Izhar on 22 August 2026. They are not derived from the email
 * addresses and must not be: an address is a mailbox, not a person, and guessing
 * at capitalisation and hyphens off the local part gets somebody's name wrong in
 * the header of a dashboard their own company is reading.
 *
 * A name that needs correcting is one edit in the admin panel.
 */
const ACCOUNTS: { email: string; name: string; role: RoleT }[] = [
  { email: 'hamza@ecofibre.bh', name: 'Hamza Sajid', role: 'admin' },
  { email: 'samuel.story-taylor@polycohealthline.com', name: 'Samuel Story-Taylor', role: 'member' },
  { email: 'andy.blewett@polycohealthline.com', name: 'Andy Blewett', role: 'member' },
  { email: 'jack.prichard@polycohealthline.com', name: 'Jack Prichard', role: 'member' },
]

const SEEDER = 'izhar@ecofibre.bh'

function stop(message: string): never {
  console.error(`\n${message}\n`)
  process.exit(1)
}

async function main() {
  const remote =
    process.env.NETLIFY_SITE_ID &&
    (process.env.NETLIFY_BLOBS_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN)

  if (!remote && !process.env.NETLIFY_BLOBS_LOCAL_DIR) {
    stop(
      'Set NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN first, or this writes nowhere.\n' +
        'To work locally instead, set NETLIFY_BLOBS_LOCAL_DIR. See .env.example.',
    )
  }

  const seeder = await getUserByEmail(SEEDER)
  if (!seeder) stop(`Run npm run seed:admin first, so ${SEEDER} exists to own these.`)

  console.log('')
  for (const account of ACCOUNTS) {
    const existing = await getUserByEmail(account.email)
    if (existing) {
      console.log(`  ${account.email} already exists, status ${existing.status}. Left alone.`)
      continue
    }

    const user = await createUser({
      email: account.email,
      name: account.name,
      role: account.role,
      status: 'invited',
      createdBy: seeder.id,
    })

    await record({
      action: 'user_created',
      result: 'success',
      actorId: seeder.id,
      actorEmail: seeder.email,
      target: user.email,
      detail: `seeded as ${user.role}, invited, no token issued and nothing sent`,
    })

    console.log(`  ${account.email} created as ${account.role}, invited, no password.`)
  }

  console.log('\nNo invitation token was issued and no email was sent.')
  console.log('Release access when you are ready. See AUTH-SPEC.md section 11.\n')
}

main().catch((error) => {
  stop(`Could not seed the accounts: ${error instanceof Error ? error.message : 'unknown error'}`)
})
