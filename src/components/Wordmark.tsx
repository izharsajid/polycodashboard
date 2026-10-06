/** EcoFibre's name as the page's mark, and whose dashboard this is. */
export default function Wordmark({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className={`condensed text-title font-extrabold tracking-tight ${onDark ? 'text-sheet' : 'text-press'}`}>ECOFIBRE</span>
      <span className={`truncate text-table ${onDark ? 'text-sheet/70' : 'text-press-2'} ${compact ? 'hidden sm:inline' : ''}`}>
        Funding dashboard for Polyco Healthline
      </span>
    </span>
  )
}
