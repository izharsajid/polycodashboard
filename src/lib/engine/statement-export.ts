import { COLUMNS, cellValue, type BalancedEntry, type ColumnKey, type StatementView } from './statement'

/**
 * What goes into the file, as data. Pure, so it is tested rather than trusted,
 * and shared by the CSV and the XLSX writers so the two cannot disagree.
 *
 * Section 5: the export is exactly what is on screen. The header block is what
 * makes it a statement rather than a dump of rows.
 */
export type ExportContext = {
  asAt: string
  from: string | null
  to: string | null
  exportedBy: string
  exportedAt: string
  columns: ColumnKey[]
}

export type ExportCell = string | number | null

/**
 * The header block, as label/value pairs.
 *
 * The undated line is not decoration. A filtered range excludes entries that
 * carry no date, so it will not sum to the unfiltered closing balance, and the
 * first person to reconcile a range against their own ledger will hit that
 * difference and assume one of the two is wrong. Stating the count and the net
 * value here answers the question before it is asked.
 */
export function exportHeader(view: StatementView, context: ExportContext): [string, ExportCell][] {
  const period =
    context.from || context.to
      ? `${context.from ?? 'the beginning'} to ${context.to ?? 'the latest entry'}`
      : 'All transactions to date'

  const rows: [string, ExportCell][] = [
    ['Statement of account', null],
    ['Between', 'Eco Fibre Bahrain W.L.L. and Polyco Healthline Ltd'],
    ['Period', period],
    ['Ledger as at', context.asAt],
    ['Opening balance', view.opening],
    ['Movement in period', view.movement],
    ['Closing balance', view.closing],
    [
      'Convention',
      'Funds received from Polyco increase the balance. Delivered value reduces it. A positive balance means EcoFibre holds value yet to be delivered.',
    ],
  ]

  if (view.filtered) {
    rows.push([
      'Entries with no usable date',
      `${view.undated.length} entries, net ${view.undatedTotal.toFixed(2)}, excluded from this range and from the balances above`,
    ])
  } else {
    rows.push([
      'Entries with no usable date',
      `${view.undated.length} entries, net ${view.undatedTotal.toFixed(2)}, listed at the end and included in the closing balance`,
    ])
  }

  if (view.unconfirmedDates > 0) {
    rows.push([
      'Dates not yet confirmed',
      `${view.unconfirmedDates} entries carry a date corrected on import and not yet confirmed against the source workbook`,
    ])
  }

  if (view.nearMisses.length > 0) {
    rows.push([
      'Excluded on a corrected date',
      `${view.nearMisses.length} entries fall outside this range on their corrected date but inside it on the date originally recorded. Listed below the statement, outside the totals.`,
    ])
  }

  rows.push(['Exported by', context.exportedBy])
  rows.push(['Exported at', context.exportedAt])

  return rows
}

export type ExportSheet = {
  header: [string, ExportCell][]
  columnLabels: string[]
  rows: ExportCell[][]
  /** Indexes of the columns holding numbers, for number formatting in XLSX. */
  numericColumns: number[]
  nearMissLabel: string | null
  nearMissRows: ExportCell[][]
}

export function buildExportSheet(
  view: StatementView,
  entries: BalancedEntry[],
  context: ExportContext,
): ExportSheet {
  const chosen = context.columns
    .map((key) => COLUMNS.find((c) => c.key === key))
    .filter((c): c is (typeof COLUMNS)[number] => c !== undefined)

  const toRow = (entry: BalancedEntry) => chosen.map((c) => cellValue(entry, c.key))

  return {
    header: exportHeader(view, context),
    columnLabels: chosen.map((c) => c.label),
    rows: entries.map(toRow),
    numericColumns: chosen.flatMap((c, i) => (c.numeric ? [i] : [])),
    nearMissLabel:
      view.nearMisses.length > 0
        ? 'Excluded from the range on a corrected date, shown for completeness and not included in any total above'
        : null,
    // These carry no running balance, because they are not part of the sequence.
    nearMissRows: view.nearMisses.map((entry) => toRow({ ...entry, balance: Number.NaN })),
  }
}

/** `2026-01-01` to `20260101`. Undated ends of a range read as the data's own edge. */
function stamp(day: string | null, fallback: string): string {
  return day ? day.replace(/-/g, '') : fallback
}

export function exportFilename(context: ExportContext, extension: 'csv' | 'xlsx'): string {
  const from = stamp(context.from, 'start')
  const to = stamp(context.to, stamp(context.asAt, 'latest'))
  return `ecofibre-polyco-statement-${from}-to-${to}.${extension}`
}

/** RFC 4180. A field containing a comma, a quote or a newline is quoted. */
function csvField(value: ExportCell): string {
  if (value === null || (typeof value === 'number' && Number.isNaN(value))) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(sheet: ExportSheet): string {
  const lines: string[] = []

  for (const [label, value] of sheet.header) {
    lines.push(`${csvField(label)},${csvField(value)}`)
  }
  lines.push('')
  lines.push(sheet.columnLabels.map(csvField).join(','))
  for (const row of sheet.rows) lines.push(row.map(csvField).join(','))

  if (sheet.nearMissLabel) {
    lines.push('')
    lines.push(csvField(sheet.nearMissLabel))
    lines.push(sheet.columnLabels.map(csvField).join(','))
    for (const row of sheet.nearMissRows) lines.push(row.map(csvField).join(','))
  }

  return lines.join('\r\n')
}
