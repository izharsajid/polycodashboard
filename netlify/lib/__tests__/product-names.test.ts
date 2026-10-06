import { describe, expect, it } from 'vitest'
import { renamed } from '../efdashboard'

const renames = [
  { from: 'Every Table Tray', to: 'Point Five Tray' },
  { from: 'Every Table Lid', to: 'Point Five Lid' },
  { from: 'Potato Tray', to: 'Destiny 7x7 Tray' },
]

describe("product names in efdashboard.com's feed", () => {
  it('writes every product by the name the dashboard uses, in any text field', () => {
    const feed = renamed(
      {
        rows: [{ po_number: '2679683-3', product: 'Potato tray', qty: 'Every Table Tray: 660 boxes; Every Table Lid: 130 boxes', id: 7 }],
        documents: [{ po: '2679683-3', name: 'Every Table Tray.pdf', title: 'Every Table Tray' }],
      },
      renames,
    )
    expect(feed.rows[0]).toEqual({ po_number: '2679683-3', product: 'Destiny 7x7 Tray', qty: 'Point Five Tray: 660 boxes; Point Five Lid: 130 boxes', id: 7 })
    // A file's name is how it is fetched, so it is left alone; its title is shown.
    expect(feed.documents[0]).toEqual({ po: '2679683-3', name: 'Every Table Tray.pdf', title: 'Point Five Tray' })
  })
})
