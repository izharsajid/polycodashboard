/**
 * Prints an invitation or reset link for an address, for local testing only.
 *
 *   npm run issue:link -- someone@ecofibre.bh
 *   npm run issue:link -- someone@ecofibre.bh reset
 *
 * The whole point of the design is that a raw token is never recoverable from the
 * datastore, only its SHA-256, so there is no way to read a real link back out.
 * That is correct, and it also makes the invitation flow impossible to exercise on
 * a laptop while nothing is being emailed. This mints a fresh one and shows it.
 *
 * **It refuses to run against Netlify Blobs.** Without NETLIFY_BLOBS_LOCAL_DIR it
 * stops, so it cannot be pointed at the real store to hand out access.
 */
import { issueToken } from '../netlify/lib/invitations'
import { getUserByEmail } from '../netlify/lib/users'

function stop(message: string): never {
  console.error(`\n${message}\n`)
  process.exit(1)
}

async function main() {
  if (!process.env.NETLIFY_BLOBS_LOCAL_DIR) {
    stop(
      'This only works against a local store. Set NETLIFY_BLOBS_LOCAL_DIR.\n' +
        'It will not mint a link against the real datastore, by design.',
    )
  }

  const email = process.argv[2]
  const purpose = process.argv[3] === 'reset' ? 'reset' : 'invitation'
  if (!email) stop('Give it an address: npm run issue:link -- someone@ecofibre.bh')

  const user = await getUserByEmail(email)
  if (!user) stop(`There is no account for ${email}.`)

  const { token, invitation } = await issueToken({
    email: user.email,
    role: user.role,
    purpose,
    invitedBy: null,
  })

  const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:8899'
  const page = purpose === 'invitation' ? 'invite' : 'reset'

  console.log(`\n  ${base}/${page}#${token}`)
  console.log(`\n  for ${user.email}, expires ${invitation.expiresAt}\n`)
}

main().catch((error) => {
  stop(`Could not issue a link: ${error instanceof Error ? error.message : 'unknown error'}`)
})
