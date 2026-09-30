# EcoFibre x Polyco dashboard

Position, capacity and operating-configuration dashboard for Eco Fibre Bahrain W.L.L.
and Polyco Healthline Ltd.

## Getting started

```bash
npm install
npm test        # engine tests, including the exposure figure, and the auth tests
npm run dev
npm run build   # validates data, type-checks, then builds
```

## Where the numbers live

Every business number lives in `/data` and nowhere else. `/src` contains no numeric
literal representing a business fact.

| File | What it holds |
|---|---|
| `data/funds-requested.json` | The 14 monthly Financial Overview statements exactly as issued, 149 lines. The Funds Requested tab. |
| `data/polyco-statement.json` | The PHL/EcoFibre statement workbook copied cell for cell, 194 rows, as at 30 September 2026. Refresh with `python3 scripts/import-statement.py <workbook.xlsx> <as-at>`. |
| `data/ledger-disputes.json` | Workbook dates another document of record contradicts, shown as unresolved |
| `data/po-tracker.json` | The PO Tracker, kept for the Orderbook tab that follows |

## Changing a number

Do not edit a figure in the interface code. Open a pull request against the relevant file
in `/data`. The build validates every file against its schema and fails on a bad value, so
a mistake is caught before it merges — and every change carries an author and a date.

## Access

The dashboard is **open to anyone with the address**. Sign-in, accounts and Netlify's site
password were removed on 1 October 2026 at Izhar's direction. It is kept out of search
results by `public/robots.txt`, a noindex meta tag and an `X-Robots-Tag` header on every
response, but that asks crawlers to stay away; it does not stop anyone who has the link.

The Orderbook's endpoints (`orders`, `order-documents`, `documents`, `exports`) still
check for a session. No session can be created now, so they stay shut until the Orderbook
tab is built and their access is decided.

## Where the figures come from

`/data` is not compiled into the browser bundle. The Funds Requested tab reads `GET /api/data`
the Statement tab reads `GET /api/statement` and `GET /api/tracker`, and the
PO tracker reads `GET /api/tracker` live from efdashboard.com.

## One shared view

EcoFibre and Polyco see the same dashboard and the same figures. One site, one build, no
partner mode and no redaction layer. Read `.claude/skills/partner-disclosure/SKILL.md`
before changing any UI, any data file or any chart.

## Read before working

- `CLAUDE.md` — how to work in this repo
- `BUILD-SPEC.md` — the authoritative brief
- `AUTH-SPEC.md` — authentication and access control
- `OPEN-QUESTIONS.md` — what is still needed
