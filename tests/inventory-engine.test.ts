/** The stock of materials, as efdashboard.com held it on 30 September 2026. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildInventory, InventoryPayload } from '../src/engine/inventory'

const payload = InventoryPayload.parse(JSON.parse(readFileSync(new URL('./fixtures/inventory-2026-09-30.json', import.meta.url), 'utf8')))
const inv = buildInventory(payload)
const item = (name: string) => inv.items.find((i) => i.item === name)!

describe('the inventory', () => {
  it('groups the materials as efdashboard.com does: fiber, lamination film, others', () => {
    expect(inv.sections.map((s) => [s.title, s.items.length])).toEqual([
      ['Fiber', 2],
      ['Lamination Film', 5],
      ['Others', 2],
    ])
  })

  it('works out the days of stock left from the average daily use, as efdashboard.com does', () => {
    expect(item('Bagasse Grade A (China)').daysLeft).toBeCloseTo(30.125, 3)
    expect(item('CPET 35 Micron').daysLeft).toBeNull()
  })

  it('flags stock below its minimum', () => {
    expect(inv.items.filter((i) => i.belowMin).map((i) => i.item)).toEqual(['Bagasse Grade A (China)', 'CPET 35 Micron', 'PLA 50 Micron'])
  })

  it('names the material that runs out first', () => {
    expect(inv.shortest?.item).toBe('Bagasse Grade A (China)')
  })

  it('keeps the date efdashboard.com gives for the stock count', () => {
    expect(inv.asOf).toBe('Wednesday 30th September 2026')
  })
})
