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

Rebuilt from scratch on 1 October 2026 to `BRIEF-TAB1.md`. The dashboard has two
tabs, both built as month cards that open into a panel (see `DESIGN.md`):

- **Funds requested**, from `data/funds-requested.json`, cards colour-coded by cost
  category.
- **PHL/EcoFibre statement**, from `data/polyco-ledger.json` (as at 28 July 2026) and
  `data/ledger-disputes.json`. The position to the uncovered advance, the balance month
  by month, and every movement whose date is missing, disputed or after the as-at date
  listed as unresolved, never placed in a month. Read `polyco-ledger` before changing it.

Engines are in `src/engine/`, pages in `src/tabs/`, shared components in
`src/components/`, tests in `tests/`. Add a tab through `src/tabs/index.ts`.

The next two tabs follow: the Orderbook from the PO Tracker with its attached files,
and Inventory. The `orders`, `order-documents`, `documents` and `exports` endpoints,
and `data/po-tracker.json`, are kept as the Orderbook's plumbing.

**Access is open.** Sign-in, accounts and Netlify's site password were removed on
1 October 2026 at Izhar's direction, so anyone with the address can read every statement.
The site stays out of search results through robots.txt, a noindex meta tag and an
`X-Robots-Tag` header. `AUTH-SPEC.md` describes the sign-in as it was and no longer
applies. Anything added to `/data` is now public the moment it deploys; check
`partner-disclosure` before adding a file.

Machine, headcount and configuration work stays blocked pending that data. Do not
fabricate machine data to get moving.
