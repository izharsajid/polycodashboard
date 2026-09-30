import { sendViaResend } from './delivery-resend'

/**
 * The seam where a link leaves the system, and the reason none currently does.
 *
 * The provider is Resend. It is wired in and it is shut: an email leaves only
 * when `EMAIL_SENDING_ENABLED` is `true`, which nothing sets. AUTH-SPEC section 1
 * says nothing goes out until Izhar releases it, so the release is one switch
 * somebody throws on purpose rather than a consequence of a deploy or of a key
 * turning up in the environment.
 *
 * Until then a token is issued, the fact is recorded, and the link goes nowhere.
 * The flows can be built and tested end to end with no risk of anything reaching
 * a real inbox.
 *
 * The handler receives the raw token, because a link cannot be built without one.
 * It must never write that token to the audit log, to the console, or to any
 * store. Log the fact, not the secret.
 */
export type Delivery = {
  kind: 'invitation' | 'reset'
  email: string
  token: string
  expiresAt: string
}

const viaProvider: (delivery: Delivery) => Promise<void> = async (delivery) => {
  await sendViaResend(delivery)
}

let handler = viaProvider

export async function deliver(delivery: Delivery): Promise<void> {
  await handler(delivery)
}

/** Tests install a capture here. A real provider is wired in the same way. */
export function onDeliver(next: (delivery: Delivery) => Promise<void>): void {
  handler = next
}

export function resetDelivery(): void {
  handler = viaProvider
}
