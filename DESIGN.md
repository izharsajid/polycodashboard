# Design tokens

From `BRIEF-TAB1.md` section 4 and the approved design plan of 30 September 2026.
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
| `marking` | `#F2B300` | Safety-line yellow. The selected statement, and nothing else. Never text; always edged in `press`. | 1.87:1, so never alone |

`alert` (`#A3261F`, 7.2:1) is for form errors on the sign-in and account pages only.
The Funds Requested tab carries no red: `manufacturing-finance` keeps red for
placeholders and shortfalls, and the tab has neither.

## Colour: seven for the data

The only other colour anywhere. Each category keeps one hue and one lucide icon in
every chart, legend, table row and detail view. Text never wears these colours.

| Stack | Category | Token | Value | Icon |
|---|---|---|---|---|
| 1 | Payroll and people | `cat-payroll` | `#2F6BC4` | `Users` |
| 2 | Raw material | `cat-raw` | `#B5801C` | `Container` |
| 3 | Working capital | `cat-working` | `#C24D86` | `Wallet` |
| 4 | Compliance and certification | `cat-compliance` | `#3B8A1F` | `BadgeCheck` |
| 5 | Supplier payments | `cat-supplier` | `#6A4FC2` | `Handshake` |
| 6 | Facility | `cat-facility` | `#13A08A` | `Factory` |
| 7 | Logistics and clearance | `cat-logistics` | `#E0612B` | `Ship` |

Validated with the `dataviz` palette validator on `#FFFFFF`, in stack order, and every
check passes. All seven sit in the lightness band with chroma at or above 0.10. The worst
adjacent colour-blind ΔE is 10.8 (deutan), the worst normal-vision ΔE is 19.9, and every
hue is at least 3:1 against white. The stack order was chosen by the validator. Change a
hue or the order and re-run it.

## Texture

Three textures, the same in the charts and in the HTML legends
(`.hatch-utilised`, `.hatch-gap`, `.hatch-overlap` in `index.css`):

- **Hatched over a category colour:** the utilised part of a request carrying actuals.
- **Diagonal hatch on white:** days no request covers.
- **Cross-hatch on ink:** days two statements both claim.

A dashed outline with no fill is a statement of actuals, which is not a request.
Texture and fill carry the statement kind, so colour is left to the categories and
everything survives greyscale printing.

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
- **One bold element:** the requirement chart with the coverage rail beneath it.
  Everything else stays quiet.
- **Radius** is 2px on buttons and fields, 0 everywhere else.

## Motion

None. The motion budget allows only transform and opacity, and the one movement
considered (the stack recomposing when a category is toggled) would animate layout
properties. The page answers interaction instantly.

## Print

A4 portrait, 12mm margins. The charts redraw at the page width before printing,
controls are hidden and replaced by a line saying which categories are shown, and
direct labels replace hover. Sections from the second onward start a new page, and
table headers repeat across page breaks.
