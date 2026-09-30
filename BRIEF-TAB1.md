# Build brief: EcoFibre Funding Dashboard, Tab 1 "Funds Requested"

This brief is the specification. Read it fully before writing any code. Where it pins
down a decision, follow it exactly. Where it leaves an axis free, make a deliberate
choice and tell me what you chose and why.

---

## 0. Context you need

EcoFibre Bahrain W.L.L. manufactures moulded bagasse fibre packaging in Bahrain
Investment Park, Al-Hidd. Polyco Healthline Ltd (PHL), a UK company, funds EcoFibre's
monthly operations against a monthly "Financial Overview" statement that EcoFibre
issues. Each statement is a line-itemised request for the cash needed to run the
factory that month: raw fibre containers, payroll, rent, utilities, supplier payments,
government labour levies, certification, clearance.

**The audience for this dashboard is Polyco's executive management and board.** They
are not accountants. They will look at it for ninety seconds before a call. They need
to leave knowing: what did EcoFibre ask for, what is it spent on, and is the run rate
going up or down. They must not have to hunt.

This is a factory. Heavy industry, fibre, presses, containers, shift work. Not a
fintech SaaS product. The design should feel like it belongs to a manufacturing
business with real assets, not a startup metrics page.

---

## 1. Scope, and what to delete

We are rebuilding from scratch. The existing repo is too static and too bland and its
design is not worth carrying forward.

**Delete:**
- All existing tab components and their engine code
- `data/polyco-ledger.json`, `data/po-tracker.json`, `data/machine-schedule.json`
- The existing design system, chart wrapper, and UI component library
- All existing tests tied to the deleted engine

**Keep:** the Vite + React + TypeScript toolchain, the Netlify config, the test runner.

**Build:** one tab only, "Funds Requested". Ship it complete and polished before
anything else exists. Three more tabs follow later (PHL/EcoFibre Statement, Orderbook,
Inventory Levels), so build the shell so a tab can be added without refactoring, but do
not stub them out or show disabled tabs. One tab, done properly.

---

## 2. The data

`data/funds-requested.json` is provided. Shape:

```
{
  source: string,
  currency: "USD",
  statements: [
    {
      id: "2025-06",              // year-month key
      period_start: "2025-06-01",
      period_end: "2025-06-30",
      prepared_date: "2025-05-27" | null,
      kind: "request" | "request_with_actuals" | "actuals",
      stated_total: 227026.0,
      lines: [ { amount: number, description: string, remarks: string | null } ],
      notes: string[]
    }
  ]
}
```

14 statements, June 2025 through July 2026. 149 line items. All figures USD.

**Verified before handover:** every `stated_total` equals the sum of its own lines, to
the cent, in all 14 statements. Do not recompute and display a different number. If
your computed sum ever disagrees with `stated_total`, that is a bug in your code, not
in the data.

### Three data truths the design must handle honestly

1. **October 2025 is not a funding request.** Its `kind` is `actuals`. It is a
   statement of what was actually spent, issued after the fact. It must not be plotted
   in the requested series as though EcoFibre asked for it, and it must not be added
   into any "total requested" figure. Show it, clearly marked as an actuals statement,
   but keep it out of the request totals. Total requested across the 13 genuine
   requests is **USD 2,841,167.50**. Including October wrongly gives 3,059,910.50.
   If your headline shows the second number, you have made the error this paragraph
   exists to prevent.

2. **August 2025 is a hybrid.** `kind` is `request_with_actuals`: a request that also
   carries actual utilisation. It counts as a request.

3. **Four statements do not cover a calendar month.** February 2026 runs 5 Feb to 5 Mar.
   April 2026 runs 10 to 30 Apr. June 2026 runs 10 Jun to 10 Jul. July 2026 runs 15 Jul
   to 15 Aug. The `id` says one month, the period says something else. Never show the
   month label alone on a statement whose period does not match it. The real date range
   travels with it everywhere it appears.

   Consequence: there are coverage gaps no request covers (1 to 4 Feb 2026, 1 to 9 Apr
   2026, 1 to 9 Jun 2026, 11 to 14 Jul 2026, and all of October 2025), and one overlap
   where 1 to 5 March 2026 is claimed by both the February and March statements.
   Surface this. An executive who spots it themselves trusts the dashboard less than one
   who was told.

4. **`prepared_date` is null on the last four statements** (April, May, June, July 2026).
   Show the absence as an absence. Do not print a placeholder date and do not silently
   hide the field.

### Category taxonomy

