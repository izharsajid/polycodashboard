import type { ReactNode } from 'react'
import Wordmark from './Wordmark'

/**
 * The shell every signed-out page sits in: the wordmark, then one ruled sheet.
 *
 * The wordmark sits above the sheet rather than inside it, because on these
 * pages it is the only thing establishing whose site this is.
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
   * same route.
   */
  title?: string
  lede?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-center">
          <Wordmark />
        </div>

        <div className="overflow-hidden rounded-card border border-rule bg-sheet shadow-card">
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
