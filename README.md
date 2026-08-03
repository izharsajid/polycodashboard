# EcoFibre x Polyco dashboard

Position, capacity and operating-configuration dashboard for Eco Fibre Bahrain W.L.L.
and Polyco Healthline Ltd.

## Getting started

```bash
npm install
npm test        # 14 engine tests, including the exposure figure
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

## Two builds

`VITE_MODE=internal` for us, `VITE_MODE=partner` for Polyco, deployed as two separate
Netlify sites from two separate builds. Read `.claude/skills/partner-disclosure/SKILL.md`
before changing anything the partner build can reach.

## Read before working

- `CLAUDE.md` — how to work in this repo
- `BUILD-SPEC.md` — the authoritative brief
- `OPEN-QUESTIONS.md` — what is still needed
