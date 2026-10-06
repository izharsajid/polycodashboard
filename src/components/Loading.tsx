/**
 * What a tab looks like while its data arrives: the shape of the page in quiet
 * blocks, so the wait reads as progress rather than as a blank. The label is
 * what a screen reader hears.
 */
export default function Loading({ label }: { label: string }) {
  const block = 'rounded-card bg-sheet/80 motion-safe:animate-pulse'
  return (
    <div className="space-y-6 pt-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="space-y-2">
        <div className="h-7 w-48 rounded-[6px] bg-sheet/80 motion-safe:animate-pulse" />
        <div className="h-4 w-full max-w-xl rounded-[6px] bg-sheet/60 motion-safe:animate-pulse" />
      </div>
      <div aria-hidden className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-[84px] ${block}`} />
        ))}
      </div>
      <div aria-hidden className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`h-40 ${block}`} style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
    </div>
  )
}
