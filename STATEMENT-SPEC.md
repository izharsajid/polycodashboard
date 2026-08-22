# Master statement
## Build specification — new tab

Read alongside `BUILD-SPEC.md`, `REDESIGN-SPEC.md`, the `polyco-ledger` skill and the
`manufacturing-finance` skill. New tab. No engine figure changes; the exposure formula and
every existing total stay exactly as they are.

Insert as **Tab 3, "Statement"**. Push "Still to be made" to Tab 4 and renumber the rest.
It belongs next to Tab 1, because Tab 1 states the position and this is the evidence for it.

---

## 1. What this is for

Polyco's accounts team needs to reconcile their ledger against ours: work down the
transactions line by line, tick what agrees, isolate what does not, and agree a closing
balance. Today they cannot do that. Tab 1 gives them the position and Tab 2 gives them the
funding statements, but neither gives them the underlying account.

This tab is that account. Every transaction between the two companies, in date order, with
a running balance, filterable by date and by column, and exportable so it can be worked
alongside their own system.

The test of whether it succeeds: **someone in Polyco's finance team can open it, export a
date range, tick it against their ledger, and tell us exactly which lines they disagree
with.** If they have to ask us for a figure that is on this page, it has failed.

---

## 2. It must behave like a statement, not a table

A filterable list of rows is not a statement. Four things make the difference, and all four
are required.

**Opening balance.** Every view states the balance carried into the first row shown. If a
date filter is applied, the opening balance is the closing balance of everything before it,
not zero. This is the single thing most often got wrong, and getting it wrong makes the
whole page useless for reconciliation.

**A running balance on every row.** After each transaction, what the balance stands at.

**Closing balance.** Stated at the foot, and it must equal opening plus the movement in the
period shown. Assert that in a test.

**A stated convention.** Say plainly, on the page, which direction is which: funds received
from Polyco increase the balance owed to them in goods, delivered value reduces it. A
positive closing balance means EcoFibre holds value yet to be delivered. Without this
sentence two accountants will read the same column in opposite directions.

The closing balance of the unfiltered statement must tie to Tab 1. Add a test asserting the
two agree; if they ever diverge, one of them is wrong and both are now untrustworthy.

---

## 3. The rows

One row per transaction, from `data/polyco-ledger.json`, in date order.

Columns available, with the four marked **default** shown until the reader changes them:

| Column | Notes |
|---|---|
| Date | **default** — the transaction date |
| Type | **default** — delivery, receipt, purchase order, recharge |
| Reference | **default** — PO number, proforma, or the receipt marker |
| Product | SKU description |
| PO value | order value |
| Proforma reference | |
| Delivered value | goods shipped and charges recharged |
| Received | funds in from Polyco |
| Running balance | **default** — always shown, never removable |
| Container status | loaded, pending, not applicable |
| Delivery date | |
| Source row | the line number in the statement workbook, for tracing back |
| Flags | any data exception on that row |

Column selection persists in the URL, so a colleague opening a shared link sees the same
view. Provide two named presets alongside the free choice: **Reconciliation** (date, type,
reference, received, delivered, running balance) and **Full detail** (everything).

Sort by date ascending by default. Allow sorting by any column, but when the sort is not
by date, hide the running balance and say why — a running balance in a non-chronological
order is meaningless and actively misleading.

---

## 4. Date filtering, and the problem it creates

From and to dates, a calendar picker on each, with presets for this month, last month,
last three months, this year and all.

**23 rows in the ledger carry a date that was transposed on entry.** The importer records
the corrected date in `received_date` and preserves the original in `received_date_source`,
with an entry in `flags`. Filtering on a corrected date is right, but it means a row can be
silently excluded from a range on the strength of a correction that is not yet confirmed —
and a row missing from a statement is far worse than a row present and flagged.

So:

- Filter on the corrected date.
- Any row in the visible range whose date carries a flag is **marked in the row itself**,
  showing both the corrected and the original date.
- Where a flagged row falls **outside** the current range on its corrected date but
  **inside** it on the original, show it below the statement under a heading saying so,
  excluded from the totals but visible. Nobody should have to guess whether a row exists.
- A count of unconfirmed dates in the range appears above the statement at all times.

None of this is a workaround. It is the honest presentation of a ledger with 23 known
uncertainties in it, and disclosing that to Polyco before they find it protects the
credibility of everything else on the page.

---

## 5. Export

The point of the tab. Someone will do the reconciliation in Excel, not in a browser.

- **CSV and XLSX.** Export exactly what is on screen: the filtered range, the chosen
  columns, the same sort, the running balance included.
- The exported file carries a header block: EcoFibre Bahrain W.L.L. and Polyco Healthline
  Ltd, the date range, the opening and closing balances, the statement as-at date, the
  export timestamp, and who exported it.
- Flagged rows carry their flag in the export, in a column, not stripped out.
- Filename: `ecofibre-polyco-statement-YYYYMMDD-to-YYYYMMDD.xlsx`.
- Figures export as numbers, not text. An accountant who cannot sum a column will not use
  the file twice.
- **Every export writes an audit entry** — who, when, what range, which columns, how many
  rows. `AUTH-SPEC` section 7 asks for exports to be logged and this is the first one that
  exists.

---

## 6. Layout

Follow `REDESIGN-SPEC` section 4: finding, three figures, one visual, working underneath.
Here the working is the statement itself, and it is the point of the page, so it takes most
of the room.

**Finding**, generated from the engine, not written: what the balance stands at and what
covers it.

**Three figures:** opening balance, movement in the period, closing balance. When no filter
is applied, opening is zero and the three still make sense.

**No chart on this tab.** Tab 1 has the chart. This page is a ledger and a chart above it
would only push the rows below the fold.

**Controls in one bar** above the statement: date range, column preset, column picker,
export. Not scattered.

**The statement fills the rest.** Sticky header row. Rows dense enough that a reconciler
can see thirty at once without scrolling. Right-aligned figures, tabular numerals,
consistent decimals down each column, negatives in parentheses.

**Print:** repeat the header row on every page, and the opening balance at the top of each.
Filters and buttons are `no-print`.

**On a phone:** the reconciliation preset only, horizontally scrolling in its own container.
Nobody reconciles on a phone, but Andy will look at it on one.

---

## 7. Rules

- Read from `data/polyco-ledger.json` through the authenticated `/api/data` endpoint. No
  new data file and no second copy of the ledger.
- Filtering, balance and export are pure functions in `src/lib/engine`, tested, not logic
  living in a component.
- Never silently drop a row. If it is excluded, say where it went.
- Never invent a date. A row with no usable date sorts to the end under a heading saying so.
- The unfiltered closing balance ties to Tab 1's advance figure. Test it.
- Cargo clearing and freight recharges sit inside delivered value. They appear as rows of
  type `recharge` and are never deducted a second time anywhere on this page.

---

## 8. Sequence

1. Engine: filter, running balance, opening and closing, and the tie to Tab 1. Tests first,
   no UI.
2. The statement table, default columns, no filters.
3. Date range, with the flagged-date handling in section 4.
4. Column selection, presets, URL persistence.
5. Export, both formats, with the audit entry.
6. Print and phone pass.

Stop after step 1 and show the reconciliation: opening plus movement equals closing, and
the unfiltered closing equals Tab 1.
