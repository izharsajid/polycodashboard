# Order tracker with documents
## Build specification — Tab 4, "Still to be made"

Read alongside `BUILD-SPEC.md`, `REDESIGN-SPEC.md`, `STATEMENT-SPEC.md`, `AUTH-SPEC.md`
and the `polyco-ledger` skill.

This replaces what `BUILD-SPEC` section 5 says about Tab 3 and takes the tab number the
master statement pushed it to. It follows the layout and filter pattern of efdashboard.com's
purchase order tracker, and it adds a document store against each order.

---

## 1. Where the data comes from

**Not the statement ledger.** `polyco-ledger.json` has a PO number, product text, a
delivered value and a loaded flag. It has no order status, no cargo-ready date, no dispatch
date, no film usage and no remarks, so none of the filters this tab needs can be built from
it.

The source is **efdashboard.com's `po_data` table in Supabase**, which already carries all
of it. Pull it with `scripts/import-po-tracker.ts` into `data/po-tracker.json`, stamped with
the time of the pull, and serve it through the existing authenticated `/api/data` endpoint
alongside the other two files. No second copy of the ledger and no direct browser call to
Supabase.

**This tab is blocked until a read-only Supabase key exists.** Ask for it. Read it from a
Netlify environment variable and a gitignored `.env`, never commit it, and never scrape the
efdashboard page to find it.

**Reconcile against the ledger on every import** and report orders present in one and absent
from the other. That check has repeatedly found real errors and is a standing output, not a
one-off.

---

## 2. Layout, following efdashboard

Same three-part heading as everywhere else: category label, heading, one line saying what
the section shows. Then the last-updated date, which on this tab means the time of the
Supabase pull, not today.

**Filter pills, in rows, each with a live count**, as on efdashboard:

- **Product** — Oasis, PointFive, Destiny, Platinum, Cygnus, NWF, Aspen, Other. These are
  the end customers and product families the orders already carry. Do not add a "customer"
  filter: every order here is Polyco, and the end customer is what these tags are.
- **Dispatch month** — Not dispatched, then each month with orders.
- **Order status** — Dispatched, Booked, Processing, PO pending, On hold, Cancelled.
- **Shipping mode** — sea, air, courier, whatever `po_data` actually holds. If the column
  is absent or mostly empty, leave the row out rather than showing an empty filter, and say
  so in `OPEN-QUESTIONS.md`.

Every filter is multi-select within its row and combines across rows. An "All" pill in each
row clears it. Counts update against the other active filters, so a pill showing zero tells
the reader something rather than lying.

**A summary line** under the pills: how many visible, how many not dispatched, how many
dispatched.

**Search** by PO number or product, top right.

**The table**, grouped with a band heading each group — open and awaiting dispatch first,
then dispatched. Columns: number, PO and product, order status, cargo ready, dispatch, film
usage, remarks, documents.

Order status renders as a pill on a wash, using the `state-*` palette already extracted from
efdashboard in `DESIGN.md`. Do not invent a colour for a status.

Filter and search state persists in the URL, so a link reproduces the view.

---

## 3. Every order opens

A row click opens a detail panel. It shows everything the table shows plus the full order:
values, proforma reference, dates, the matching ledger entries, any data flags, and the
documents.

**The documents section is the point of the panel.**

Two groups, because they answer different questions:

- **Purchase order** — the original PO as issued, and any revision.
- **Delivery** — packing list, invoice, bill of lading, certificate of analysis, inspection
  report, customs paperwork, photographs.

Each document shows its name, type, size, who uploaded it, when, and controls to view and
download. Uploading is a drag-and-drop area with a file picker as well, since not everyone
drags.

---

## 4. Uploads

**Who.** Any signed-in user, EcoFibre or Polyco. Polyco holding their own copy of a PO or a
bill of lading against the same order is exactly what makes a reconciliation call short.
Every upload is attributed and logged, so the record of who added what is complete.

**Only an administrator can delete**, and deletion is soft: the file is marked deleted with
who and when, and stays retrievable. A document store that can lose a bill of landing
without trace is not a record.

**Storage.** Netlify Blobs, a store of its own, keyed `documents:{orderId}:{documentId}`.
Metadata in a separate store so the list renders without pulling the files.

**Limits.** PDF, JPEG, PNG, and the Office formats. 20 MB per file, 20 files per order.
Validate the type by content, not by the filename extension. Reject anything else with a
message saying what is allowed.

**Serving.** Through an authenticated endpoint that checks the session and returns the file
inline for viewing or as an attachment for download. No public URL, no signed link that
outlives the session. A document must never be reachable by anyone who is not signed in —
this is the same failure the ledger had when it sat in the JavaScript bundle.

**Filenames.** Store the original name for display, generate the storage key. Never build a
storage path from user input.

**Audit.** Upload, view, download and delete each write an entry: who, when, which order,
which document. `AUTH-SPEC` section 7 asks for exports and downloads to be logged, and
these are downloads.

---

## 5. Endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/orders` | signed in | the tracker, filtered server side |
| GET | `/api/orders/:id` | signed in | one order with its document list |
| POST | `/api/orders/:id/documents` | signed in | upload |
| GET | `/api/documents/:id` | signed in | view or download |
| DELETE | `/api/documents/:id` | admin | soft delete |

Watch the route collision that `/api/users/:id` already caused with `/api/users/invite`.
Check the paths against a running server, not only against handler tests, since the tests
call handlers directly and cannot see Netlify's router.

Rate limit uploads: 50 per user per hour.

---

## 6. Rules

- Filtering is a pure function in `src/lib/engine`, tested, not logic inside a component.
- A pill count never lies. If a filter would show nothing, it shows zero rather than being
  hidden.
- An order with no documents says so plainly. It does not show an empty area.
- Never trust a filename, a declared MIME type or a client-side size check.
- Never expose a document without a session check on the server.
- Every document action is attributed and logged.
- No figure appears on this tab that is not also derivable from the data behind it.

---

## 7. Sequence

1. The Supabase importer and `po-tracker.json`, with the ledger reconciliation report. Stop
   and show what matched and what did not.
2. The table and the grouping, no filters.
3. Filter pills, counts, search, URL persistence.
4. The order detail panel, without documents.
5. Document storage, upload, listing, authenticated serving, audit entries.
6. Soft delete for administrators.
7. Print and phone pass.

Do not start step 1 until the Supabase key exists.
