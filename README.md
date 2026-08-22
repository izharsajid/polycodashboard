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
| `data/polyco-ledger.json` | The Polyco statement ledger, 174 rows, generated from the source workbook |
| `data/monthly-funding-statements.json` | The 14 monthly Financial Overviews and their reconciliation to the ledger |

## Changing a number

Do not edit a figure in the interface code. Open a pull request against the relevant file
in `/data`. The build validates every file against its schema and fails on a bad value, so
a mistake is caught before it merges — and every change carries an author and a date.

## One shared view

EcoFibre and Polyco see the same dashboard and the same figures. One site, one build, no
partner mode and no redaction layer. Access is controlled by sign-in, and the only thing
withheld from anyone is individual pay. Read
`.claude/skills/partner-disclosure/SKILL.md` before changing any UI, any data file or any
chart.

## Read before working

- `CLAUDE.md` — how to work in this repo
- `BUILD-SPEC.md` — the authoritative brief
- `AUTH-SPEC.md` — authentication and access control
- `OPEN-QUESTIONS.md` — what is still needed
