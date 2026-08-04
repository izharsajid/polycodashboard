---
name: partner-disclosure
description: What Polyco Healthline may and may not see in this dashboard, and how the partner build is separated from the internal build. Use this skill before writing or changing any UI, any data file, any chart, or the redaction layer, and before deploying anything or sharing a URL. Applies even to small changes — a single added field is exactly how a disclosure leak happens.
---

# Partner disclosure

This dashboard is shown to a customer. Two builds, one codebase, controlled by
`VITE_MODE = internal | partner`, deployed as **two separate Netlify sites from two
separate builds** so the partner bundle never contains internal data.

## Whitelist, not blacklist

In partner mode a field is **hidden unless explicitly permitted**. A blacklist leaks the
first time somebody adds a field. There is a CI test asserting no forbidden key appears
in any partner-mode payload; keep it passing and extend it when you add data.

## Permitted in the partner build

- The monthly Financial Overview statements exactly as already issued, every line and
  remark. Polyco has held these since June 2025 and paid against them, so this cost
  detail is already shared.
- The Polyco ledger, the advance position and the reconciliation.
- Total monthly operating cost by machine configuration, in absolute US$.
- Capacity, utilisation, lead times, delivery performance, the order book.
- The roadmap to 8 machines and the order volume each step requires.

## Never in any build, partner or internal

Balance sheet. Bank balances, cash position, treasury. Loans, overdraft, HBTF, interest,
finance cost, debt service, security, covenants. Accumulated losses, profit and loss,
equity, capital accounts. Supplier names, supplier balances, creditor ageing, purchase
prices. Individual salaries or any named person's pay. Raw material unit prices. Gross or
contribution margin. Director or MD expenses. Any other customer or market. Government
support, grants, subsidies, tax.

## Internal build only

Anything derived beneath the shared statements: cost per container, per tonne and per
unit; headcount detail; the underlying build-up of the configuration model.

## Presentation rules

- **Containers per month is the primary unit** on every partner-facing screen. Tonnes and
  units stay in the engine. Polyco plans in POs and containers.
- **Shutdown is a costed column, not a zero.** It carries the cost of holding the site and
  assets, the one-off cost to stop, the one-off cost to restart, and a restart lead time.
  Presenting it as free would be seen through immediately.
- **Placeholders render red** wherever they flow through, and a build with a placeholder
  feeding a headline tile shows a banner saying so.

## Language

Plain and direct, accessible to a non-technical reader. No em dashes. No absolute claims.
No aggressive framing. Never expose internal cost mechanisms, percentage mark-ups or
pricing logic in partner-facing copy — they will be used in the next price negotiation.
Errors explain what happened and how to fix it; they do not apologise and are never vague.

## Before any URL goes to Polyco

Confirm with Izhar. The partner site is a deliberate disclosure, not a deployment step.
