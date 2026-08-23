# Open questions

Blocking Phase B. Nothing here blocks Tabs 1 to 3.

## Design system and redesign, this run

- [ ] `DESIGN-SYSTEM-SPEC.md` section 1 asks for `/mnt/skills/public/frontend-design/SKILL.md`
      and the frontend-design plugin to be read first. Neither exists on this machine, so
      the work was built from the specification itself, which is detailed enough to follow.
      If that skill carries conventions the spec does not, this run will not reflect them.
- [x] The header did not fit a 380px screen: the wordmark, name and sign-out ran to 417px
      and pushed the page sideways. The Polyco name and the role suffix are now hidden
      below the small breakpoint, and the name truncates. Verified at 378px.
- [x] Two palette values were darkened to meet the 4.5:1 body minimum section 7 sets:
      `ink-50` and `watch`. Measurements are in `DESIGN.md`.

## Access and disclosure

- [x] Resolved 22 August 2026, by Izhar. The staff cost lines in
      `monthly-funding-statements.json` are monthly totals, issued to Polyco exactly as
      they stand since June 2025, and they stay. `AUTH-SPEC.md` section 2 excludes
      individual per-person pay, which does not belong in that file and will not be added
      to it. Not a blocker on gate 9.
      One line does read `Payroll for Izhar and Hamza (5,000 each)`, which names two
      people and gives a per-person figure, unlike the `Staff Salaries` lines around it.
      Recorded here so the distinction is on the record rather than rediscovered later.
      Both named people are the administrators, and it is their own pay.

- [x] Resolved 22 August 2026, by Izhar. `AUTH-SPEC.md` stands. One site, one build, one
      set of figures, every signed-in user seeing all of them, with individual pay the
      only exclusion and it applies to everyone. `src/redaction`, the `VITE_MODE` split
      and the partner build are retired. See `BUILD-SPEC.md` section 3.
- [x] Resolved 22 August 2026, by Izhar. Display names are Hamza Sajid, Andy Blewett,
      Jack Prichard and Samuel Story-Taylor, given rather than derived from the addresses.
      Set in `scripts/seed-invited.ts`.
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

## Order tracker

- [x] Resolved 22 August 2026. Read-only Supabase key supplied and the importer works.
      `npm run import:po-tracker` pulls 102 orders from `po_data` into
      `data/po-tracker.json` and reconciles against the ledger on every run.
### Three things to fix at source in efdashboard, not to work around here

Each of these is currently handled by code on our side. That code should be temporary.
Every one of them is a disagreement between two systems about what a thing is called, and
matching around a naming problem means carrying the same exceptions forever and being
unable to tell a new error from an old one.

- [ ] **The `-N` suffix disagreement needs settling in `po_data`.** Thirteen orders are
      written one way in the ledger and another in the tracker: `2465639` against
      `2465639-2`, and it runs both ways. The importer pairs them and reports each one,
      which is the right behaviour for an exception and the wrong one for a permanent
      state. Left alone, every future reconciliation carries these same 13 and a
      fourteenth genuine mismatch would be lost among them. Decide which form is correct
      and correct the other at source.
- [ ] **The two spellings of the Expeditors airfreight status need collapsing to one.**
      `shipping` holds both `Air freight by Expeditors` and `Airfreight via Expeditors`.
      They are the same thing, so any count, filter or grouping built on that column
      splits one status across two pills until it is fixed in `po_data`.
- [ ] **`ON HOLD (Miami)` belongs in a status column, not in `cargo_ready`.** That column
      is otherwise dates, and it also carries `CARGO READY` as free text. On hold is a
      state the spec expects to filter by, and it cannot be filtered reliably while it
      lives in a date field. `PO pending`, which section 2 also expects, does not appear
      anywhere.
- [ ] **`po_data` has no shipping-mode column at all**, so the shipping-mode filter row in
      PO-TRACKER-SPEC section 2 is left out rather than shown empty, per that section.
      The only mode information in the table is the two Expeditors values above, sitting
      in the status column. Should mode become a column of its own?

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
