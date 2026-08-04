---
name: manufacturing-finance
description: Analytical standards for financial reasoning and financial presentation in this project — contribution versus absorption, fixed cost absorption, breakeven in physical units, relevant costing, shutdown and restart economics, and the chart and table conventions a board or a bank expects. Use this skill whenever the work involves interpreting a number, deciding what a figure means, choosing what to show, building any chart or table, writing any narrative or insight text, or answering a question about whether something is worth doing. Applies to every tab in this dashboard. If you are about to state what a number implies, read this first.
---

# Manufacturing finance standards

The reader is a board, a bank or a customer's chief operating officer. They are
numerate, sceptical, and short of time. They will accept an uncomfortable finding and
reject a flattering one that does not tie.

## 1. Decide what question is being asked

Three different questions get confused constantly. Name which one you are answering
before you calculate anything.

- **Is the business profitable?** Full absorption. Every cost, including depreciation.
- **Is it worth running this order / this machine / this month?** Contribution. Only the
  cash costs that change if you do it.
- **Is it worth staying open?** Relevant cash costs of staying open against the cash
  costs of closing and reopening.

A configuration can be loss-making on question one and clearly worth running on question
two. Saying "we lose money at two machines" without saying which question you answered
is the single most common error in this kind of analysis, and it leads directly to the
wrong decision.

## 2. Relevant costing

Only **future, incremental cash flows that differ between the options** belong in a
comparison. Everything else is noise dressed as rigour.

Exclude, always:

- Sunk cost. Money already spent on machines, moulds or the building does not appear in
  a decision about what to do next. Not as an argument to keep going, not as a write-off.
- Depreciation. It is an accounting allocation of a sunk cost. It has no place in a
  run-or-stop decision. It belongs in question one only.
- Allocations and apportionments of cost that continue either way.
- Anything common to both options being compared.

Include, always:

- Cash costs that appear or disappear with the decision.
- One-off costs of making the change.
- Costs that continue during a shutdown but would not exist if the entity closed
  permanently. These are relevant to shutdown but not to permanent closure. Different
  question, different answer.
- The time value of a delay, expressed plainly as months lost, not discounted to a false
  precision.

## 3. Fixed cost absorption is the core insight of this dashboard

Cost per unit of output falls hyperbolically as volume rises, because fixed cost spreads
over more units. At low volume the curve is brutally steep. That steepness is the entire
argument against limping along on one or two machines, and it is an argument about a
**ratio**, not an amount.

Build the curve, always:

- x axis: output per month, in containers.
- y axis: fully absorbed cost per container.
- Draw the current selling price as a horizontal line.
- Mark today's actual volume on the curve.
- The crossing point is the minimum viable volume. Label it.

One chart, and the reader sees the whole problem. Do not bury this in a table.

## 4. Express breakeven in physical units first

A board remembers "six containers a month" and forgets "US$ 218,000 a month". Physical
units also survive a price change, which a money figure does not.

Order of presentation, every time: **containers per month, then the money, then the
assumptions the number rests on.**

## 5. Fixed is a statement about a time horizon, not about a cost

No cost is fixed in the abstract. Classify every line by how long it takes to remove and
what it costs to remove it:

| Class | Meaning |
|---|---|
| Unavoidable | Continues while the entity exists, whatever you do |
| Removable with notice | Give the notice period and the cost of removal |
| Volume-linked | Moves with output |
| Contracted | Already committed, with a date |

A cost that takes ninety days and a payment to remove is not fixed and it is not
variable. Saying so precisely is what makes the analysis useful, because the decision is
about timing as much as amount.

## 6. Shutdown economics

Never present a shutdown as costing nothing. Compare four things explicitly:

1. Contribution forgone by not operating.
2. Cash fixed cost avoided.
3. One-off cost to stop.
4. One-off cost to restart, plus the lead time in weeks.

Then state, separately and without putting a number on it unless one exists, what is lost
that money does not immediately buy back: trained operators, certification continuity,
mould condition, supplier terms, customer confidence. Naming these without inventing a
figure is more credible than a made-up figure, and a reader who has run a plant will
respect it.

