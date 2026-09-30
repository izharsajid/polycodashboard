import { ArrowLeft, X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * The pop-out a month card opens into. A native modal dialog: it traps focus,
 * closes on Escape, makes the page behind it inert, and hands focus back to the
 * card that opened it. A click on the dimmed backdrop closes it too.
 */
export default function Panel({
  open,
  onClose,
  title,
  eyebrow,
  badges,
  onBack,
  children,
}: {
  /** Shown when the panel was reached from another one. */
  onBack?: () => void
  open: boolean
  onClose: () => void
  title: string
  /** A line above the title, such as the period. */
  eyebrow?: string
  badges?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Start on the title, so a screen reader announces the month and the
      // close button is not ringed before anyone has used the keyboard.
      titleRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="panel m-auto max-h-[90vh] w-[min(760px,calc(100vw-24px))] overflow-hidden rounded-panel bg-sheet p-0 text-press shadow-panel"
    >
      <div className="flex max-h-[90vh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {onBack && (
              <button type="button" onClick={onBack} className="btn-text mb-1 min-h-[28px] text-press-2">
                <ArrowLeft size={14} aria-hidden /> Back
              </button>
            )}
            {eyebrow && <p className="text-small text-press-2">{eyebrow}</p>}
            <h2 id={titleId} ref={titleRef} tabIndex={-1} className="condensed text-figure font-bold outline-none">
              {title}
            </h2>
            {badges && <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-press-2 hover:bg-mist hover:text-press"
            aria-label="Close"
          >
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </dialog>
  )
}
