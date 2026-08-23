# Design tokens

From `DESIGN-SYSTEM-V2-SPEC.md`. This replaces the previous file, which recorded
the near-monochrome system with serif headings and no cards. That system took the
dashboard away from EcoFibre's house style. This one returns to it: the dashboard
and efdashboard should be indistinguishable.

The register is **EcoFibre's own operations look**: cards on a tinted page, a
tinted header block inside each card, a leaf bar across its top, green
throughout, and figures in Montserrat.

Every value below is a computed value already recorded in the first `DESIGN.md`
extraction from efdashboard. Nothing was read off the live site again for this
pass.

## Typography

One family. Montserrat is the EcoFibre brand face and it is close to what
efdashboard renders.

**No serif anywhere.** Source Serif 4 and Inter are retired, and there is no
monospace: Montserrat's `tnum` figures align on the decimal without the
typewriter texture.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `kicker` | 11.5px / 1, `0.09em`, uppercase | 800 | Category label above a heading |
| `title` | 23px / 1.25 | 700 | Section heading |
| `lede` | 14px / 1.6 | 400 | The line under a heading |
| `figure-xl` | 30px / 1 | 700 | Headline figures |
| `figure` | 17px / 1.3 | 700 | Values inside a table cell |
| `body` | 14px / 1.6 | 400 | Prose |
| `th` | 11px / 1, `0.055em`, uppercase | 600 | Table header |
| `table` | 13px / 1.4 | 400 | Table cell |
| `sub` | 11px / 1.3 | 400 | The grey second line under a value |

The spec calls the table-header token `table-head`. It is `th` in the config,
because a `fontSize` key and a `colors` key sharing a name both generate the same
`text-*` utility and one of them silently loses. The table header *background* is
`thead` for the same reason.

Tabular numerals are set on `body`, so every figure inherits them.

## Colour

| Token | Value | Use |
|---|---|---|
| `page` | `#FAFAFA` | Page background |
| `surface` | `#FFFFFF` | Cards, table rows |
| `tint` | `#EFF5EA` | The tinted block behind a section heading |
| `band` | `#EDF3E8` | Table group bands |
| `thead` | `#F4F8F1` | Table header row |
| `rule` | `#DFE5DC` | Hairlines |
| `rule-field` | `#D8E5CE` | Input borders |
| `ink` | `#333333` | Body text |
| `ink-strong` | `#263D23` | Headings, figures |
| `ink-muted` | `#6D7869` | Descriptions, secondary lines |
| `ink-table` | `#687365` | Table header text |
| `leaf` | `#507A48` | The accent: active pills, buttons, links |
| `leaf-deep` | `#294525` | Heading green, the accent bar |
| `leaf-kicker` | `#71846B` | Kicker text |

### Status

Used **only** in pills, and in a chart only where the colour means there exactly
what it means in a pill.

| Token | Text | Wash | Meaning |
|---|---|---|---|
| `good` | `#257443` | `#E6F5EB` | Dispatched, running |
| `info` | `#345C8A` | `#E8F1FB` | Processing |
| `plan` | `#70458A` | `#F1E8F7` | Booked |
| `watch` | `#8A4A10` | `#FFF0D8` | PO pending |
| `critical` | `#AD3029` | `#FDE8E6` | On hold, stopped, shortfalls, placeholders |
| `off` | `#625C5C` | `#ECE9E9` | Cancelled |

`critical` is the only red in the system and never appears as decoration.

## Structure

Four parts, the same on every tab.

**The card.** White, `14px` radius, `0 10px 30px rgba(59,89,54,0.08)`, and a 5px
`leaf` bar across the top. One card per section. Nothing sits loose on the page.

The bar is a `border-top` rather than a pseudo-element, so it survives printing:
a browser may drop a background but it will not drop a border.

**The tinted header block.** `tint` background inside the top of the card,
holding the kicker, the heading, a one-line lede, an as-at line in `leaf-deep`
bold, and a right-aligned search field where the tab has search.

**Filter pills.** Rows, each labelled above in `kicker`. Active is `leaf` fill
with white text; inactive is white with a `rule` border. The count sits inside the
pill in a lighter weight. An "All" pill starts each row. Grey summary pills sit
below the rows.

**The table.** Header row on `thead` in `th` style and `ink-table`. Group bands on
`band` in small bold uppercase `leaf-deep` with a count. Body rows on `surface`
with a `rule` hairline between. No vertical rules anywhere.

Where a value has a qualifier, the cell is two lines: the value in `figure`, the
qualifier beneath in `sub` `ink-muted`.

## Spacing

Tailwind's own scale, deliberately not replaced.

The previous config replaced it with a sparse 8px scale of `1 2 3 4 6 8 12`,
which meant `h-5` and `h-9` were not classes at all. They compiled to nothing and
failed silently: the Gantt's month scale row collapsed to its one-pixel border
and pushed its labels up out of the chart. A replaced scale turns a typo into an
invisible failure, and there is no reason to carry that risk for a scale nobody
asked to change.

## Radius and shadow

| Token | Value | Use |
|---|---|---|
| `rounded` | `6px` | Buttons, fields |
| `rounded-card` | `14px` | Cards |
| `rounded-full` | — | Pills |
| `shadow-card` | `0 10px 30px rgba(59,89,54,0.08)` | Cards, and nothing else |

## What carries over from REDESIGN-2

`$` on every monetary figure; negatives in parentheses; lucide icons in headings,
pills, document types and actions; Tab 1 plotting the balance as one series; Tab
2's variance bars; the statement in the workbook column layout; the order drawer;
one sentence of prose per screen.

Charts use `leaf` for the series carrying the message and `ink-muted` at low
opacity for context.
