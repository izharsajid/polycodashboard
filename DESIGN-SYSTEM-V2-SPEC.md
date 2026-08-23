# Visual system — return to the efdashboard house style
## Replaces DESIGN-SYSTEM-SPEC.md entirely

`DESIGN-SYSTEM-SPEC.md` took the dashboard away from efdashboard's look — serif headings,
no cards, near-monochrome, whitespace instead of containers. That was wrong. EcoFibre
already has a house style, it works, and the two systems should be indistinguishable.

**Delete `DESIGN-SYSTEM-SPEC.md`.** Keep everything in `REDESIGN-2-SPEC.md` except its
visual instructions, which this supersedes: the `$` formatting, the chart choices, the
statement layout, the order drawer and the prose cull all stand.

No figure changes. No engine changes. Tokens below are the computed values already recorded
in the first `DESIGN.md` extraction, so **nothing needs reading off the live site again**.

---

## 1. Typography

Sans throughout. **No serif anywhere.** Retire Source Serif 4.

- **Montserrat** for everything: headings, labels, body, tables. It is the EcoFibre brand
  face and it is close to what efdashboard renders.
- Tabular numerals on every figure, so digits do not shift as values change.
- No monospace.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `kicker` | 11.5px / 1, `0.09em` tracking, uppercase | 800 | Category label above a heading |
| `title` | 23px / 1.25 | 700 | Section heading |
| `lede` | 14px / 1.6 | 400 | The line under a heading |
| `figure-xl` | 30px / 1 | 700 | Headline figures |
| `figure` | 17px / 1.3 | 700 | Values inside a table cell |
| `body` | 14px / 1.6 | 400 | Prose |
| `table-head` | 11px / 1, `0.055em` tracking, uppercase | 600 | Table header |
| `table` | 13px / 1.4 | 400 | Table cell |
| `sub` | 11px / 1.3 | 400 | The grey second line under a value |

---

## 2. Colour

```
page            #FAFAFA   page background
surface         #FFFFFF   cards, table rows
header-tint     #EFF5EA   the tinted block behind a section heading
band            #EDF3E8   table group bands
table-head      #F4F8F1   table header row
rule            #DFE5DC   hairlines
rule-field      #D8E5CE   input borders

ink             #333333   body text
ink-strong      #263D23   headings, figures
ink-muted       #6D7869   descriptions, secondary lines
ink-table       #687365   table header text

leaf            #507A48   the accent — active pills, buttons, links
leaf-deep       #294525   heading green, the accent bar
leaf-kicker     #71846B   kicker text
```

Status palette, used **only** in pills:

```
good      #257443  wash #E6F5EB     dispatched, running
info      #345C8A  wash #E8F1FB     processing
plan      #70458A  wash #F1E8F7     booked
watch     #8A4A10  wash #FFF0D8     PO pending
critical  #AD3029  wash #FDE8E6     on hold, stopped, shortfalls, placeholders
off       #625C5C  wash #ECE9E9     cancelled
```

`critical` is the only red in the system and never appears as decoration.

---

## 3. Structure — the pattern to apply everywhere

Every tab is built from the same four parts, exactly as the efdashboard screens are.

**The card.** White, `14px` radius, `0 10px 30px rgba(59,89,54,0.08)` shadow, and a **5px
`leaf` bar across the top**. One card per section. Content sits inside it, never loose on
the page.

**The tinted header block.** `header-tint` background, inside the top of the card, holding:

- the kicker, uppercase, `leaf-kicker`
- the heading, `title`, `leaf-deep`
- the lede, one line, `ink-muted`
- a last-updated or as-at line in `leaf-deep` bold beneath
- search, right-aligned, a rounded field with a magnifier icon, where the tab has search

**Filter pills.** Rows of them, each row labelled above in `kicker`. Active is `leaf` fill
with white text; inactive is white with a `rule` border. The count sits inside the pill in a
lighter weight. An "All" pill starts each row.

Below the rows, grey summary pills: `47 visible`, `23 not dispatched`.

**The table.** Header row on `table-head`, text in `table-head` style, `ink-table`. Group
band rows on `band` with small bold uppercase `leaf-deep` text and a count. Body rows on
`surface`, `1px rule` between, generous height. No vertical rules anywhere.

Two-line cells where a value has a qualifier: the value in `figure` weight, the qualifier
beneath in `sub` `ink-muted` — `38 Tons` over `Min. 50 Tons`. Use this pattern for any
figure that has a threshold, a target or a unit note.

A small coloured dot before a name where the row has a state. A tiny grey uppercase tag
beneath a product name for its family.

---

## 4. Components

**Status pills.** Rounded full, `11px`, wash background, coloured text, a small dot before
the word. The dot doubles as the greyscale mark.

**Buttons.** Primary `leaf` fill, white text, `6px` radius. Secondary white with a `rule`
border. One primary per screen.

**Fields.** White, `rule-field` border, `6px` radius, `13px` text.

**The tab strip.** Small tabs above the card, active white with a border and rounded top
corners sitting flush against the card, inactive on `page` in `ink-muted`. This is
efdashboard's exact pattern and it should look the same.

**Headline figures.** Inside a card, in a row, each a two-line cell: the figure in
`figure-xl` `ink-strong`, the label above in `kicker`, the descriptor beneath in `sub`.
Divided by `rule` hairlines, not by separate cards.

---

## 5. What carries over from REDESIGN-2

Unchanged and still required: `$` on every monetary figure; negatives in parentheses;
lucide icons in headings, pills, document types and actions; Tab 1 plotting the balance as
one series; Tab 2's variance bars; the statement in the workbook column layout, full bleed
inside its card; the order drawer; one sentence of prose per screen.

Charts use `leaf` for the series carrying the message and `ink-muted` at low opacity for
context. Status colours appear in charts only where they mean the same thing they mean in a
pill.

---

## 6. Apply to every tab

All seven, so nothing is left in the old style: position, funding statements, statement,
orders, machines, forecast, admin. Plus login, invite and account.

---

## 7. Sequence — one run, no stops

1. Tokens: `tailwind.config.js` and `DESIGN.md` rewritten from section 1 and 2 above.
2. The card, tinted header block, tab strip and table styling as shared components.
3. Every tab migrated onto them.
4. Charts recoloured.
5. Print and phone.

Run these as one pass. Commit once per step. Run the full test suite once at the end of
step 3 and once at the end of step 5, not after every file. Verify in the browser once, at
the end, not per step.
