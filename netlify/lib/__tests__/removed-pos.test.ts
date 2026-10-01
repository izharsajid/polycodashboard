import { describe, expect, it } from 'vitest'
import { withoutRemoved } from '../efdashboard'

describe("efdashboard.com's feed, less the POs removed from the dashboard", () => {
  const feed = {
    rows: [{ po_number: '2679682' }, { po_number: '2679682-1' }, { po_number: '2679683-3' }, { po_number: ' 2676085 ' }],
    documents: [{ po: '2678302' }, { po: '2679969' }],
    line_usage: [],
  }

  it('drops every row and file for a removed PO, its suffixed lots included', () => {
    const out = withoutRemoved(feed, ['2679682', '2676085', '2678302'])
    expect(out.rows.map((r) => r.po_number)).toEqual(['2679683-3'])
    expect(out.documents.map((d) => d.po)).toEqual(['2679969'])
  })

  it('leaves a neighbouring PO number alone', () => {
    expect(withoutRemoved(feed, ['267968']).rows).toHaveLength(4)
  })
})
