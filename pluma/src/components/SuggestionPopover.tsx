import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Alert } from '../engine/types'
import SuggestionCard from './SuggestionCard'

/**
 * The floating correction card that pops up right next to an underlined error —
 * Grammarly's "layer 3". It anchors to the word's screen rect, flips above the
 * line when there's no room below, and clamps to the viewport so it never spills
 * off-screen. The card body is the very same SuggestionCard used in the side
 * panel, so the inline and list experiences stay identical.
 */
export default function SuggestionPopover({
  alert,
  anchor,
  onAccept,
  onDismiss,
  onAddToDictionary,
  onClose,
}: {
  alert: Alert
  /** viewport rect of the underlined word (from view.coordsAtPos) */
  anchor: { left: number; top: number; bottom: number }
  onAccept: (index: number) => void
  onDismiss: () => void
  onAddToDictionary: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Place after layout so we know the card's real size, then clamp to the window.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const margin = 8
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = anchor.left
    if (left + w + margin > vw) left = vw - w - margin
    if (left < margin) left = margin

    // below the word if it fits, otherwise above it
    let top = anchor.bottom + 6
    if (top + h + margin > vh) {
      const above = anchor.top - h - 6
      top = above >= margin ? above : Math.max(margin, vh - h - margin)
    }
    setPos({ left, top })
  }, [anchor, alert.id])

  // dismiss on outside click, Escape, or scroll/resize (the anchor would move)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    // capture phase so we hear the click before it re-triggers another alert
    document.addEventListener('mousedown', onDown, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="sugg-pop"
      style={{ left: pos?.left ?? anchor.left, top: pos?.top ?? anchor.bottom + 6, visibility: pos ? 'visible' : 'hidden' }}
      role="dialog"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <SuggestionCard
        alert={alert}
        active
        onClick={() => { /* already focused inline */ }}
        onAccept={onAccept}
        onDismiss={onDismiss}
        onAddToDictionary={onAddToDictionary}
      />
    </div>
  )
}
