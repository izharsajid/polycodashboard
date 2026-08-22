# Redesign — visual system and information hierarchy
## Build specification for the EcoFibre x Polyco dashboard

Read alongside `CLAUDE.md`, `BUILD-SPEC.md` and the `manufacturing-finance` skill. This
changes how the dashboard looks and how it sequences information. It changes no figures,
no engine function and no data file.

---

## 1. Why

The people reading this are Andy Blewett, Jack Prichard and Samuel Story-Taylor at Polyco,
and Izhar and Hamza at EcoFibre. They are numerate and short of time, and they are being
asked to make one decision together: keep operating at the volume available, or stop
temporarily to remove fixed overhead.

The dashboard currently presents everything at once and at equal weight. Tab 1 opens with
five tiles, a chart, a seven-line table and three notes, all competing. Tab 2 adds four
more tiles, fourteen month tabs and a full statement table. Nothing on either page tells
the reader what matters most, so the reader has to work it out. That is the page's job.

Two objectives:

1. **Adopt the visual language of efdashboard.com**, so the two systems read as one family.
2. **One answer per screen.** Lead with the finding. Support it with one visual. Put the
   working underneath, and the detail behind a control the reader chooses to use.

---

## 2. Take the design tokens from efdashboard.com

Do not guess at these and do not approximate them from the rendered page. Open
`https://efdashboard.com` with the chrome-devtools tools and read the computed values off
the live site, then write them into `tailwind.config.js` and a short `DESIGN.md` recording
where each came from.

Extract:

- Every colour: page background, surface and card background, borders and rules, primary
  and secondary text, the brand green and any accent, and the full status palette used on
  the PO tracker and stock tables for good, watch and critical states.
- Typography: font families actually loaded, the size and weight of the page title, section
  headings, subheadings, table headers, body text and the small descriptive line under each
  section heading; line heights and any letter-spacing.
- Spacing and shape: card padding, gaps between cards and sections, border radius, border
  width, and any shadow.
- The header and the section navigation: height, spacing, how the active item is marked.

Apply them to the whole dashboard. Where this project has a token efdashboard has no
equivalent for — the hatched band on the receipts chart, for instance — derive it from the
extracted palette rather than inventing a new colour.

**Keep two things from the current build regardless of what the extraction finds.**
Tabular figures with thousands separators, right-aligned in tables, because financial
figures must line up on the decimal. And red reserved for shortfalls, exceptions and
placeholders only, never as an ordinary accent, so that a red mark always means something.

---

## 3. Adopt efdashboard's structural pattern

efdashboard introduces each section with three things: a small category label, a heading,
and one plain line saying what the section shows. "Orders & logistics / Purchase order
tracker / Search, filter and review open or dispatched orders."

Use the same pattern on every tab. It orients a reader in about a second and it costs a
line of text.

Section nav sits under the page header, matching efdashboard's placement and active-state
treatment.

---

## 4. One answer per screen

Every tab follows the same four-part shape, top to bottom. The reader should be able to
stop after any part and have got something whole.

**The finding.** One sentence, generated from the model, stating what the numbers mean.
Set larger than body text, no more than about twenty words, at the top of the page under
the section heading. Not a chart title, not a caption — a statement.

**The number that carries it.** At most three figures at the top of a screen, not five and
not nine. Three is what someone remembers. Everything else moves down or behind a control.

**One visual.** The single chart that shows the finding. One chart per screen, one message
per chart. The title states the finding rather than naming the variable.

**The working, on demand.** Reconciliations, line-by-line tables, exception lists and
month-by-month detail live below the fold or behind a disclosure control. Present, never
hidden, but not competing with the answer.

---

## 5. Tab by tab

### Tab 1 — Where we stand

Currently: five tiles, a chart, a reconciliation table, three notes.

Reduce the top of the page to three figures: **received from Polyco**, **value delivered**,
and **advance not yet covered**. Open order book and containers ready move into the
reconciliation table below, where they already appear as line items and where they belong,
because they are working rather than headline.

The finding, above the tiles: *Polyco has paid 5.77m against 3.66m delivered. After every
open order and ready container ships, 1.41m is still to be worked off.* Generate it from
the engine; never hand-write a sentence containing a figure.

Keep the receipts-against-deliveries chart as the single visual. Add a range control for
the last 12 months, defaulting to it — the series runs from January 2023 and the part that
matters is the recent divergence, which is currently compressed into the right quarter of
the axis.

The reconciliation table stays, below the chart, as the working.

The three notes become one line under the chart and a single exception count linking to the
detail. Three stacked note boxes at equal weight is three things shouting at once.

### Tab 2 — Funding statements

Currently four tiles, fourteen month tabs, a full statement, matched receipts and a chart.

The finding, from the model: *Since March 2026 every statement has been paid within days,
at or within about a thousand dollars of the request.*

Three figures: **funds requested**, **received against statements**, **the shortfall**.
The recurring monthly cost of holding the operation open is important but it is a different
question, so give it its own small block lower down with a line explaining what it excludes.

The cumulative requested-against-received chart is the single visual, and it should sit
above the month detail rather than below it. The pattern is the point; any individual
month is supporting evidence.

The month selector and the reproduced statement move below, under a heading that says what
they are — the statements as issued, for reference.

The exception flags gather into one panel rather than scattering across months, listed
plainly: what is missing, what conflicts, what is unmatched. A reader should be able to see
every open item in one place without clicking through fourteen months.

### Tabs 3 to 8

Not built. Apply the same shape when they are: finding, three figures, one visual, working
underneath.

---

## 6. Details that carry weight

**Every screen states its as-at date.** A financial figure without a date is not a
financial figure.

**Figures round to whole dollars in headline tiles.** Cents belong in reconciliations,
where they prove the tie, and nowhere else.

**Every chart is readable in greyscale**, because these will be printed for a board pack.
Distinguish series by line style and direct labelling, not by colour alone.

**Every tab prints cleanly to one or two pages.** Test it. Navigation, controls and
disclosure toggles are `no-print`.

**Works on a phone.** Andy will open this on a phone before he opens it on a laptop. Tiles
stack, tables scroll horizontally within their own container rather than breaking the page,
and the finding stays legible at 380px.

**Nothing above the fold requires a tooltip to understand.**

---

## 7. What not to do

Do not add a colour that is not in the extracted palette. Do not use a pie chart, a doughnut
or a dual axis. Do not animate anything on load. Do not use icons in place of words in a
figure label. Do not put a figure in a tooltip that is not also somewhere on the page. Do
not write a sentence containing a number by hand — every such sentence is generated from
the engine, or it goes stale and is eventually wrong on screen.

---

## 8. Sequence

1. Extract the tokens from efdashboard.com, write `tailwind.config.js` and `DESIGN.md`.
   Stop and show a single component restyled, so the direction is agreed before it is
   applied everywhere.
2. Header, section navigation and the shared section-heading pattern.
3. Tab 1 restructured.
4. Tab 2 restructured.
5. Print and mobile pass on both tabs.

Tests stay green throughout. No engine function and no data file changes. If a restructure
appears to need a new figure, that figure comes from the engine, with a test, and never
from the component.
