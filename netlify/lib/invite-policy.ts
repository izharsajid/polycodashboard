import { PERMITTED_INVITE_DOMAINS } from './config'
import { domainOf, type RoleT, type UserT } from './schema'

/**
 * Who may invite whom, as a pure function, because it is the rule most likely to
 * be got wrong quietly.
 *
 * AUTH-SPEC section 1 says two things that have to be read together: an
 * administrator may invite any address, and an invite to a domain outside the
 * permitted list is refused. The only reading where both hold is that the
 * permitted list binds everybody, and "any address" means an administrator is not
 * confined to their own domain the way a member is.
 */
export type InviteDecision =
  | { allowed: true; role: RoleT }
  | { allowed: false; reason: InviteRefusal }

export type InviteRefusal =
  | 'domain_not_permitted'
  | 'not_your_domain'
  | 'members_cannot_appoint_administrators'
  | 'inviter_not_active'

export function mayInvite(
  inviter: UserT,
  email: string,
  requestedRole: RoleT | undefined,
): InviteDecision {
  if (inviter.status !== 'active') return { allowed: false, reason: 'inviter_not_active' }

  const domain = domainOf(email)
  if (!domain || !PERMITTED_INVITE_DOMAINS.includes(domain as (typeof PERMITTED_INVITE_DOMAINS)[number])) {
    return { allowed: false, reason: 'domain_not_permitted' }
  }

  if (inviter.role === 'admin') {
    return { allowed: true, role: requestedRole ?? 'member' }
  }

  // A member invites colleagues, at their own domain, as members. Both halves
  // matter: without the second, any member could make themselves a second
  // administrator through an address they control.
  if (domain !== domainOf(inviter.email)) {
    return { allowed: false, reason: 'not_your_domain' }
  }
  if (requestedRole === 'admin') {
    return { allowed: false, reason: 'members_cannot_appoint_administrators' }
  }
  return { allowed: true, role: 'member' }
}
