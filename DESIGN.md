# Design tokens

From `BRIEF-TAB1.md` section 4 and the approved design plan of 30 September 2026,
simplified on 1 October 2026 to one chart and one month-by-month table.
This replaces the efdashboard house style (Montserrat, leaf green, rounded cards),
which the brief retired.

The register is an **engineering sheet**: a galvanised ground, white ruled sheets
with square corners and no shadow, blue-black ink, a heavy rule across the top of
each section, and a title block like the one on a packaging drawing. It belongs to
a factory with presses and containers, not a metrics product.

## Colour: six for the page

| Token | Value | Use | Contrast |
|---|---|---|---|
| `zinc` | `#E9ECEB` | Page ground. Cool galvanised grey, deliberately not cream. | |
| `sheet` | `#FFFFFF` | Surfaces: ruled sheets, table rows | |
| `press` | `#16202A` | Ink: text, axes, structural rules, the focus ring | 16.5:1 on sheet |
| `press-2` | `#56626C` | Secondary text, outlines, control borders | 6.25:1 sheet, 5.26:1 zinc |
| `rule` | `#C5CCCF` | Hairlines only, never the only edge of a control | |
| `marking` | `#F2B300` | Safety-line yellow. The average line on the chart and the active tab. Never text. | 1.87:1, so never alone |

`alert` (`#A3261F`, 7.2:1) is only for the message shown when the statements fail
to load. The figures carry no red: `manufacturing-finance` keeps red for placeholders
and shortfalls, and the tab has neither.

## Colour: the data

The chart is one colour: requests in `press`, a statement of actuals as a dashed
`press-2` outline with no fill, and the average across the requests as a dashed
`marking` line. The seven-category palette was retired with the category breakdown
on 1 October 2026.

## Type

One family: **Archivo**, self-hosted from `@fontsource-variable/archivo` with its
width axis. Headings use the condensed width (`font-stretch: 78%`, the `.title`
and `.condensed` classes). Every figure uses tabular numerals. No serif, no
monospace, no tracked-caps eyebrows. The one exception is the statement-kind stamp,
because a stamp is set in capitals.

| Token | Size / line height | Use |
|---|---|---|
| `display` | 32 / 1.15 | The headline sentence, once per page |
| `title` | 20 / 1.25 | Section headings, which state the finding |
| `body` | 15 / 1.55 | Prose |
| `table` | 13 / 1.4 | Table cells, controls |
| `small` | 11.5 / 1.35 | Axis labels, secondary lines. Weight 400 or above, never hairline. |

## Structure

- **Title block** at the top of the tab: a ruled grid like a drawing's title block,
  then the headline sentence. Not a hero.
- **Sections** carry a 2px `press` rule across the top (`.section`). Content sits
  in ruled sheets (`.card`): square corners, a hairline edge, no shadow.
- **Three parts only:** the headline, the monthly chart, and the month-by-month
  table. Any month opens to its lines, remarks and notes as issued.
- **Radius** is 2px on buttons and fields, 0 everywhere else.

## Motion

None. The motion budget allows only transform and opacity, and the one movement
considered (the stack recomposing when a category is toggled) would animate layout
properties. The page answers interaction instantly.

## Print

A4 portrait, 12mm margins. The chart redraws at the page width before printing
and stays whole on its page. The table runs on with its header repeated, and any
month left open prints open.
