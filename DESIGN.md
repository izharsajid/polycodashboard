# Design tokens

From `DESIGN-SYSTEM-SPEC.md`. This replaces the previous file, which recorded
tokens read off efdashboard.com. That reference has been retired: efdashboard is
an internal operations tool, and this is a document two boards read to make a
decision together.

The register is **an institutional financial document rendered on a screen**.
Typography carries the design. Space and rules replace cards. Figures dominate.

## Typography

Two families loaded, plus the wordmark.

| Role | Family | Weights |
|---|---|---|
| Findings, headings, section titles | Source Serif 4 | 400, 600 |
| Interface, labels, body, tables, every figure | Inter | 400, 500, 600 |
| EcoFibre wordmark, header only | Montserrat | 700 |

Montserrat is retired everywhere except the wordmark. No monospace anywhere:
Inter's `tnum` figures align on the decimal without the typewriter texture.

| Token | Size / line height | Family, weight | Use |
|---|---|---|---|
| `finding` | 30px / 1.25 | Serif 400 | The one sentence at the top of a screen |
| `title` | 21px / 1.3 | Serif 600 | Section heading |
| `subtitle` | 17px / 1.4 | Serif 400 | Block heading inside a section |
| `figure-xl` | 42px / 1 | Inter 600, tnum | Headline figures |
| `figure` | 19px / 1.2 | Inter 600, tnum | Secondary figures |
| `body` | 15px / 1.6 | Inter 400 | Prose |
| `label` | 13px / 1.4 | Inter 400 | Descriptions, captions |
| `eyebrow` | 11px / 1 | Inter 600, 0.14em, uppercase | Category labels, table headers |
| `table` | 13px / 1.5 | Inter 400, tnum | Table cells |

Serif headings are set at 400 and 600 only. Never bolded further, never
letterspaced, never uppercase.

## Colour

Near-monochrome with one accent.

| Token | Value | Use |
|---|---|---|
| `ink` | `#16181A` | Primary text, headings, figures |
| `ink-70` | `#4A4F55` | Body prose |
| `ink-50` | `#6F757C` | Labels, captions, axis text |
| `ink-30` | `#A8ADB3` | Disabled, placeholder |
| `rule` | `#E4E6E8` | Hairline borders, table rules |
| `rule-soft` | `#EFF1F2` | Banding, hover |
| `paper` | `#FCFCFB` | Page background |
| `surface` | `#FFFFFF` | Sticky headers, raised areas |
| `accent` | `#2D5F3F` | The one accent |
| `accent-soft` | `#EDF2EE` | Accent wash, used rarely |
| `watch` | `#A26600` | Watch state |
| `watch-soft` | `#FBF3E4` | Watch wash |
| `critical` | `#9B2C24` | Shortfall, exception, placeholder |
| `critical-soft` | `#FAEDEC` | Critical wash |

### Two corrections to the specified palette

Section 7 sets a 4.5:1 minimum for body text and asks for `ink-50` on `paper` to
be checked and fixed rather than left. Measured on the specified values:

| Token | Specified | Ratio on paper | Corrected to | Ratio |
|---|---|---|---|---|
| `ink-50` | `#71777E` | 4.41 — fails | `#6F757C` | 4.53 |
| `watch` | `#A66A00` | 4.37 — fails | `#A26600` | 4.61 |

`watch` was corrected on the same grounds: it sets 11px pill text, which is body
size. `ink-30` measures 2.20 and is left as specified, because it is used only
for disabled controls and placeholder text, which the contrast minimum exempts.

Everything else in the specified palette passes: `ink` 17.34, `ink-70` 8.05,
`accent` 7.25, `critical` 7.36.

### Rules

- One accent. Active nav, the chart series carrying the message, a primary
  action. Nothing else.
- No coloured background behind a figure. Numbers sit on `paper` or `surface`.
- Red only for a shortfall, an exception or a placeholder.
- Charts are monochrome: the ink ramp for context, `accent` for the message. Two
  colours maximum.
- Every state survives greyscale. If removing colour loses the meaning, there is
  a mark as well.

## Layout

The card is retired. No radius on containers, no shadow, no accent bars. Sections
are separated by space, and by a 1px `rule` hairline where a division is genuinely
needed.

Radius survives in three places only, at 4px: pills, buttons, form fields.

Spacing is an 8px base, exposed as the only steps available:

| Class | Pixels |
|---|---|
| `1` | 8 |
| `2` | 16 |
| `3` | 24 |
| `4` | 32 |
| `6` | 48 |
| `8` | 64 |
| `12` | 96 |

Page gutters 48px desktop and 20px phone; 64px between sections; 24px between a
heading and its content; 8px between a figure and its label. Content is 1280px
wide, except the statement and the order table which are full bleed.

Everything is left-aligned except figures in tables, which are right-aligned.
Nothing is centred.

## What the tailwind config does with this

`theme.colors`, `theme.fontFamily`, `theme.fontSize`, `theme.spacing`,
`theme.borderRadius` and `theme.boxShadow` are **replaced**, not extended. The
previous palette competed with this one, and leaving it within reach means it
returns one class at a time.
