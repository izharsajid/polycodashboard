/**
 * The seam where a link would leave the system, and the reason it currently does
 * not.
 *
 * AUTH-SPEC section 1 is explicit: no invitation is generated and no email leaves
 * the system until Izhar says so. Section 3 lists the stack and there is no mail
 * provider in it. So the default handler does nothing at all. A token is issued,
 * the fact is recorded, and the link goes nowhere.
 *
 * That is a decision, not an unfinished edge. When a provider is chosen it is
 * wired in here, in one place, and no endpoint changes. Until then the flows can
 * be built and tested end to end without any risk of something reaching a real
 * inbox by accident.
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

const nothingLeaves: (delivery: Delivery) => Promise<void> = async () => {}

let handler = nothingLeaves

export async function deliver(delivery: Delivery): Promise<void> {
  await handler(delivery)
}

/** Tests install a capture here. A real provider is wired in the same way. */
export function onDeliver(next: (delivery: Delivery) => Promise<void>): void {
  handler = next
}

export function resetDelivery(): void {
  handler = nothingLeaves
}
