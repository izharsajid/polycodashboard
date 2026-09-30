/**
 * Sets the first administrator's password. Run locally, once.
 *
 *   npm run seed:admin
 *
 * AUTH-SPEC section 1: only izhar@ecofibre.bh is seeded active at first deploy,
 * with a password set through a script run locally, never committed and never
 * emailed. So the password is typed at this prompt and nowhere else. It is not an
 * argument, because arguments land in shell history and in the process list, and
 * not an environment variable, because those end up in files.
 *
 * Needs NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN to reach the real datastore from
 * a laptop. Inside a function Netlify provides them; here it does not.
 */
import { createInterface } from 'node:readline'
import { stdin, stdout } from 'node:process'
import { record } from '../netlify/lib/audit'
import { checkPassword, hashPassword } from '../netlify/lib/password'
import { createUser, getUserByEmail, saveUser } from '../netlify/lib/users'

const EMAIL = 'izhar@ecofibre.bh'
const NAME = 'Izhar Sajid'

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

/** Same as ask, with nothing echoed back to the terminal. */
function askHidden(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true })
  const muted = rl as unknown as { output: { write: (chunk: string) => void } }
  const write = muted.output.write.bind(muted.output)
  let hiding = false

  muted.output.write = (chunk: string) => {
    if (!hiding) write(chunk)
  }

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      hiding = false
      write('\n')
      rl.close()
      resolve(answer)
    })
    hiding = true
  })
}

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
        'Both come from the Netlify project settings.\n\n' +
        'To work locally instead, set NETLIFY_BLOBS_LOCAL_DIR and run netlify dev\n' +
        'with the same value. See .env.example.',
    )
  }

  const existing = await getUserByEmail(EMAIL)
  if (existing) {
    console.log(`\n${EMAIL} already exists, as ${existing.role}, status ${existing.status}.`)
    const answer = await ask('Set a new password for that account? (yes/no) ')
    if (answer.trim().toLowerCase() !== 'yes') stop('Nothing changed.')
  } else {
    console.log(`\nCreating ${EMAIL} as an active administrator.`)
  }

  const password = await askHidden('New password (at least 12 characters): ')
  const again = await askHidden('Again: ')

  if (password !== again) stop('Those did not match. Nothing changed.')

  const verdict = checkPassword(password, { email: EMAIL, name: NAME })
  if (!verdict.ok) stop(`${verdict.reason} Nothing changed.`)

  const passwordHash = await hashPassword(password)
  const user = existing ?? (await createUser({ email: EMAIL, name: NAME, role: 'admin' }))

  await saveUser({
    ...user,
    role: 'admin',
    status: 'active',
    passwordHash,
    failedAttempts: 0,
    lockedUntil: null,
  })

  await record({
    action: 'password_changed',
    result: 'success',
    actorId: user.id,
    actorEmail: EMAIL,
    detail: existing
      ? 'administrator password reset by the local seed script'
      : 'first administrator seeded by the local seed script',
  })

  console.log(`\nDone. ${EMAIL} is an active administrator.`)
  console.log('The password was not written anywhere except as an Argon2id hash.\n')
}

main().catch((error) => {
  // The message, never the cause object: a thrown value from deeper down could
  // have a password or a token sitting on it.
  stop(`Could not seed the administrator: ${error instanceof Error ? error.message : 'unknown error'}`)
})