The line descriptions are free text and inconsistent ("Electricity June", "Electricity
and Water Bill May + June", "Staff Salaries April"). Write a deterministic classifier
that maps each line to exactly one of these seven categories. Keep the mapping in one
readable module with the match rules visible, not scattered through components.

| Category | Catches |
|---|---|
| Raw material | "N Fiber Containers" in all variants (bagasse, unbleached bagasse, bamboo), AKD + wire mesh |
| Payroll and people | Staff salaries, director payroll, GOSI + LMRA labour taxes, staff accommodation, work visa renewals, staff medical insurance |
| Facility | Factory rental, electricity, water, factory insurance |
| Supplier payments | All "Supplier Payments" lines |
| Compliance and certification | BRC, ISO, BRC maintenance, product recall insurance |
| Logistics and clearance | Cargo clearance, tool clearance, courier and FedEx, customs duty refund |
| Working capital | Monthly petty cash |

Write a test that asserts every one of the 149 lines classifies into exactly one
category and that no line falls through to an "other" bucket. If a line will not
classify, fix the rule, do not add a catch-all.

**One line is negative:** a customs duty refund of -19,110 in January 2026. It must
render as a credit, not as a rendering bug or an absolute value.

---

## 3. What the tab must answer

In priority order. The layout should follow this order down the page.

1. What is the monthly funding requirement, and is it trending up or down?
2. What is the money spent on, and how has that mix shifted?
3. What did a specific month ask for, line by line?
4. Where are the gaps and irregularities in the statement record?

Nothing else. Resist adding metrics because they are computable. Every element on the
page earns its place by answering one of those four questions.

---

## 4. Design direction

Read the `frontend-design` skill before you start and follow its two-pass process:
produce a compact token system and a layout plan first, review that plan against this
brief and against the generic-default traits the skill lists, revise anything that
reads as a default, and only then write code. Show me the plan before you build.

### Pinned decisions

These are not free axes. Follow them.

- **Not a cream background with a terracotta accent.** Not a near-black page with one
  acid accent. Not identical rounded cards with identical soft shadows. Those are the
  tells and this brief explicitly rejects them.
- **Colour carries meaning, never decoration.** The seven categories get seven
  distinguishable hues and those hues are then consistent across every chart, legend,
  table row marker and detail view on the page. A reader learns the colour once. Do not
  use a gradient as decoration anywhere.
- **The three statement kinds are visually distinct** at a glance: request,
  request with actuals, actuals only. This is the distinction executives get wrong.
- **One bold element.** Pick the single most memorable thing on the page and let
  everything around it stay quiet. Probably the monthly requirement chart. Your call,
  but make it deliberately and spend the boldness only once.
- **Print cleanly to A4 portrait.** This will be printed and taken into a board meeting.
  Charts must survive without their hover states, colour must survive greyscale via
  ordering or pattern, and nothing may be clipped.

### Free axes

Typography, palette hues, layout structure, chart forms, the hero treatment, motion.
Make real choices grounded in the subject matter: moulded fibre, pressed sheet,
industrial Bahrain, containers and shifts. Two typefaces at most, one is fine.

### Interaction

The complaint about the current build is that it is static. Fix that with interaction
that answers a question, not with animation that decorates.

- Selecting a month anywhere updates everything else on the page. One selection model,
  no duplicated state.
- Category filtering: toggle a category and see the monthly requirement recompose.
- Hover and focus on any chart element gives the exact figure, the category, and the
  date range, not a bare number.
- A month-over-month comparison the reader controls: pick any two statements and see
  the delta by category, with the largest movers surfaced first.
- Every interactive element is keyboard reachable with a visible focus ring. Respect
  `prefers-reduced-motion`.
- Mobile down to 375px. Charts reflow, they do not scroll sideways off the page.

### Icons

Use a real icon set, `lucide-react`. Icons label categories and actions. They never sit
next to a heading purely as ornament.

---

## 5. Engineering standards

- React + TypeScript, strict mode, no `any`.
- Zod or equivalent schema validation on the JSON at load. Fail loudly on a shape
  mismatch rather than rendering `undefined`.
- All derived numbers come from one pure engine module with no React imports. Components
  render, they do not calculate. This matters because the same figures will later be
  reconciled against the PHL ledger, and two divergent calculations would be worse than
  none.
- Money formatting in exactly one place. USD, thousands separators, two decimals where
  the source carries cents.
- Unit tests on the engine: the 13-request total of 2,841,167.50, the October exclusion,
  every statement footing to its own `stated_total`, the full 149-line classification,
  the negative line, and the gap and overlap detection.
- No dead code from the old build left behind.

---

## 6. Definition of done

- `npm run build` clean, `npm test` green, TypeScript with zero errors.
- A Polyco director can open it cold and answer all four questions in section 3 without
  being shown how.
- October 2025 is visibly not a request and is excluded from request totals.
- The four irregular periods carry their real date ranges wherever they appear.
- Gaps, the March overlap, and the four missing prepared dates are surfaced, not buried.
- It prints to A4 without clipping.
- Nothing on the page is there because it was easy to compute.

---

## 7. How to work

Plan first, in writing. Show me the token system and the layout concept before you build
anything. I would rather spend a round on the plan than see a finished page built in the
wrong direction.

Do not invent figures. Every number on screen traces to `funds-requested.json`. If
something looks wrong in the data, raise it, do not correct it silently.

Work on a branch, not on `main`.
