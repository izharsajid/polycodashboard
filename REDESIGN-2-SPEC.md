# Second redesign — make it read like a business, not a ledger dump
## Build specification

This supersedes `REDESIGN-SPEC.md` where the two disagree. Read alongside `CLAUDE.md`,
`STATEMENT-SPEC.md`, `PO-TRACKER-SPEC.md` and the `manufacturing-finance` skill.

No figure changes. No engine calculation changes. Every number on screen stays exactly what
it is today. What changes is how it is chosen, formatted, charted and worded.

---

## 1. What is wrong

The dashboard is correct and hard to read. Four specific failures, all traceable to the
earlier specs:

**No currency symbols.** A financial dashboard that shows `5,771,015` and expects the
reader to know it is dollars. Basic, and wrong on every screen.

**Charts that ask the reader to do arithmetic.** Tab 1 plots cumulative receipts and
cumulative deliveries and shades the space between them. The space is the answer, so the
reader has to subtract two lines by eye to find it. Tab 2 does the same with a second pair.

**Too much prose.** Note panels, explanatory lines and caveats stacked three deep. Each was
written to be helpful. Together they bury the numbers.

**A statement in an invented format.** Polyco has been reading the column layout of the
statement workbook for years. The dashboard replaced it with a running-balance ledger of our
own design, in a narrow box.

---

## 2. Who reads this

Andy Blewett is a chief operating officer. Jack and Samuel run commercial and finance. They
have minutes, not an afternoon, and they are deciding jointly with EcoFibre whether the
Bahrain plant keeps running.

They need to see, without reading: **what is owed, what is coming, what it costs to stay
open, and what happens over the next six months.**

Design for someone glancing at a phone between meetings, who will open the detail only when
a number surprises them.

---

## 3. Money on screen

Fix this everywhere first. It is the smallest change and the most visible.

- **Every monetary figure carries `$`.** No exceptions, not in tiles, tables, charts, axis
  labels, tooltips or exports.
- Headline tiles: `$5,771,015`. Whole dollars.
- Very large figures in tiles may abbreviate where space is tight: `$5.77m`, `$1.41m`.
  Never in a table, never in the statement, never in an export.
- Tables and the statement: `$5,771,014.86`, two decimals, right-aligned, tabular numerals,
  the same number of decimals down every column.
- Negatives in parentheses, never a minus sign: `($496,489.00)`.
- Zero is `$0.00`, never a dash or blank.
- Chart axes: `$0`, `$1m`, `$2m`. Tooltips carry the full figure with the symbol.
- Say **US$** once per screen, in the section description, not on every figure.
- One formatter in `src/lib/format.ts`. Nothing formats money inline.

---

## 4. Icons

There are none, and the interface reads as undifferentiated text. Use `lucide-react`.

Where they earn their place, and nowhere else:

- Section headings — one icon per tab, so a reader recognises where they are
- Order status pills — a small mark beside the word, which also solves greyscale printing
- Document types — a distinguishing mark per file type in the order panel
- Actions — upload, download, export, filter, calendar, search, delete
- Direction — up and down against a movement or a variance
- Warnings — one mark against a flagged row, not a red block of text

Rules: an icon never replaces a word in a figure label. Never decorative. One size on a
screen. Inherits the text colour rather than introducing a new one.

---

## 5. Charts, rethought

The current charts are technically right and communicatively poor. Replace them.

### Tab 1 — plot the balance, not two lines around it

**Today:** cumulative receipts and cumulative deliveries, step-after, from January 2023,
with a hatched band between them.

**The problem:** the band is the finding. Drawing two lines and shading the space asks the
reader to subtract by eye. It also runs from 2023, so the recent divergence is squeezed into
the right-hand quarter.

**Instead:** one line — **the advance balance over time**. That single series *is* the gap,
computed directly, no arithmetic required. It rises when Polyco pays, falls when goods ship.
Area fill below the line. Last 12 months by default, a control for full history.

Mark two things on it and nothing else: today's balance as a labelled end point, and the
order cover as a horizontal band showing where the balance drops to once the open book
ships. The distance between the line's end and that band is the uncovered advance, and it
is legible at a glance.

Keep the two-line version available behind a small toggle for anyone who wants to see the
components, off by default.

### Tab 2 — monthly data is categorical, so use bars

**Today:** cumulative requested against cumulative received, two lines.

**The problem:** these are fourteen discrete monthly events, not a continuous quantity. A
cumulative line hides the thing that matters — whether each individual month was paid in
full.

**Instead:** a **bar per month**, showing the variance between requested and received. Bars
at or near zero are months that settled. The three that did not stand out immediately, and
January 2026's $25,799 shortfall is visible rather than being averaged into a slope.

Above it, a small run indicator: a row of fourteen marks, one per month, showing settled,
partial or unmatched. A reader sees the pattern in one glance and reads the bars only if
something looks wrong.

