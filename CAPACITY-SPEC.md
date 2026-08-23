# Machine schedule and capacity
## Build specification — new tab

Read alongside `CLAUDE.md`, `DESIGN-SYSTEM-SPEC.md`, `PO-TRACKER-SPEC.md` and the
`manufacturing-finance` skill.

New tab, **"Machines"**, placed after the order tracker and before the six-month forecast.
It is the production half of the picture the forecast tab currently guesses at.

---

## 1. What this answers

Polyco asked EcoFibre to keep capacity available. EcoFibre needs to know what capacity
costs to hold. This tab shows what each machine is running, when it stops, and what the
plant looks like month by month as orders run out.

**The finding this tab exists to deliver:** the plant is on a scheduled glide path from
eight machines to three by February 2027, and three is below the four-machine floor
EcoFibre has stated as the minimum viable configuration.

---

## 2. The data

Create `data/machine-schedule.json`. It is a new source, entered by hand from the
production schedule, so every field carries what it was taken from and when.

```
machines: [
  {
    id, name,                       // "M1", "Machine 1"
    status,                         // running | mould_changing | stopped
    currentProduct,
    runs: [                         // one per product campaign
      { product, from, to, note, purchaseOrders: [] }
    ],
    stopDate,                       // null where the machine continues
    continuous,                     // true where it runs on repeat monthly orders
    note
  }
]
```

Confirmed by Izhar on 23 August 2026. Every date below is `confirmed` unless marked.

| Machine | Status | Product | Changes to | Stops | Why |
|---|---|---|---|---|---|
| M1 | Mould changing | Large Medical Tray | Platinum C3 from 10 Sep 2026 | 30 Nov 2026 | POs run out |
| M2 | Running | Platinum C1 | — | 31 Jan 2027 | POs run out |
| M3 | Running | Oasis Tray #1 | — | continuous | one order a month |
| M4 | Running | Oasis Tray #2 | — | continuous | one order a month |
| M5 | Mould changing | Point Five ET Tray | — | 30 Nov 2026 | POs run out |
| M6 | Running | Oasis Plus Tray | Medium Medical from 5 Sep 2026 | 20 Sep 2026 | POs run out |
| M7 | Running | 7x7 Tray | — | continuous | one order a month |
| M8 | Mould changing | Point Five ET Lid | — | 20 Oct 2026 | POs run out |

**A mould change takes hours, not days.** It completes within the same day. Draw it as a
marker on the timeline, not as a segment consuming days, and never as a gap in production.

**M3, M4 and M7 run continuously** on one order a month each, forecast to **March 2027**.
Beyond that horizon the schedule does not extend; the Gantt stops at March 2027 rather than
implying anything further.

**Every machine stops because its purchase orders run out**, not because a mould comes off
or a decision has been taken. Say so on the tab. This is a plant running out of work, and a
reader who assumes otherwise will draw the wrong conclusion from the same chart.

**The resulting machine count**, which the tab must compute rather than take from here:

| From | Machines | Change |
|---|---|---|
| today | 8 | |
| 21 Sep 2026 | 7 | M6 stops |
| 21 Oct 2026 | 6 | M8 stops |
| 1 Dec 2026 | 4 | M1 and M5 stop |
| 1 Feb 2027 | 3 | M2 stops |

Four machines from December, three from February. **Three is below the four-machine floor
EcoFibre has stated as the minimum viable configuration**, and the six-month forecast tab
independently puts the order book running out in February 2027 from the ledger and the
tracker. Two sources, different data, the same month. Say that on the page.

---

## 3. The Gantt

The main visual. Machines down the left, time across the top, September 2026 to March 2027,
with today marked.

- One bar per campaign, labelled with the product.
- A mould change is a distinct hatched segment before the run it precedes, not a gap.
- A stop is a hard terminus with the date beside it.
- A continuous machine's bar runs to the edge and fades, with "one order a month" beside it,
  because an unbounded run drawn as a bounded bar is a lie.
- Hover or tap a bar for the POs on that campaign and their value.
- Two colours only, per the design system: `accent` for a scheduled run, `ink-30` for a
  mould change. A stop is a terminus mark, not a colour.
- Today is a vertical rule.

Below it, and this is the chart that carries the finding: **machines running by month**, a
step line from eight down to three, with the four-machine floor drawn as a horizontal rule
and the month it is breached labelled.

Three figures above: machines running today, machines running at 1 January 2027, and the
month the count falls below four.

---

## 4. The reconciliation, which is the point

Cross-check the schedule against the ledger and the PO tracker on every load, and show the
result plainly. This has already found real gaps and it must be a standing output, not a
one-off report.

**Three lists, each with a count and a total value:**

**Orders with no machine.** Pending POs in the ledger that appear nowhere on the schedule.
Currently ten, worth $362,469. Compute and show the list with its total, but do not raise it
as an alarm in this build: Izhar has set these aside to be worked through separately.

One of them has a known reason and should carry it: **2679131-1, Northwest frozen appetizer,
$36,465** — on hold at the customer's request until December 2026, cargo already ready. Show
that reason against the row rather than leaving it looking unexplained.

**Machines with orders not in the ledger.** Schedule POs the ledger does not carry.
Currently fifteen. The statement is as-at 28 July 2026 and today is later, so orders placed
since then will not be in it. **Check each against the PO tracker before calling it missing**
and split the list in two: found in the tracker, and found in neither. Only the second list
is a real gap. Do not assume the first explains all fifteen.

**Same PO on more than one machine — expected, not an error.** Confirmed by Izhar: a single
purchase order can carry several SKUs, and those run on more than one machine at once. The
Platinum orders 2678303, 2678304 and 2676085 each carry both C1 and C3 lines, which is why
they appear on M1 and M2. 2679868-1 carries both a medium and a large medical tray.
2678252-1, 2679683 and 2679682 carry a tray and its lid.

So this list is **informational, not an exception**. Head it "Orders running on more than one
machine", show which machines and which SKUs, and do not flag it. Flagging a normal
operating pattern trains a reader to ignore the flags that matter.

Match on the full reference first, then on the base number, and label which. The `-N` suffix
disagreement between the two systems is already logged in `OPEN-QUESTIONS.md`.

---

## 5. What this does not do

**No output rates, no cost per configuration, no headcount.** Those need data that does not
exist yet: practical output per machine, operators per shift, cases per container by SKU,
and direct headcount at each configuration. Do not estimate them and do not build a
placeholder that implies them.

This tab shows **what runs and when**. What it costs and what it produces is the next tab,
and it stays unbuilt until the numbers arrive.

---

## 6. Rules

- Every date on this tab is `confirmed` or `estimated`, and estimated renders red per the
  existing rule. Most of what is here starts as estimated.
- Never infer a stop date from a note. If the schedule says "November 2026" with no day,
  that is what shows.
- The reconciliation never silently drops a row. Anything excluded is listed and counted.
- Follow the design system: no cards, one accent, serif headings, `$` on every figure.

---

## 7. Sequence

1. `machine-schedule.json` with a Zod schema, every field marked `confirmed` or `estimated`,
   served through `/api/data`. Stop and show me the reconciliation against ledger and
   tracker.
2. The Gantt.
3. The machines-by-month step chart and the three figures.
4. The three reconciliation lists.
5. Print and phone.
