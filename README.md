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

## Signing in for the first time

There are no default passwords. The first administrator account gets its password from a
script run on a laptop, which asks for it at a prompt and stores only the Argon2id hash:

```bash
export NETLIFY_SITE_ID=...      # from the Netlify project settings
export NETLIFY_BLOBS_TOKEN=...
npm run seed:admin
```

Then create the four accounts that exist so the user list and the admin panel have real
addresses to work against. They are created with no password, no invitation token, and
nothing sent:

```bash
npm run seed:invited
```

Everyone after that is invited and chooses their own password, so no password ever exists
in a message. See `AUTH-SPEC.md` sections 1 and 4.

## Where the figures come from

`/data` is not compiled into the browser bundle. It is served from `GET /api/data`, which
requires a session, and the tabs fetch it once sign-in resolves. Do not import a `/data`
file into anything under `/src`: it would put every figure back into a public asset that
no session guard can protect.

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
