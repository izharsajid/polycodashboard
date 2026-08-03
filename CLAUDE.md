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

`BUILD-SPEC.md` is the authoritative brief. Read it before starting work.

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
- `.claude/skills/partner-disclosure` — what Polyco may and may not see. Read it before
  building any UI or changing the redaction layer.

## Status

Gates 1 to 3 of the delivery sequence are complete: scaffold, schemas, engine, 14 passing
tests. Start at gate 4, Tab 1. Phase B (Tabs 4 to 7) is blocked pending machine,
headcount and configuration data — do not start it and do not fabricate machine data to
get moving.
