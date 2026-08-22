# Design tokens

Every value here was read off `https://efdashboard.com` as a computed style on
22 August 2026, not sampled from a screenshot and not approximated. The source
column says which element it came from, so any of it can be checked again.

Where efdashboard has no equivalent, the token is derived from these values and
marked **derived**. Nothing is invented.

## Colour

| Token | Value | Read from |
|---|---|---|
| `paper` | `#FAFAFA` | `body` background |
| `paper-panel` | `#FBFCFA` | `th` background |
| `surface` | `#FFFFFF` | card background |
| `ink` | `#333333` | `body` colour |
| `ink-muted` | `#6D7869` | section description line |
| `ink-faint` | `#7B8578` | `.stock-unit` |
| `ink-strong` | `#263D23` | `.po-number-primary`, `.stock-number` |
| `leaf` | `#507A48` | `h1`, active tab, card top border |
| `leaf-deep` | `#294525` | `h2` section headings |
| `leaf-mid` | `#41613B` | `td` colour |
| `rule` | `#DFE5DC` | `th` bottom border |
| `rule-soft` | `#DAE4D4` | `td` bottom border |
| `rule-field` | `#D8E5CE` | as-at pill border |
| `kicker` | `#71846B` | `.inventory-kicker` |
| `th-ink` | `#687365` | `th` colour |

### Status palette

Read from `.po-state` on the PO tracker. Text on wash, `border-radius: 999px`,
`font-weight: 800`, `font-size: 10.88px`, `padding: 5px 8px`.

| Token | Text | Wash | efdashboard state |
|---|---|---|---|
| `state-good` | `#257443` | `#E6F5EB` | Dispatched |
| `state-info` | `#345C8A` | `#E8F1FB` | Processing |
| `state-plan` | `#70458A` | `#F1E8F7` | Booked |
| `state-watch` | `#8A4A10` | `#FFF0D8` | PO pending |
| `state-critical` | `#AD3029` | `#FDE8E6` | On hold |
| `state-off` | `#625C5C` | `#ECE9E9` | Cancelled |

`state-critical` is the only red. Per REDESIGN-SPEC §2 it stays reserved for
shortfalls, exceptions and placeholders, never as an ordinary accent.

**Tone is never carried by colour alone.** These print into board packs, and
four mid-toned colours are one grey on a monochrome printer. The tile accent
pairs each colour with a border style: plain is solid and pale, leaf solid and
dark, ember dashed, alert dotted. The same rule applies to chart series, which
are distinguished by line style and direct labelling per §6.

**Derived:** `hatch` `#DFE5DC` for the receipts-chart uncovered band, taken from
`rule` because efdashboard has no hatched fill. Greyscale-safe, so it survives a
board pack printout (§6).

## Typography

efdashboard specifies `"Segoe UI", Tahoma, Geneva, Verdana, sans-serif`.

**We use Montserrat instead, deliberately.** Segoe UI is a Windows system font.
It does not resolve on the Macs and phones this is read on, so it falls through
to Tahoma, and copying the stack would copy an intention rather than a result.
Montserrat was already loaded in this project, renders identically everywhere,
and sits closer to the extracted weights than the fallback does. Every size,
weight and tracking below is efdashboard's; only the family differs.

| Role | Size | Weight | Line height | Tracking | Read from |
|---|---|---|---|---|---|
| Page title | 32px | 700 | 51.2px | normal | `h1` |
| Section heading | 23.2px | 700 | 29px | normal | `h2` |
| Category label | 11.52px | 800 | — | 1.3824px, uppercase | `.inventory-kicker` |
| Description line | 14.08px | 400 | 22.528px | normal | section `p` |
| Table header | 11.2px | 800 | — | 0.616px, uppercase | `th` |
| Table cell | 12px | 400 | — | normal | `td` |
| Figure | 16.8px | 750 | 26.88px | normal | `.stock-number` |
| Figure unit | 11.52px | 400 | — | normal | `.stock-unit` |
| Body | 16px | 400 | 25.6px | normal | `body` |

**Kept from this project regardless of the extraction**, per §2: tabular
figures with thousands separators, right-aligned in tables. efdashboard
left-aligns its `td` and uses `font-variant-numeric: normal`; financial figures
have to line up on the decimal, so `.num` keeps `tabular-nums` and tables keep
`text-right` on figure columns.

The figure size above is efdashboard's inline stock number, which is not a
headline tile. §4 asks for at most three figures set large enough to be
remembered, so headline tiles scale that role up while keeping its weight and
colour. Recorded here so the departure is visible rather than silent.

## Shape and spacing

| Token | Value | Read from |
|---|---|---|
| Card radius | 14px | card |
| Card shadow | `0 10px 30px rgba(59,89,54,0.08)` | card |
| Card accent | `border-top: 5px solid #507A48` | `.inventory-toolbar` |
| Card padding | `24px 26px 18px` | `.inventory-toolbar` |
| Card gap | 20px | card `margin-bottom` |
| Field radius | 6px | `.inventory-as-of` |
| Table cell padding | `12px 14px` header, `9px 14px` body | `th`, `td` |
| Tab radius | `5px 5px 0 0` | `.tab.active` |
| Title block | `margin-bottom: 30px` | `h1` parent |

## Section navigation

Tabs sit under the page header. Active is white on the page background with a
`5px 5px 0 0` radius and `#507A48` text at weight 500; inactive is the same
shape without the white fill.

## Structural pattern

Every section opens with three things, per §3:

```
RAW MATERIALS                                    category label, 11.52px/800, uppercase
Stock overview                                   heading, 23.2px/700
Current availability and average daily consumption   description, 14.08px/400
```
