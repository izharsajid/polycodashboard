# Design tokens

Revised on 1 October 2026 at Izhar's direction. The pages are now **month cards**:
white rounded cards on a galvanised ground, colour-coded by cost category, that open
into a pop-out panel. This replaces the ruled engineering sheet and the drop-down
rows, which read as too dense for the dashboard's readers.

## Colour

| Token | Value | Use | Contrast |
|---|---|---|---|
| `zinc` | `#E9ECEB` | Page ground. Cool galvanised grey. | |
| `sheet` | `#FFFFFF` | Cards and the panel | |
| `mist` | `#F6F7F7` | Soft ground inside a card or panel: tiles, line groups | press-2 5.82:1 |
| `press` | `#16202A` | Ink, and the one strong tile per panel | 16.5:1 on sheet |
| `press-2` | `#56626C` | Secondary text | 6.25:1 on sheet |
| `rule` | `#C5CCCF` | Hairlines and card edges | |
| `marking` | `#F2B300` | The active tab and a chart's reference line. Never text. | |
| `income` / `income-wash` | `#1E6B34` / `#E3F2E6` | Money coming in or reducing a request: other income, credits, receipts. Always with an icon and a word. | 5.65:1 on wash, 6.55:1 on white |
| `info` / `info-wash` | `#1F4E8C` / `#E6EEF9` | Orders on their way: container requested or confirmed, booked; PO links | 7.11:1 on wash |
| `recharge` / `recharge-wash` | `#A8431A` / `#FCEBE3` | Cargo clearing, freight and courier recharges on the statement, always with the ship icon | 5.21:1 on wash |
| `caution` / `caution-wash` | `#7A4B00` / `#FDF1D6` | Lines on hold or paid elsewhere, flagged statements, unattributed receipts | 6.61:1 on wash |
| `alert` | `#A3261F` | Only the message when data fails to load | 7.2:1 on sheet |

## The seven cost categories

Each category keeps one hue and one lucide icon on every card, bar, legend and panel.
Text never wears these colours; an icon tile or a bar segment does. Fibre containers
carry the container icon.

| Stack | Category | Token | Value | Icon |
|---|---|---|---|---|
| 1 | Payroll and people | `cat-payroll` | `#2F6BC4` | `Users` |
| 2 | Raw material | `cat-raw` | `#B5801C` | `Container` |
| 3 | Working capital | `cat-working` | `#C24D86` | `Wallet` |
| 4 | Compliance and certification | `cat-compliance` | `#3B8A1F` | `BadgeCheck` |
| 5 | Supplier payments | `cat-supplier` | `#6A4FC2` | `Handshake` |
| 6 | Facility | `cat-facility` | `#13A08A` | `Factory` |
| 7 | Logistics and clearance | `cat-logistics` | `#E0612B` | `Ship` |

Validated with the `dataviz` palette validator on `#FFFFFF`, in stack order: every
check passes, worst adjacent colour-blind ΔE 10.8, worst normal-vision ΔE 19.9, every
hue at least 3:1 on white, so white icons on these tiles pass the graphics threshold.
Change a hue or the order and re-run it.

## Type

One family, **Archivo**, self-hosted with its width axis. Headings use the condensed
width. Every figure uses tabular numerals.

| Token | Size / line height | Use |
|---|---|---|
| `display` | 32 / 1.15 | Reserved |
| `figure` | 24 / 1.15 | The amount on a month card; page and panel titles |
| `title` | 20 / 1.25 | Card titles, section headings, tile figures |
| `body` | 15 / 1.55 | Prose |
| `table` | 13 / 1.4 | Lines, lists, controls |
| `small` | 11.5 / 1.35 | Secondary lines, badges |

## Shape and depth

- **Radius:** 6px on buttons, chips and icon tiles; 14px (`card`) on cards and tiles;
  18px (`panel`) on the pop-out.
- **Shadow:** `card` at rest, `lift` under the pointer, `panel` for the pop-out. No
  other shadows.
- A card that is shown but not counted (an actuals statement) has a **dashed edge**.

## Components

- **Month card** (`MonthCard`, `LedgerMonthCard`): the whole card is one button. Month,
  period, the main figure, a category bar and icon tiles, then badges for anything
  that needs attention. Grouped by year, newest first, in a 1–4 column grid.
- **Panel** (`src/components/Panel.tsx`): a native modal `<dialog>`. It traps focus,
  starts focus on its title, closes on Escape or a backdrop click, and returns focus
  to the card. It is the page's one moment of motion: 180ms, transform and opacity
  only, and none under reduced motion.
- **Tile** (`Tile`): a summary figure inside a panel. Income is green; the figure the
  panel is about is the single dark tile.
- **Category bar** (`CategoryBar`): a rounded strip of a month's costs by category, with
  the split as text for screen readers.
- **Badge** (`Badge`): neutral, income or caution, always with a word.
- **Status pill** (`StatePill`): an order's status in efdashboard.com's words, green
  when dispatched, blue on its way, amber held or awaiting a PO, grey cancelled.
- **PO files** (`PoDocuments`): each file efdashboard.com holds for a PO, viewable and
  downloadable through this site.
- **Month bars** (`MonthBars`): the shared one-colour monthly chart.

## Print

A4 portrait, 12mm margins. The panel does not print; cards print as a grid.
