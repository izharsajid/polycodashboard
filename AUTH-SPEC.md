# Authentication and access control
## Build specification — add to the EcoFibre x Polyco dashboard

This is a new phase. Read it alongside `BUILD-SPEC.md` and `CLAUDE.md`. It introduces a
backend; everything before this was static.

---

## 1. Who uses this and what they can do

Two roles.

**Administrator** — Izhar Sajid (izhar@ecofibre.bh) and Hamza Sajid (hamza@ecofibre.bh).
Full access. Can edit data, invite anyone, change any user's role, deactivate a user, and
read the audit log.

**Member** — everyone else, including the Polyco team. Full read access to every tab and
every figure. Can download and export. Can invite colleagues from a permitted email
domain. Cannot edit data, cannot change roles, cannot read the audit log.

Seeded at first deploy, as members:

- samuel.story-taylor@polycohealthline.com
- andy.blewett@polycohealthline.com
- jack.prichard@polycohealthline.com

**Create these accounts but send nothing.** All three are seeded with status `invited`
and no password. No invitation is generated and no email leaves the system until Izhar
says so, which will be after the dashboard is finished and reviewed. The accounts exist so
the user list, the role model and the admin panel can be built and tested against real
addresses; the people themselves learn nothing until they are invited.

The same applies to hamza@ecofibre.bh. Only izhar@ecofibre.bh is seeded `active` at
first deploy, with a password set directly through a one-off script run locally, never
committed and never emailed.

Permitted invite domains: `polycohealthline.com` and `ecofibre.bh`. A member may invite
an address at their own domain only. An administrator may invite any address. An invite to
a domain outside the permitted list is refused, and the refusal is logged.

**EcoFibre and Polyco operate on a fully transparent basis.** Members see the same figures
administrators see. There is no redacted view and no hidden tab. The only exception is
section 2.

---

## 2. The one thing that is never shown

**Individual salaries and any named person's pay.**

Staff cost appears as a monthly total, exactly as it has appeared on the Financial
Overview statements Polyco has received since June 2025. Per-person pay is personal data
belonging to the employee, not commercial information belonging to EcoFibre, and it is not
ours to disclose to a third party under Bahrain's Personal Data Protection Law.

This is not a restriction on Polyco. It applies to every user of the system, including
administrators, in every view. Individual pay is not in `/data`, is not in the database,
and is not rendered anywhere.

If a future data file would carry per-person pay, it does not go in this repository.

---

## 3. Stack

Keep the existing front end. Add:

- **Netlify Functions v2** for the API, under `netlify/functions/`, declaring routes with
  `export const config = { path: "/api/..." }` in the `.mts` file, not in `netlify.toml`
- **Netlify Blobs** for the datastore — users, invitations, sessions, audit log. No
  external database in this phase. Supabase was considered and set aside: it earns its
  place when you need SSO, magic links, MFA or a relational schema, and for five users
  with a flat audit log it adds a second service, a second set of keys and a third-party
  dependency inside a deploy that already handles this. Revisit only if the user count
  grows well beyond a handful or SSO becomes a requirement.
- **Argon2id** for password hashing. Never store or log a password in any form.
- HTTP-only, `Secure`, `SameSite=Strict` session cookies. No tokens in localStorage.

Environment variables must be set as **standard variables**, not secrets, with scopes
`['builds', 'functions', 'runtime']` and context `all`. Variables marked
`envVarIsSecret: true` do not reach functions at runtime in this setup.

Remove Netlify's site-wide password protection once this ships — this replaces it.

---

## 4. First sign-in, and why there are no default passwords

Do not create default passwords and send them out. A password sent by email or WhatsApp
sits in an inbox indefinitely, survives every forward of that thread, and is a shared
secret that no one can prove was never seen by anyone else.

Instead:

1. An administrator adds an email address, or a member invites a colleague at their own
   domain.
2. The system generates a single-use invitation token, valid for 7 days.
3. The person receives a link. It opens a page where they set their own password.
4. The token is consumed on use. It cannot be replayed.
5. If it expires, they request a new one; the old token is dead either way.

The outcome you asked for — people sign in and set their own password — with no password
ever existing in a message. Same convenience, no shared secret.

Password rules: minimum 12 characters, checked against a common-password list, no
composition rules and no forced rotation. Length beats complexity, and forced rotation
produces worse passwords, not better ones.

Password reset follows the same path: single-use token, 1 hour, consumed on use. The
response is identical whether or not the address exists, so the endpoint cannot be used to
discover who has an account.

---

## 5. The API

