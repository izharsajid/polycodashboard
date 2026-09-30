import Wordmark from './Wordmark'

/** Whose dashboard this is, on every page. */
export default function Header() {
  return (
    <header className="border-b-2 border-press bg-sheet">
      <div className="mx-auto flex min-h-[52px] max-w-page items-center px-4 py-2 sm:px-6">
        <Wordmark compact />
      </div>
    </header>
  )
}
