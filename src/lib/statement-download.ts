import type { BalancedEntry, StatementView } from './engine/statement'
import {
  buildExportSheet, exportFilename, toCsv, type ExportContext,
} from './engine/statement-export'
import { api } from './api'

/**
 * Turning a sheet into a file the browser saves.
 *
 * The audit entry goes first and the export is refused if it fails, so the log is
 * the authority on what left rather than a note sent afterwards and possibly not
 * at all. AUTH-SPEC section 7.
 */
export type DownloadResult = { ok: true; filename: string } | { ok: false; error: string }

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function toXlsx(
  sheet: ReturnType<typeof buildExportSheet>,
  context: ExportContext,
): Promise<Blob> {
  // Loaded on demand. It is a large library used by one button, and the tabs a
  // reader opens first should not carry it.
  const ExcelJS = await import('exceljs')
  const book = new ExcelJS.Workbook()
  book.creator = 'EcoFibre Bahrain W.L.L.'
  book.created = new Date(context.exportedAt)

  const page = book.addWorksheet('Statement', {
    views: [{ state: 'frozen', ySplit: sheet.header.length + 2 }],
  })

  for (const [label, value] of sheet.header) {
    const row = page.addRow([label, value])
    row.getCell(1).font = { bold: true }
  }
  page.addRow([])

  const head = page.addRow(sheet.columnLabels)
  head.font = { bold: true }
  head.eachCell((cell) => {
    cell.border = { bottom: { style: 'thin' } }
  })

  for (const row of sheet.rows) page.addRow(row)

  if (sheet.nearMissLabel) {
    page.addRow([])
    page.addRow([sheet.nearMissLabel]).font = { italic: true }
    page.addRow(sheet.columnLabels).font = { bold: true }
    for (const row of sheet.nearMissRows) page.addRow(row)
  }

  // Figures are numbers with a number format, not text. An accountant who cannot
  // total a column will not open the file twice.
  for (const index of sheet.numericColumns) {
    page.getColumn(index + 1).numFmt = '#,##0.00;(#,##0.00)'
    page.getColumn(index + 1).alignment = { horizontal: 'right' }
  }
  page.columns.forEach((column) => {
    column.width = 18
  })

  const buffer = await book.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export async function downloadStatement(
  view: StatementView,
  entries: BalancedEntry[],
  context: ExportContext,
  format: 'csv' | 'xlsx',
): Promise<DownloadResult> {
  const logged = await api.post('/api/exports', {
    format,
    from: context.from,
    to: context.to,
    columns: context.columns,
    rows: entries.length,
  })

  if (!logged.ok) {
    return {
      ok: false,
      error:
        logged.status === 401
          ? 'Your session has ended. Sign in again and the export will work.'
          : 'The export could not be recorded in the audit log, so it has not been produced. Try again.',
    }
  }

  const sheet = buildExportSheet(view, entries, context)
  const filename = exportFilename(context, format)

  if (format === 'csv') {
    // The BOM is what makes Excel open a UTF-8 CSV without mangling it.
    save(new Blob(['﻿', toCsv(sheet)], { type: 'text/csv;charset=utf-8' }), filename)
  } else {
    save(await toXlsx(sheet, context), filename)
  }

  return { ok: true, filename }
}