All under `/api`. Every response is JSON. Every error is generic to the caller and
specific in the log.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | anyone | email and password, sets session cookie |
| POST | `/api/auth/logout` | signed in | clears session |
| GET | `/api/auth/me` | signed in | current user and role |
| POST | `/api/auth/password` | signed in | change own password, requires current password |
| POST | `/api/auth/forgot` | anyone | send reset link, always returns 200 |
| POST | `/api/auth/reset` | anyone | consume reset token, set new password |
| GET | `/api/invitations/:token` | anyone | validate token, return email only |
| POST | `/api/invitations/:token/accept` | anyone | set password, activate account |
| GET | `/api/users` | signed in | list users, names and roles, no pay data |
| POST | `/api/users/invite` | member, admin | invite an address; members restricted to own domain |
| PATCH | `/api/users/:id` | admin | change role, deactivate, reactivate |
| GET | `/api/audit` | admin | audit log, paginated, filterable |

**Rate limits**, by IP and by account: login 10 per 15 minutes, forgot-password 5 per
hour, invitations 20 per day per user. On breach, return 429 and log it.

**Lockout:** 10 consecutive failed logins locks an account for 15 minutes. Log the lock
and the unlock.

---

## 6. Data model

Netlify Blobs, one store per collection.

```
users:{id}
  id, email (lowercased), name, role: 'admin' | 'member',
  passwordHash, status: 'invited' | 'active' | 'deactivated',
  createdAt, createdBy, lastLoginAt, failedAttempts, lockedUntil

invitations:{token}
  token (256-bit, crypto random), email, invitedBy, role,
  createdAt, expiresAt, consumedAt

sessions:{id}
  id (256-bit), userId, createdAt, expiresAt, ip, userAgent

audit:{timestamp}:{id}
  timestamp, actorId, actorEmail, action, target, detail, ip, result
```

Sessions expire after 12 hours idle, 7 days absolute. Changing a password invalidates
every other session for that user.

Store emails lowercased and compare lowercased, or the same person will end up with two
accounts.

---

## 7. Audit log

Not because anyone is distrusted. Because in six months somebody will ask when a figure
changed and who changed it, and the answer needs to exist.

Log every one of these, success or failure: sign-in, sign-out, failed sign-in, lockout,
password change, password reset requested, password reset completed, invitation sent,
invitation accepted, invitation refused for a disallowed domain, role changed, user
deactivated or reactivated, any data edit, any export or download, and every rate-limit
breach.

Each entry records who, what, when, from which IP, and the outcome. Entries are
append-only. There is no delete endpoint. Retain 24 months.

Never log a password, a session token, or an invitation token. Log the fact, not the
secret.

---

## 8. Front end

- **`/login`** — email and password, a forgot-password link, nothing else. No hint about
  whether an address exists.
- **`/invite/:token`** — shows the invited email, takes a new password twice, activates
  the account, signs them in.
- **`/reset/:token`** — same shape.
- **`/account`** — change own password, see own last sign-in.
- **`/admin`** — administrators only. User list with role and status, invite form, role
  controls, and the audit log with filters by user, action and date.
- **Header** — signed-in user's name, their role, and a sign-out control on every page.

Everything else requires a session. An unauthenticated request to any tab redirects to
`/login` and returns there after sign-in.

The admin route must be protected **server side**. Hiding a link in the interface is not
access control; every admin endpoint checks the role on the server, every time.

---

## 9. Rules

- Never store, log or transmit a password in plain text.
- Never put a session or invitation token in a URL that gets logged, in localStorage, or
  in an error message.
- Every state-changing endpoint verifies the session and the role server side. No
  exceptions, no client-side-only checks.
- Errors returned to the caller are generic. Detail goes to the log.
- Validate and normalise every input at the boundary with Zod, as `/data` already is.
- No individual pay data enters the database, the API, or the interface. See section 2.
- Tests for: an unauthenticated request to a protected route, a member attempting an admin
  action, an invitation to a disallowed domain, a consumed token replayed, an expired
  token, and a locked account. Each must fail correctly and appear in the audit log.

---

## 10. Sequence

Stop for review at each gate.

1. Blobs schemas, Zod validation, Argon2id hashing, session handling. No UI.
2. Auth endpoints, with tests. No UI.
3. Login page, session guard, header. Sign in as one seeded administrator end to end.
4. Invitation flow, both directions. Build and test it end to end against a scratch
   address. Seed the three Polyco addresses and Hamza as `invited` with no password and no
   email sent. Nothing goes out until Izhar releases it.
5. Account page and password change.
6. Admin panel: user list, roles, invitations.
7. Audit log: write everywhere, then the admin view.
8. Rate limits, lockout, and the security tests in section 9.
9. Remove Netlify site-wide password protection. Confirm every route is guarded before
   this step, not after.

---

## 11. Before going live

- Confirm no route is reachable without a session.
- Confirm a member cannot reach any admin endpoint by calling it directly.
- Confirm the audit log captures a full sign-in, invite, accept and role change.
- Confirm no individual pay data appears anywhere in the database or the interface.
- Confirm no invitation has been sent. The four seeded accounts should still show status
  `invited` with no token issued.

**Releasing access, when Izhar decides the dashboard is ready.** Invite Hamza first and
have him sign in, so the second administrator account is proven before anyone external
touches it. Then invite the three Polyco addresses individually, not as one message to all
three. Watch the audit log for the first sign-in of each.
