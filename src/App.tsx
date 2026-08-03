import { SectionHead, Note } from './components/ui'
import { isPartner } from './redaction'

/**
 * Placeholder shell. Tabs 1 to 3 are the next gate; see BUILD-SPEC.md section 8.
 * Kept deliberately bare so nothing here is mistaken for finished work.
 */
export default function App() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="eyebrow mb-2">EcoFibre and Polyco</p>
      <SectionHead
        n="00"
        title="Position, capacity and configuration"
        lede="The data layer and calculation engine are in place and tested. The tabs are not built yet."
      />
      <div className="space-y-3">
        <Note>
          Running in <strong>{isPartner ? 'partner' : 'internal'}</strong> mode.
        </Note>
        <Note>Next: Tab 1, where we stand with Polyco. See BUILD-SPEC.md section 8.</Note>
      </div>
    </main>
  )
}
