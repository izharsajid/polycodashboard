# Visual design system
## Complete replacement of the current look

Supersedes `DESIGN.md` and the visual sections of both redesign specs. The efdashboard
tokens were the wrong reference: efdashboard is an internal operations tool, and this is a
document two boards read to make a decision together. They should not look the same.

**Read `/mnt/skills/public/frontend-design/SKILL.md` and use the frontend-design plugin
before writing any of this.**

No figure changes. No engine changes.

---

## 1. The register

This should read as **an institutional financial document rendered on a screen** — closer
to a well-set annual report or an investment memo than to a SaaS dashboard.

Three consequences, and they drive everything below:

- **Typography carries the design**, not colour and not boxes.
- **Space and rules replace cards.** Boxes with shadows and rounded corners read as an app.
  Whitespace and a hairline rule read as a document.
- **Figures dominate.** They are the content. Everything else is apparatus.

What to avoid: rounded cards everywhere, drop shadows, gradients, coloured backgrounds
behind numbers, more than one accent colour, icon-heavy chrome, anything that reads as a
template.

---

## 2. Typography

Three families, each with one job.

| Role | Family | Why |
|---|---|---|
| Findings, headings, section titles | **Source Serif 4** | A serif gives gravity and reads as a document rather than an interface. It is the single strongest signal that this is considered work. |
| Interface, labels, body, tables | **Inter** | Neutral and exceptional at small sizes. Has true tabular numerals. |
| Ledger figures | **Inter, tabular** | Its `tnum` figures align on the decimal without the typewriter texture of a mono. Use mono nowhere. |

Montserrat is retired except in the EcoFibre wordmark in the header, where it stays as the
brand mark.

Load from Google Fonts: `Source+Serif+4:opsz,wght@8..60,400;8..60,600` and
`Inter:wght@400;500;600`. Nothing else. Two families, five weights.

**Scale.** Fixed steps, no ad-hoc sizes.

| Token | Size / line height | Family, weight | Use |
|---|---|---|---|
| `finding` | 30px / 1.25 | Serif 400 | The one sentence at the top of a screen |
| `title` | 21px / 1.3 | Serif 600 | Section heading |
| `subtitle` | 17px / 1.4 | Serif 400 | Block heading inside a section |
| `figure-xl` | 42px / 1 | Inter 600, tnum | Headline figures |
| `figure` | 19px / 1.2 | Inter 600, tnum | Secondary figures |
| `body` | 15px / 1.6 | Inter 400 | Prose |
| `label` | 13px / 1.4 | Inter 400 | Descriptions, captions |
| `eyebrow` | 11px / 1 | Inter 600, `0.14em` tracking, uppercase | Category labels, table headers |
| `table` | 13px / 1.5 | Inter 400, tnum | Table cells |

Findings and titles set in serif at 400 and 600 only. Never bold a serif heading further,
never letterspace it, never set it in uppercase.

---

## 3. Colour

Near-monochrome with one accent. The current six-state palette plus greens plus ember plus
alert is four systems competing.

```
ink            #16181A   primary text, headings, figures
ink-70         #4A4F55   body prose
ink-50         #71777E   labels, captions, axis text
ink-30         #A8ADB3   disabled, placeholder
rule           #E4E6E8   hairline borders, table rules
rule-soft      #EFF1F2   zebra banding, hover
paper          #FCFCFB   page background, very slightly warm
surface        #FFFFFF   raised areas, sticky headers
accent         #2D5F3F   the one accent — EcoFibre green
accent-soft    #EDF2EE   accent wash, used rarely
```

Semantic colour appears **only** in status pills, negative figures and flags:

```
watch          #A66A00   watch-soft   #FBF3E4
critical       #9B2C24   critical-soft #FAEDEC
```

Rules:

- **One accent.** `accent` marks the active nav item, the primary chart series, and a
  primary action. Nothing else.
- **No coloured backgrounds behind figures.** A number sits on `paper` or `surface`.
- **Red only for a shortfall, an exception or a placeholder.** Never as decoration.
- **Charts are monochrome**: the `ink` ramp for context series, `accent` for the series
  that carries the message. Two colours maximum on a chart.
- Every state must survive greyscale. If removing colour loses the meaning, add a mark.

---

## 4. Layout

