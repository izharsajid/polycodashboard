import type { Delivery } from './delivery'

/**
 * Resend, over plain fetch.
 *
 * No SDK: it would be another package in every function bundle for the sake of
 * one POST, and AUTH-SPEC section 3 turned down a whole second service for less
 * than that.
 *
 * **Nothing is sent unless `EMAIL_SENDING_ENABLED` is exactly `true`.** That is
 * the switch, and it is deliberately separate from having a key. AUTH-SPEC
 * section 1 says nothing leaves the system until Izhar releases it, and a release
 * should be one decision somebody makes on purpose, not a side effect of a key
 * arriving in the environment.
 *
 * Set as standard variables, not secrets, per AUTH-SPEC section 3: variables
 * marked secret do not reach functions at runtime in this setup.
 *
 *   RESEND_API_KEY          the key. Never committed, never logged.
 *   EMAIL_FROM              a verified sender on a domain verified with Resend.
 *   PUBLIC_BASE_URL         where the links point. Falls back to Netlify's URL.
 *   EMAIL_SENDING_ENABLED   'true', and only 'true', lets an email leave.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export type EmailReadiness =
  | { ready: true; apiKey: string; from: string; baseUrl: string }
  | { ready: false; reason: string }

export function emailReadiness(env: NodeJS.ProcessEnv = process.env): EmailReadiness {
  if (env.EMAIL_SENDING_ENABLED !== 'true') {
    return { ready: false, reason: 'sending is switched off' }
  }
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) return { ready: false, reason: 'no RESEND_API_KEY' }

  const from = env.EMAIL_FROM
  if (!from) return { ready: false, reason: 'no EMAIL_FROM' }

  const baseUrl = env.PUBLIC_BASE_URL ?? env.URL
  if (!baseUrl) return { ready: false, reason: 'no PUBLIC_BASE_URL' }

  return { ready: true, apiKey, from, baseUrl: baseUrl.replace(/\/+$/, '') }
}

/**
 * Where the link points.
 *
 * The token sits in the fragment, after the `#`, and not in the path. A browser
 * never sends a fragment to the server, so the token stays out of Netlify's
 * access log, out of the referrer header of whatever the page loads next, and out
 * of anything sitting in front of the site. In the path it would be in all three,
 * which is the same reason the API endpoints take it in a body.
 *
 * The page still reads it perfectly well from `location.hash`.
 */
export function linkFor(delivery: Delivery, baseUrl: string): string {
  const page = delivery.kind === 'invitation' ? 'invite' : 'reset'
  return `${baseUrl}/${page}#${delivery.token}`
}

function body(delivery: Delivery, link: string): { subject: string; text: string } {
  if (delivery.kind === 'invitation') {
    return {
      subject: 'Your access to the EcoFibre and Polyco dashboard',
      text: [
        'You have been given access to the EcoFibre and Polyco position dashboard.',
        '',
        'Open the link below to choose your own password. It works once and expires',
        'in seven days. Nobody, including us, can see the password you set.',
        '',
        link,
        '',
        'If you were not expecting this, ignore it and the link will lapse.',
      ].join('\n'),
    }
  }
  return {
    subject: 'Reset your dashboard password',
    text: [
      'Someone asked to reset the password on this address.',
      '',
      'Open the link below to set a new one. It works once and expires in one hour.',
      '',
      link,
      '',
      'If that was not you, ignore this. Your current password still works and',
      'nothing has changed.',
    ].join('\n'),
  }
}

/**
 * Returns whether an email actually went. The caller records the fact, never the
 * token, and never the key.
 */
export async function sendViaResend(
  delivery: Delivery,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ sent: boolean; reason?: string }> {
  const readiness = emailReadiness(env)
  if (!readiness.ready) return { sent: false, reason: readiness.reason }

  const { subject, text } = body(delivery, linkFor(delivery, readiness.baseUrl))

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${readiness.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: readiness.from, to: [delivery.email], subject, text }),
  })

  if (!res.ok) {
    // The status, not the response body: an upstream error message is somebody
    // else's format and could carry back anything we sent it.
    return { sent: false, reason: `Resend returned ${res.status}` }
  }
  return { sent: true }
}