The decision rule: shut down when the cash fixed cost avoided exceeds the contribution
forgone, **by enough to cover the stop and restart cost over the expected closure
period**. Say what closure period the conclusion depends on. That dependency is usually
the real finding.

## 7. Cash and profit are different questions

Track them separately and never let one stand in for the other.

- An order fulfilled against an existing customer advance produces revenue and consumes
  cash. It produces **no cash receipt**. In this project that distinction is the whole
  commercial question with Polyco.
- Money received against a monthly funding statement is not a sale. It is cash received
  against goods still owed.
- Inventory built and not shipped consumes cash and produces no revenue.

Where a figure could be read either way, label it. "Cash received" and "revenue
recognised" are different words for a reason.

## 8. Uncertainty

- Give a range where the input is uncertain, and say which end the evidence favours.
- Rank the drivers. A reader needs to know which lever moves the answer, not that
  fourteen things could vary. Build a tornado chart when there are more than three.
- Never present a derived figure to more precision than its weakest input. If headcount
  is an estimate, the cost per container is not accurate to the cent.
- An estimate is labelled as an estimate everywhere it flows through, not only where it
  was entered.

## 9. Everything ties

- Every headline figure traces to a function in the engine and to a source in `/data`.
- Reconcile to the source record, never to your own subtotal.
- Where a figure has been restated, show the movement as a labelled line. A silent
  restatement destroys trust in every other number on the page.
- Put the as-at date on every screen. A financial figure without a date is not a
  financial figure.

## 10. Presentation

**Charts.** One message per chart. The title states the finding, not the variable:
"Four machines is the lowest configuration that covers fixed cost", not "Cost by
configuration".

- Waterfall for a bridge between two figures.
- Line for a quantity over time.
- Bar for comparison across categories.
- Curve for absorption and breakeven.
- Never a dual axis. It invites the reader to see a relationship that may not exist.
- Never a pie chart, and never a three-dimensional anything.
- Label series directly on the chart rather than in a legend.
- Always show the denominator. A rate without its base is not information.
- Readable in greyscale. Red is reserved for placeholders and shortfalls, nothing else.

**Tables.** Tabular figures, right aligned, thousands separators, consistent decimals
down a column. Negatives in parentheses, not with a minus sign. Totals ruled, not bolded
into shouting. Units stated once in the header, not repeated in every cell.

**Numbers in prose.** Never a percentage without the base it applies to. Never a
precision the input does not support. Where a movement has two causes, separate them:
say how much came from rate and how much from volume, rather than giving one blended
figure that hides both.

## 11. Writing the insight text

Lead with the decision, not the data. Then the number. Then what it depends on.

> At four machines the operation covers its fixed cost at six containers a month. The
> current order book supports four. The gap is two containers a month, and it closes if
> the Platinum orders ship in September.

Not:

> Analysis of the cost base indicates that various configurations have differing
> breakeven characteristics which should be considered carefully.

Rules:

- State the uncomfortable finding plainly. A reader who suspects you are softening a
  number stops believing the rest.
- Do not hedge to protect yourself. Give the range instead; it is more honest and more
  useful.
- No em dashes. No absolute claims. No filler.
- Never editorialise about the customer or the situation. Present the numbers and what
  they mean; let the reader draw the conclusion.
- Generate insight text from the model, never hand-write it. A sentence that does not
  update when the number updates will eventually be wrong on screen.

## 12. Traps specific to this business

- **Payroll is sized for eight machines while a fraction of that is running.** That is a
  decision being carried, not a fact of nature. Present it as the cost of holding
  capacity, and show what it would be at each configuration.
- **A machine with no available mould is not capacity.** Never count it.
- **Utilisation is not the same as profitability.** A busy plant running low-contribution
  work is worse than an idle one, not better.
- **Freight and clearing recharged to a customer are not margin.** They pass through.
- **The order book is not demand.** Distinguish confirmed purchase orders from forecast,
  and never add them into one number.
- **A single-customer business has no average.** Do not compute averages across periods
  when one customer's decision drives every period. Show the series.
