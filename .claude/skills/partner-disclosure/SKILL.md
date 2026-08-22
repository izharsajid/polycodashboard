---
name: partner-disclosure
description: What Polyco Healthline sees in this dashboard, which is everything every EcoFibre user sees. One shared view, one build, no redaction layer. Use this skill before writing or changing any UI, any data file or any chart, and before any invitation goes out or any URL is shared. Applies even to small changes, because a single added field is exactly how a disclosure problem starts.
---

# Disclosure

EcoFibre and Polyco operate on a fully transparent basis. There is **one dashboard,
one build, one set of figures**, and every signed-in user sees all of it. There is no
partner mode, no redacted view, no hidden tab, and no `VITE_MODE`. If you find yourself
writing code that shows one user a different number from another, stop: that is not this
project.

The disclosure boundary is **the sign-in, not the build**. Who may see the dashboard is
settled by authentication and the invitation flow in `AUTH-SPEC.md`. What appears on it
is settled here.

## The one exclusion, and it applies to everybody

**Individual salaries and any named person's pay.**

Staff cost appears as a monthly total, exactly as it has appeared on the Financial
Overview statements Polyco has received since June 2025. Per-person pay is personal data
belonging to the employee, not commercial information belonging to EcoFibre, and it is
not ours to disclose to a third party under Bahrain's Personal Data Protection Law.

This is not a restriction aimed at Polyco. It binds every user of the system, including
both administrators, in every view. Individual pay is not in `/data`, not in the
database, not in the API and not rendered anywhere. If a future data file would carry
per-person pay, it does not come into this repository.

## Never in this project at all

These are excluded from the whole project, not from one audience. They are not secrets
being kept from Polyco; they are the wrong material for the question this dashboard
answers, and several of them are other people's confidential information.

Balance sheet. Bank balances, cash position, treasury. Loans, overdraft, HBTF, interest,
finance cost, debt service, security, covenants. Accumulated losses, profit and loss,
equity, capital accounts. Supplier names, supplier balances, creditor ageing, purchase
prices. Individual salaries or any named person's pay. Raw material unit prices. Gross or
contribution margin, unit cost, cost per tonne, cost per unit. Director or MD expenses.
Any other customer or market. Government support, grants, subsidies, tax.

If a calculation appears to need one of these, it is the wrong calculation. Stop and ask.

## Shared, because everything not excluded is shared

- The monthly Financial Overview statements exactly as issued, every line and remark.
- The Polyco ledger, the advance position and the reconciliation.
- Total monthly operating cost by machine configuration, in absolute US$.
- Capacity, utilisation, lead times, delivery performance, the order book.
- Headcount by configuration, and the build-up of the configuration model.
- The roadmap to 8 machines and the order volume each step requires.

The last two used to be internal only. They are not now. What remains excluded is the
list above, and unit cost, cost per tonne and margin stay excluded for everyone, because
section 2 of `BUILD-SPEC.md` keeps them out of the project entirely rather than out of
one audience's view.

## Presentation rules

- **Containers per month is the primary unit** on every screen. Tonnes and units stay in
  the engine. Polyco plans in POs and containers, and so do we.
- **Shutdown is a costed column, not a zero.** It carries the cost of holding the site and
  assets, the one-off cost to stop, the one-off cost to restart, and a restart lead time.
  Presenting it as free would be seen through immediately.
- **Placeholders render red** wherever they flow through, and a build with a placeholder
  feeding a headline tile shows a banner saying so.

## Language

Plain and direct, accessible to a non-technical reader. No em dashes. No absolute claims.
No aggressive framing. Every reader of this dashboard is either a colleague or the
customer, so write for both at once: no internal shorthand, and nothing framed as a
negotiating position. Errors explain what happened and how to fix it; they do not
apologise and are never vague.

## Before anyone outside EcoFibre is let in

Confirm with Izhar. Access is granted by invitation, one address at a time, and an
invitation is a deliberate disclosure rather than a deployment step. See `AUTH-SPEC.md`
section 11 for the order in which the first accounts are released.
