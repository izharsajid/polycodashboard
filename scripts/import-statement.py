"""
Copy the EcoFibre x Polyco statement workbook into data/polyco-statement.json,
exactly as issued.

    python3 scripts/import-statement.py "<workbook.xlsx>" <as-at YYYY-MM-DD>

Nothing is corrected or interpreted here, except that lines for POs in
data/removed-pos.json (cancelled, removed from the dashboard) are left out. Every cell is kept as the workbook
holds it: a date cell becomes YYYY-MM-DD, a text cell stays text, "#REF!" stays
"#REF!". Parsing, matching to efdashboard.com and finding discrepancies all
happen in src/engine/statement.ts, where they are tested. The as-at date is
given on the command line, never taken from the filename (polyco-ledger skill).
"""
import datetime, json, os, re, sys
from openpyxl import load_workbook

src, as_at = sys.argv[1], sys.argv[2]
datetime.date.fromisoformat(as_at)
ws = load_workbook(src, data_only=True).worksheets[0]

COLUMNS = {  # the workbook's own header row, row 6
    1: 'sno', 2: 'ref', 3: 'product', 4: 'po_amount', 5: 'proforma', 6: 'proforma_amount',
    7: 'delivered', 8: 'received', 9: 'received_date', 10: 'loaded',
    11: 'delivered_k', 12: 'pending_l', 13: 'delivery_date',
}

def cell(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime('%Y-%m-%d')
    if isinstance(v, str):
        return v if v.strip() else None
    return v

here = os.path.dirname(__file__)
with open(os.path.join(here, '..', 'data', 'removed-pos.json')) as f:
    removed = json.load(f)['pos']
is_removed = lambda v: v is not None and re.fullmatch(r'(%s)(-\d+)?' % '|'.join(removed), str(v).strip().removesuffix('.0')) is not None

rows, summary = [], []
for r in range(7, ws.max_row + 1):
    values = {name: cell(ws.cell(r, c).value) for c, name in COLUMNS.items()}
    if values['ref'] is None and values['product'] is None and (values['received'] is None or values['sno'] is None):
        # Past the data: the totals row and the labelled summary lines below it.
        if values['po_amount'] is not None and not isinstance(values['po_amount'], str):
            summary.append({'row': r, 'kind': 'totals', **{k: values[k] for k in ('po_amount', 'proforma_amount', 'delivered', 'received', 'delivered_k', 'pending_l')}})
        elif isinstance(values['po_amount'], str):
            summary.append({'row': r, 'kind': 'line', 'label': ' '.join(values['po_amount'].split()), 'value': values['proforma_amount']})
        continue
    if is_removed(values['ref']):
        continue
    rows.append({'row': r, **values})

out = {
    'source': 'EcoFibre x Polyco statement workbook',
    'file': os.path.basename(src),
    'as_at': as_at,
    'rows': rows,
    'summary': summary,
}
dest = os.path.join(os.path.dirname(__file__), '..', 'data', 'polyco-statement.json')
with open(dest, 'w') as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
    f.write('\n')
print(f"{len(rows)} rows, {len(summary)} summary lines, as at {as_at}")
