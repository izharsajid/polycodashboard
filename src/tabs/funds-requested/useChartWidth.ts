import { useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

/**
 * The width a chart should draw at: its container's, measured, so text stays at
 * its real size instead of scaling with the page. On paper it is the A4 content
 * width, set before the browser lays out the print, because a resize observer
 * does not fire in time for it.
 */
const PRINT_WIDTH = 690

export function useChartWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  const [printing, setPrinting] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(Math.round(el.clientWidth))
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)

    const before = () => flushSync(() => setPrinting(true))
    const after = () => setPrinting(false)
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      observer.disconnect()
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])

  return { ref, width: printing ? PRINT_WIDTH : width, printing }
}
