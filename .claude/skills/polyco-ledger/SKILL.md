---
name: polyco-ledger
description: The rules governing the EcoFibre x Polyco ledger, the uncovered advance calculation, and the monthly funding statements. Use this skill whenever the work touches the Polyco statement workbook, polyco-ledger.json, monthly-funding-statements.json, the exposure or uncovered advance figure, cargo clearing or freight recharges, PO reconciliation, the efdashboard PO tracker, or any date in the ledger — even if the request looks like a simple data edit or a small refactor. These rules encode errors that have already been made once and corrected; without them they come straight back.
---

# Polyco ledger rules

## The exposure formula

```
Uncovered advance
  =   Total received                          (column H total)
    − Total delivered value                   (column G total)
    − Total value of POs pending to deliver
    − Containers ready and in process, next month
    − Containers in process, month after
```

At 28 July 2026 this returns **1,410,206.34**. It is asserted in the engine tests. If a
change moves that number, either the change is wrong or the underlying data changed and
the test must be updated deliberately, with the reason recorded in the commit message.

| Term | US$ |
|---|---|
| Total PO value raised | 4,226,845.37 |
| Total delivered value | 3,657,722.12 |
| Total received from Polyco | 5,771,014.86 |
| Less POs pending to deliver | (496,489.00) |
| Less containers ready, August | (137,151.00) |
| Less containers in process, September | (69,446.40) |
| **Uncovered advance** | **1,410,206.34** |

## Cargo clearing and freight are never deducted twice

EcoFibre pays the clearing agent, then invoices Polyco. That invoice behaves exactly like
a product line: it sits in **delivered value (column G)**, and when Polyco pays it, the
payment sits in **received (column H)**. In `H − G` the two cancel.

Statements up to February 2026 then subtracted the same recharges again on a separate
summary line. Across 18 clearing invoices that understated the position by 302,214.47.

Show the recharge total as an **information line only**, labelled as already included in
delivered value. Never as a deduction. The engine has a test that fails if the recharges
are subtracted again.

## Dates in the source workbook are unreliable

Columns I and M mix real datetimes with strings, and many datetime cells have day and
month transposed on entry. 23 rows are currently flagged.

The proof case: the October 2025 payment of 220,000.00. EcoFibre's own October actuals
statement records it on **6 October 2025**. The ledger stores it as **10 July 2025**.

Rule: **flag, never silently correct.** The importer writes the corrected date to
`received_date` and preserves the original in `received_date_source`, with an entry in
`flags`. Any date later than the statement as-at date is a transposition by definition.
Ask before treating a correction as confirmed.

## What is authoritative

- **Column G** is the delivered value. Column K disagrees with it by 817,924.40 and is a
  stale partial total. Report the difference; never average or split it.
- **Column F duplicates column D** on every row. Keep one, treat the other as derived.
- The statement workbook filename says February 2026; its content runs to 28 July 2026.
  Never take the as-at date from a filename.

## The monthly funding statements are documents of record

Since June 2025 EcoFibre has issued Polyco a monthly Financial Overview setting out the
funds required, line by line, and Polyco has paid against it. From March 2026 onward the
payment matches the request to within about a thousand dollars; in March 2026 it matched
to the cent.

This means the advance is substantially **operational funding Polyco approved line by
line**, not a customer overpaying for goods. Any narrative in the UI must reflect that.

Rules:

- Reproduce each statement **exactly as issued**, including the remarks column. Do not
  re-categorise, re-order or re-word lines. Polyco already holds these documents; any
  change of wording reads as a revision.
- Every `stated_total` must foot to the sum of its `lines`. All 14 do today. If an edit
  breaks that, fail the build rather than display the discrepancy.
- Never merge these statements with the Tally ledger or with each other.

## Open exceptions — flag, do not fill

Ledger: duplicate PO references `2466124` and `2467665` (the latter a stale Large Tray
line); two freight lines marked `Invoice Pending` at 6,266.50 and 14,728.00; placeholder
proforma references on the six pending Platinum Packaging POs, one dated 03/11/25 against
a PO dated 25/08/26; stray value 35.25515855 in H201.

Statements: two conflicting November 2025 versions, both prepared 4 November 2025, both
totalling 217,598.00, identical amounts, different month labels; actual utilisation
missing for every month except August and October 2025; no statements before June 2025,
no October 2025 funding request, no August 2026 statement; period gaps 1–9 April 2026 and
10–15 July 2026; overlap 1–5 March 2026; July and August 2025 requests unmatched to any
receipt; January 2026 funded 25,799.00 below request.

Outstanding reconciliation: tie the uncovered advance to the Tally creditor balance for
Polyco Healthline Ltd (BHD 838,927.117 at 30 April 2026), itemising timing and
translation differences.

## PO tracker

`efdashboard.com` is Supabase-backed; the `po_data` table holds the records and is
readable through the Supabase REST API. Ask for a read-only key. Never scrape the page
for credentials and never commit a key — read it from a Netlify environment variable and
a gitignored local `.env`.

Reconcile the tracker against the ledger on every import and report POs present in one
and absent from the other. That check has repeatedly found real errors and is a standing
output, not a one-off.