### Everywhere

One chart per screen. The title states the finding, never names the variable. Direct labels
on the series, no legend where two labels would do. No dual axes, no pie charts, no
doughnuts. Readable in greyscale, distinguished by shape and label rather than colour alone.
Every axis labelled with units. No animation on load.

---

## 6. The statement — use the layout Polyco already knows

Rebuild it to the column structure of the statement workbook. That format has been going to
Polyco for years, their finance team reads it fluently, and replacing it with our own layout
forced them to learn a new document to check a familiar one.

**Columns, in the workbook's order:**

| # | Column |
|---|---|
| 1 | S. No. |
| 2 | PO No. and date |
| 3 | Product |
| 4 | PO amount |
| 5 | Proforma invoice no. and date |
| 6 | Proforma invoice amount |
| 7 | Delivered value |
| 8 | Received |
| 9 | Funds received date |
| 10 | Loaded on container |
| 11 | Pending value to deliver |
| 12 | Delivery date |

**Remove the source row column.** It is our internal trace back to the workbook and means
nothing to a reader.

**Keep the running balance** as a final column, and keep it optional. It is what makes the
page reconcilable, and the workbook has no equivalent, so it is an addition rather than a
replacement. Default on.

**Full bleed.** The statement is a ledger and it takes the full width of the page. No card,
no narrow container, no shadow. Sticky header. Sticky totals row at the foot showing the
column sums for the visible range.

Row grouping by month, with a subtle band and a month subtotal, so a reader can find a
period without reading every line.

Keep everything the engine already does underneath — the split entries, the undated
handling, the flagged dates, the ranges, the export. Only the presentation changes.

---

## 7. Orders and documents

**The order table** stays close to efdashboard, which works. Add a document count against
each order, with an icon, so a reader can see at a glance which orders have paperwork.

**The order panel is the part that reads badly.** Rebuild it as a right-hand drawer that
slides over, not a menu, with three clear parts top to bottom:

1. **The order** — PO number, product, status, values, dates. A short block, not a form.
2. **Where it sits in the statement** — the matching ledger entries, so someone can go from
   an order to its money in one step.
3. **Documents** — two groups, purchase order and delivery. Each document a single row with
   a type icon, name, size, who added it and when, and view and download actions. A large
   drop area at the foot of each group, with a file picker beneath it.

A drawer, so the reader keeps their place in the list. Close on escape and on clicking away.
One order open at a time.

Empty states say what to do: *No purchase order uploaded yet. Drop the PO here.*

---

## 8. Six-month forecast — a new tab

The dashboard shows where things stand and says nothing about where they are going. That is
the question Polyco actually has.

Everything needed for a cash-and-cover forecast already exists. It does not need the machine
data, which only the capacity tabs are waiting on.

**Tab: "Next six months".**

Project month by month, from today to six months out:

- **The advance balance**, falling as the open order book ships. From the ledger and the
  tracker's dispatch dates.
- **The cost of holding the operation open** — the recurring monthly figure already derived
  from the funding statements, currently around $149,485 a month.
- **The order book running out.** State plainly the month in which the open book is
  exhausted at the current dispatch rate, and what is left uncovered when it is.

**Three scenarios**, switchable, each stated in a sentence:

- **Current book only** — nothing new is ordered
- **At the 2025 rate** — Polyco orders at the average of the last twelve months
- **Order-by-order** — a settable monthly volume, defaulting to the last three months

One chart: the advance balance and the cumulative cost of staying open, over six months,
with the crossing point marked and labelled. Three figures above it: month the book runs
out, uncovered advance at that point, and total cost of staying open to then.

Every assumption named on the page with its source. Anything estimated renders red, per the
existing rule.

When the machine data arrives this tab gains configuration scenarios. It does not need them
to be useful now.

---

## 9. Fewer words

- **One sentence of prose per screen**: the finding, generated from the engine.
- Section descriptions are one line. Not two, not a paragraph.
- **Delete every stacked note panel.** Exceptions become a single count with an icon,
  opening a panel on demand.
- A caveat that applies to a figure sits with that figure, not in a separate box.
- No sentence explains what a column heading already says.
- If a screen has more than about eighty words outside tables and figures, it is too many.

---

## 10. Sequence

Each step is independently shippable. Stop after step 1 and show a screen.

1. **Money and icons everywhere.** One formatter, `$` on every figure, icons in the places
   listed. Smallest change, most visible.
2. **Tab 1 chart** — the balance line replacing the two-line band.
3. **Tab 2 chart** — variance bars and the run indicator.
4. **Prose cull** across all four tabs.
5. **The statement** in the workbook layout, full bleed.
6. **The order drawer** and documents.
7. **The six-month forecast tab.**
8. **Phone and print pass** on everything. Verify on a real device.

Tests stay green throughout. No engine figure changes. If a redesign appears to need a new
figure, it comes from the engine with a test, never from a component.
