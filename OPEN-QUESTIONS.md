# Open questions

Blocking Phase B. Nothing here blocks Tabs 1 to 3.

## Access and disclosure

- [x] Resolved 22 August 2026, by Izhar. `AUTH-SPEC.md` stands. One site, one build, one
      set of figures, every signed-in user seeing all of them, with individual pay the
      only exclusion and it applies to everyone. `src/redaction`, the `VITE_MODE` split
      and the partner build are retired. See `BUILD-SPEC.md` section 3.
- [ ] Display names for the three Polyco addresses and for Hamza. The user record carries
      a name and it is shown in the header and the admin list. Needed at gate 4, not
      before.
- [x] Resolved 22 August 2026. The figures were compiled into the public JavaScript
      bundle, where the session guard could not reach them, because `src/App.tsx` imported
      the two `/data` files at build time. They now come from `GET /api/data`, which the
      tabs fetch once the session resolves. Verified twice: the built bundle carries no
      ledger content, only Zod field names, and the endpoint returns 401 with nothing in
      the body when called without a session.
- [x] Resolved 22 August 2026. Invitation and reset links carry the token in the fragment,
      as `/invite#token`, not in the path. A fragment is never sent to the server, so the
      token stays out of the access log and out of the referrer. `AUTH-SPEC.md` section 8
      updated to match.
- [ ] Which sender address do invitation and reset links come from, and is its domain
      verified with Resend yet? Resend is wired in at `netlify/lib/delivery-resend.ts` and
      held shut: it needs `RESEND_API_KEY`, an `EMAIL_FROM` on a verified domain, and
      `PUBLIC_BASE_URL`, and it sends nothing at all unless `EMAIL_SENDING_ENABLED` is
      exactly `true`. All four are unset. Gate 4 cannot be tested end to end against a
      scratch address until the first three exist.

## Machines and capacity
- [ ] How many machines exist on site, how many running, how many installed but idle?
- [ ] Practical output per machine in units and kg per hour; cycle time; cavities; uptime %
- [ ] Operators required per machine per shift, and the shift pattern at each configuration
- [ ] Which moulds are available, and which products can be run today?
- [ ] Cases per container and units per case, by SKU

## Cost by configuration
- [ ] Direct headcount at 1–2, 3–4, 5–6 and 7–8 machines
- [ ] Which costs continue during a temporary shutdown, and which stop
- [ ] One-off cost to stop, one-off cost to restart, restart lead time in weeks

## Roadmap
- [ ] Sequence from today's machine count to eight: what is added at each step
- [ ] Investment and lead time per step
- [ ] Sustained monthly order volume that triggers each step
- [ ] Physical ceiling of the Hidd site

## Polyco
- [ ] Read-only Supabase key for the efdashboard PO tracker
- [ ] Which open POs are paid as new cash and which draw down the existing advance
- [ ] Finished goods on the floor: quantity, value, PO allocation
- [ ] Pipeline to 31 December from Polyco

## Parked exceptions
See BUILD-SPEC.md section 8a. None block the build; all must be resolved before anything
is issued to Polyco.
