import type { ReactNode } from 'react'

/**
 * The shell every signed-out page sits in. DESIGN-SYSTEM-V2-SPEC section 3:
 * content sits inside a card, never loose on the page.
 *
 * The wordmark sits above the card rather than inside its header block, because
 * on these pages it is the only thing establishing whose site this is, and the
 * header block belongs to the page's own heading.
 */
export default function AuthShell({
  title,
  lede,
  children,
  footer,
}: {
  /**
   * Omitted where the page decides its own heading from state, as the invite and
   * reset pages do: an expired link and a live one are different headings on the
   * same route, and hoisting that decision up here would only move the condition.
   */
  title?: string
  lede?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-baseline justify-center gap-2">
          <span className="text-figure font-extrabold tracking-tight text-leaf-deep">ECOFIBRE</span>
          <span className="text-ink-muted" aria-hidden>/</span>
          <span className="text-table text-ink-muted">Polyco Healthline</span>
        </div>

        <div className="card">
          {title && (
            <header className="card-head">
              <h1 className="title">{title}</h1>
              {lede && <p className="lede mt-1">{lede}</p>}
            </header>
          )}
          <div className="card-body">{children}</div>
        </div>

        {footer && <div className="mt-4 text-center">{footer}</div>}
      </div>
    </main>
  )
}