**Retire the card.** No `border-radius` on containers, no `box-shadow`, no accent bars on
top. Sections are separated by space and, where a division is genuinely needed, a `1px`
`rule` hairline.

Radius survives in exactly three places: pills, buttons and form fields, at `4px`.

**Space.** An 8px base. Use `8 · 16 · 24 · 32 · 48 · 64 · 96`. Nothing between.

- Page gutters: `48px` desktop, `20px` phone
- Between sections: `64px`
- Between a heading and its content: `24px`
- Between a figure and its label: `8px`
- Content width: `1280px` for standard tabs, **full bleed for the statement and the order
  table**, which are ledgers and need the room

**Alignment.** Everything left-aligned except figures in tables, which are right-aligned.
Nothing centred. Ever.

**Density.** Generous. Confidence reads as space. A screen showing four things well beats
one showing nine.

---

## 5. Components

**Headline figures.** No box. The figure in `figure-xl`, the label in `eyebrow` above it,
the descriptor in `label` beneath, separated from its neighbours by space and a vertical
hairline. Three across on desktop, stacked on a phone.

```
RECEIVED FROM POLYCO          VALUE DELIVERED          ADVANCE NOT YET COVERED
$5,771,015                    $3,657,722               $1,410,206
Cumulative, all periods       Shipped and recharged     After the open book ships
```

**Section heading.** Eyebrow, serif title, one line of `label` description, and the as-at
date right-aligned on the title line. Then `24px` of space. No rule beneath unless the
section is a table.

**Tables.** Header row in `eyebrow` on `surface`, a `rule` hairline beneath it, no vertical
rules at all, no zebra by default. Row hover in `rule-soft`. Row height `40px`. A hairline
above the totals row and nothing else.

**Pills.** `4px` radius, `11px` uppercase text, a semantic wash background, a small icon
before the word. Used for status only.

**Buttons.** Primary is `accent` fill, white text, `4px`. Secondary is a `rule` border on
`surface`. Text buttons for anything tertiary. One primary action per screen.

**The nav.** A single row of text items under the header. Active is `ink` with a `2px`
`accent` underline. Inactive is `ink-50`. No pills, no boxes, no background fills.

**The header.** EcoFibre wordmark in Montserrat, a hairline separator, "Polyco Healthline"
in `ink-50`. Signed-in user and sign-out on the right. `64px` tall, `rule` hairline beneath.

---

## 6. Charts

- Two colours maximum: `accent` for the series carrying the message, `ink-30` for context.
- No gridlines on the x axis. Horizontal gridlines in `rule`, and only as many as the
  reader needs — usually three or four.
- Axis text in `ink-50` at 11px. Y axis money as `$0`, `$1m`, `$2m`.
- Label the series directly on the plot at its end point. A legend only when direct
  labelling genuinely will not fit.
- The chart title states the finding in `subtitle`, not the variable.
- No animation on load. No tooltips carrying a figure that is nowhere else on the page.
- Readable in greyscale.

---

## 7. Detail that separates good from adequate

- Tabular numerals **everywhere** a figure appears, including tiles and charts, so digits
  do not shift as values change.
- Consistent decimals down a column. Never two decimals on one row and none on the next.
- Dates in one format throughout: `28 July 2026` in prose, `28 Jul 2026` in tables. Never
  numeric.
- Every focusable element has a visible focus ring in `accent`.
- Minimum contrast 4.5:1 for body text, 3:1 for large. Check `ink-50` on `paper` and fix it
  if it fails rather than leaving it.
- Loading states hold the layout rather than collapsing it. No spinners in place of content.
- Empty states say what to do, not that nothing is here.
- `prefers-reduced-motion` respected.
- Print: `paper` becomes white, nav and controls hidden, tables repeat their header, one or
  two pages per tab.

---

## 8. Sequence

1. **Tokens.** Fonts loaded, `tailwind.config.js` rewritten, `DESIGN.md` replaced. Show one
   screen before going further.
2. **Header, nav, section headings** across all tabs.
3. **Retire the card** everywhere. Figures, tables and panels reworked to space and rules.
4. **Charts** to the new palette and labelling.
5. **Pills, buttons, forms, drawers.**
6. **Print and phone pass**, verified on a real device.

Tests stay green. If something looks wrong at a step, stop and say so rather than
compensating with a colour or a box.
