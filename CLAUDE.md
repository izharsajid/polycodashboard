# EcoFibre x Polyco — position, capacity and configuration dashboard

## What this repo is

A dashboard shown to **Eco Fibre Bahrain W.L.L. internally and to Polyco Healthline Ltd
(UK), our customer**. Its single job is to let both companies decide together whether to
keep operating at the volume available, or to shut the plant temporarily to remove fixed
overhead until volume returns.

Polyco notified us on 2 August 2026 that two of their major customers have instructed
them to move production to China until the Strait of Hormuz normalises, and that Polyco
is moving to order-by-order payment. The decision is due before the end of August 2026.

## The four questions, and nothing else

1. Where do we stand with Polyco today?
2. What is still to be made?
3. What can we run today, and what does each configuration cost per month?
4. How do we get to 8 machines and beyond?

`BUILD-SPEC.md` is the authoritative brief. Read it before starting work. For the
Funds Requested tab, `BRIEF-TAB1.md` governs instead; see Status.

## Absolute rules

**Never invent a business number.** If a rate, ratio, headcount or price is not in
`/data`, stop and ask. Log the question in `OPEN-QUESTIONS.md`. Anything estimated is
tagged `placeholder` and renders red.

**No numeric literal representing a business fact may appear in `/src`.** Every business
number loads from `/data` and is validated by Zod at load.

**Never include** balance sheet, bank balances, cash position, loans, overdraft, HBTF,
interest, finance cost, accumulated losses, profit and loss, equity, supplier names or
balances, individual salaries, raw material unit prices, margin, unit cost, director or
MD expenses, other customers, or government support. Not in the UI, not in `/data`, not
in a comment. If a calculation seems to need one of these, it is the wrong calculation.

**Exception: `data/funds-requested.json` and the Funds Requested tab.** That file holds
the monthly Financial Overview statements exactly as EcoFibre issued them to Polyco,
who already hold every one. The tab is a recap of documents in Polyco's
possession, not a new disclosure, so the list above and the `partner-disclosure` skill
do not apply to it. Its lines, remarks and notes are stored and rendered as written,
with no redaction and no cleaned copy, including where they name a person's pay, a
supplier, another customer, government salary support or a per-container cost.
Decided by Izhar, 30 September 2026.

The exception covers that file as issued and nothing else. Do not carry its lines into
any other tab or file. Everything from any other source still follows the list above.

**Never commit a key, token or credential.** The repo is private but the rule stands.

## Currency

Report in **US$**. Where a BHD figure is the source, convert at the single constant in
`assumptions.json`: BHD 1 = USD 2.6596. Never hard-code it inline.

## Working style

- Engine first, UI second. Write the test before the engine function.
- Reconcile to source, not to your own subtotals.
- Commit messages state what changed and why, in business terms.
- Data changes go through a PR so every number carries an author and a date. That audit
  trail is the point of using git here.

## Skills in this repo

- `.claude/skills/polyco-ledger` — the ledger and statement rules. Read it before
  touching anything in `/data`, the importers, or the exposure calculation.
- `.claude/skills/partner-disclosure` — what appears on the one shared dashboard, which
  every signed-in user sees in full. Read it before building any UI.

## Status

Rebuilt from scratch on 1 October 2026 to `BRIEF-TAB1.md`. The dashboard has four
tabs; the first two are built as month cards that open into a panel (see `DESIGN.md`):

- **Funds requested**, from `data/funds-requested.json`, cards colour-coded by cost
  category.
- **PHL/EcoFibre statement**, live. efdashboard.com is the MASTER for which orders
  exist and whether each was dispatched; a dispatched order counts as delivered and
  moves the exposure. Values and history back to 2022 come from the statement
  workbook, copied as issued into `data/polyco-statement.json` by
  `scripts/import-statement.py` (as at 30 September 2026). Payments, invoices,
  corrections and files recorded on the tab are kept in Netlify Blobs and never
  overwrite the workbook. Every disagreement is a numbered discrepancy. Editing needs
  the passcode set as `EDITOR_KEY` on Netlify. Read `polyco-ledger` before changing it.
- **PO tracker**, efdashboard.com's tracker read live through `/api/tracker`, with its
  own rules ported to `src/engine/tracker.ts`, and every PO file viewable and
  downloadable through `/api/po-document`. The Supabase URL and public key are
  `SUPABASE_URL` and `SUPABASE_ANON_KEY` on Netlify, functions scope only.
- **Machines**: a board of where every machine stands today, a Gantt chart of when
  each runs until (September to December 2026, striped where no PO is behind the
  work), the work planned without a PO, then thermoforming, lamination and trimming
  in turn, each machine with what it runs from today and the POs it is making. Every
  machine follows `data/machine-plan.json`, typed from the Production Machine Flow
  workbook's Thermoforming and Finishing Department sheets (latest 1 October 2026,
  sent 6 October), and nothing else: efdashboard.com's Line Usage is out of date and
  is not read or mentioned, by Izhar's direction. The workbook's "Copy of
  Thermoforming" sheet is an old version and is not used. Change a date through a
  PR. Each run's `orders` are the POs, "PO Required" slots and no-PO work the sheets
  list against it; efdashboard.com only supplies each PO's status and quantities. On
  the finishing sheet the Potato tray is the Destiny 7x7 tray and Every Table is
  Point Five ET.
- **Plant 3D**: the same plan drawn as the process line in three.js, loaded only when
  the tab is opened: thermoforming as two lines of four standing back to back, then
  lamination, then trimming. A day slider and play show every machine's state on any
  day (`nowOf`), with stack lights green running, amber maintenance, red not running;
  clicking a machine opens what it runs now and next. Where each machine stands is
  the plan's `floor` list; which formers stand in which line is assumed (1 to 4, 5 to
  8) until Izhar confirms. Colours are read from `tailwind.config.js`.
- **Removed POs.** POs Polyco cancelled are listed in `data/removed-pos.json` and
  removed from the dashboard entirely: dropped from efdashboard.com's feed
  server-side, kept out of the statement data and its importer, and never named in
  the UI. Add a PO there through a PR.

Engines are in `src/engine/`, pages in `src/tabs/`, shared components in
`src/components/`, tests in `tests/`. Add a tab through `src/tabs/index.ts`.

An Inventory tab follows. The old `orders`, `order-documents`, `documents` and
`exports` endpoints and `data/po-tracker.json` predate the live tracker and still
need a session nobody can create; they can go once nothing depends on them.

**Access.** Anyone with the address can read the dashboard. Making a change (recording a
payment or invoice, correcting a figure, fixing a discrepancy, uploading a file) needs a
signed-in account, and the server stamps each change with that account's name. Accounts
are added by an administrator on the People page; while email sending is off, the page
shows the new person's one-time link to pass on. As of 1 October 2026 the only active
account is izhar@ecofibre.bh (administrator).

**The audit log is paused** at Izhar's direction while he reconciles the statement: nothing
is written to it. Set `AUDIT_LOG=on` in the Netlify environment when Polyco's users are
onboarded, and every sign-in, change and upload is logged from then on. The changes
themselves are always kept, signed, on the statement.

The site stays out of search results through robots.txt, a noindex meta tag and an
`X-Robots-Tag` header. Anything added to `/data` is public the moment it deploys; check
`partner-disclosure` before adding a file.

Headcount, cost and configuration work stays blocked pending that data. Do not
fabricate machine dates, rates or costs to get moving; the machine plan holds only what
the production plan states.
