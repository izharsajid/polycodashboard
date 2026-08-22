/**
 * The check that has to pass before Netlify's site-wide password comes off.
 *
 *   npm run preflight                          # against netlify dev
 *   npm run preflight https://your-site.app    # against the real thing
 *
 * AUTH-SPEC section 10, gate 9: confirm every route is guarded before that step,
 * not after. This asks every route without a session and fails if any of them
 * answers with anything other than a refusal.
 *
 * Read only. It signs nothing in, creates nothing and sends nothing, so it is
 * safe to run against production as often as you like.
 *
 * If something in front of the app is answering, notably Netlify's own site-wide
 * password, it says so and reports nothing as verified. See the note on
 * answeredByApp below for why a partial result would be worse than none.
 */
const base = (process.argv[2] ?? 'http://localhost:8899').replace(/\/+$/, '')

/**
 * Attached to every request. Netlify's site password sets a cookie once you have
 * entered it; copy that cookie here to check a site while it is still protected.
 *
 *   PREFLIGHT_COOKIE='nf_jwt=...' npm run preflight https://your-site.app
 */
const passThrough = process.env.PREFLIGHT_COOKIE

type Check = {
  method: string
  path: string
  /** Anything else is a failure. */
  expected: number[]
  note: string
}

const CHECKS: Check[] = [
  { method: 'GET', path: '/api/data', expected: [401], note: 'the figures' },
  { method: 'GET', path: '/api/users', expected: [401], note: 'the user list' },
  { method: 'GET', path: '/api/audit', expected: [401], note: 'the audit log' },
  { method: 'GET', path: '/api/auth/me', expected: [401], note: 'who am I' },
  { method: 'POST', path: '/api/auth/password', expected: [401], note: 'change own password' },
  { method: 'POST', path: '/api/users/invite', expected: [401], note: 'invite someone' },
  { method: 'PATCH', path: '/api/users/some-id', expected: [401], note: 'change a role' },
  { method: 'POST', path: '/api/auth/logout', expected: [200], note: 'sign out, always fine' },
  // Open by design, and each refuses on its own terms.
  { method: 'POST', path: '/api/auth/login', expected: [400, 401, 429], note: 'sign in' },
  { method: 'POST', path: '/api/auth/forgot', expected: [200, 400, 429], note: 'ask for a reset' },
  { method: 'POST', path: '/api/auth/reset', expected: [400, 410], note: 'use a reset link' },
  { method: 'POST', path: '/api/invitations/validate', expected: [400, 410], note: 'check a link' },
  { method: 'POST', path: '/api/invitations/accept', expected: [400, 410], note: 'accept a link' },
]

/** Anything from /data that must never come back without a session. */
const LEDGER_MARKERS = /source_row|uncovered_advance|proforma_ref|delivered_value/
/** Section 2 of BUILD-SPEC. None of this belongs anywhere in the project. */
const FORBIDDEN = /salary|salaries|payroll|\bwage|gross margin|contribution margin|cost per tonne|overdraft|HBTF/i

/**
 * Did this app answer, or did something in front of it?
 *
 * Every response the API produces is JSON. Netlify's site-wide password answers
 * 401 with an HTML page, and any other gateway would look similarly unlike us.
 *
 * This distinction is the difference between a result and a false one. A gate
 * that returns 401 to everything makes seven of these checks appear to pass while
 * proving nothing: they would look identical against an app with no guards at
 * all. So a run with anything in front of it reports nothing as verified.
 */
function answeredByApp(res: Response, body: string): boolean {
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) return false
  try {
    JSON.parse(body)
    return true
  } catch {
    return false
  }
}

function describeGate(res: Response): string {
  if (res.headers.has('www-authenticate')) return 'a password prompt'
  if ((res.headers.get('content-type') ?? '').includes('text/html')) return 'an HTML page'
  return 'something that is not this API'
}

type Verdict = 'ok' | 'fail' | 'blocked'

async function main() {
  console.log(`\nChecking ${base}${passThrough ? ' (with PREFLIGHT_COOKIE)' : ''}\n`)

  const counts: Record<Verdict, number> = { ok: 0, fail: 0, blocked: 0 }
  let gate = ''

  for (const check of CHECKS) {
    let res: Response
    let body: string
    try {
      res = await fetch(`${base}${check.path}`, {
        method: check.method,
        headers: {
          'content-type': 'application/json',
          ...(passThrough ? { cookie: passThrough } : {}),
        },
        body: check.method === 'GET' ? undefined : '{}',
      })
      body = await res.text()
    } catch {
      counts.fail++
      console.log(`  FAIL     ${check.method.padEnd(5)} ${check.path.padEnd(30)} could not reach it`)
      continue
    }

    let verdict: Verdict
    let why: string

    if (!answeredByApp(res, body)) {
      verdict = 'blocked'
      why = `${res.status} from ${describeGate(res)}`
      gate ||= describeGate(res)
    } else if (!check.expected.includes(res.status)) {
      verdict = 'fail'
      why = `got ${res.status}, wanted ${check.expected.join(' or ')}`
    } else if (LEDGER_MARKERS.test(body) || FORBIDDEN.test(body)) {
      verdict = 'fail'
      why = `${res.status}, but the body carried something it should not`
    } else {
      verdict = 'ok'
      why = String(res.status)
    }

    counts[verdict]++
    const mark = { ok: 'ok  ', fail: 'FAIL', blocked: 'blocked' }[verdict]
    console.log(`  ${mark.padEnd(8)} ${check.method.padEnd(5)} ${check.path.padEnd(30)} ${why}  (${check.note})`)
  }

  console.log('')

  if (counts.blocked > 0) {
    console.error(
      `BLOCKED. ${counts.blocked} of ${CHECKS.length} routes were answered by ${gate}, not by this app.`,
    )
    console.error('')
    console.error('Nothing here has been verified, including the checks that appear to pass.')
    console.error('A gate that refuses everything makes a guarded app and an unguarded one')
    console.error('look exactly alike, so those passes are not evidence of anything.')
    console.error('')
    console.error('If that is Netlify\'s site-wide password, it is doing its job. To get a')
    console.error('real result, one of:')
    console.error('  locally      netlify dev, then npm run preflight')
    console.error('  through it   PREFLIGHT_COOKIE=\'<cookie from the password page>\' npm run preflight <url>')
    console.error('  after it     remove the site password, then run this straight away')
    console.error('')
    process.exit(2)
  }

  if (counts.fail > 0) {
    console.error(
      `${counts.fail} check${counts.fail === 1 ? '' : 's'} failed. Do not remove the site password.\n`,
    )
    process.exit(1)
  }

  console.log(`All ${counts.ok} routes refused an unauthenticated caller, and none of them leaked.\n`)
  console.log('Still to confirm by hand, see AUTH-SPEC.md section 11:')
  console.log('  - a member cannot reach an admin endpoint')
  console.log('  - the audit log holds a full sign-in, invite, accept and role change')
  console.log('  - the four seeded accounts are still invited, with no token issued\n')
}

main().catch((error) => {
  console.error(`\nCould not run the check: ${error instanceof Error ? error.message : 'unknown'}\n`)
  process.exit(1)
})
