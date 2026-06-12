import { useEffect, useState } from 'react'
import type { Alert } from '../engine/types'

interface Props {
  alert: Alert
  active: boolean
  onClick: () => void
  onAccept: (index: number) => void
  onDismiss: () => void
  onAddToDictionary?: () => void
  /** optional location label shown instead of the category (used in sheets) */
  location?: string
}

/**
 * One suggestion. When an error has several candidate fixes, they're navigable
 * with ◀ ▶ above the card ("2 / 4") and Accept applies the one on screen —
 * several smart options per error, not a single guess.
 */
export default function SuggestionCard({
  alert,
  active,
  onClick,
  onAccept,
  onDismiss,
  onAddToDictionary,
  location,
}: Props) {
  const [idx, setIdx] = useState(0)
  const n = alert.replacements.length

  // reset selection if this card is recycled for a different alert
  useEffect(() => setIdx(0), [alert.id])

  const current = alert.replacements[Math.min(idx, Math.max(0, n - 1))]
  const move = (delta: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setIdx((i) => (i + delta + n) % n)
  }

  return (
    <div className={`alert-card${active ? ' active' : ''}`} onClick={onClick}>
      <div className="cat">
        <span className={`dot dot--${alert.category}`} />
        {location ?? alert.category}
      </div>

      {n > 1 && (
        <div className="sugg-nav" onClick={(e) => e.stopPropagation()}>
          <button className="sugg-arrow" onClick={move(-1)} aria-label="Previous suggestion">◀</button>
          <span className="sugg-count">{Math.min(idx, n - 1) + 1} / {n}</span>
          <button className="sugg-arrow" onClick={move(1)} aria-label="Next suggestion">▶</button>
        </div>
      )}

      <div className="change">
        <span className="from">{alert.text.length > 40 ? alert.text.slice(0, 40) + '…' : alert.text}</span>
        {current !== undefined && (
          <>
            {' → '}
            <span className="to">{current}</span>
          </>
        )}
      </div>

      <div className="msg">{alert.message}</div>

      <div className="row">
        {current !== undefined && (
          <button
            className="btn btn--primary"
            onClick={(e) => {
              e.stopPropagation()
              onAccept(Math.min(idx, n - 1))
            }}
          >
            Accept
          </button>
        )}
        {onAddToDictionary && alert.ruleId.endsWith('.spelling') && (
          <button
            className="btn btn--quiet"
            onClick={(e) => {
              e.stopPropagation()
              onAddToDictionary()
            }}
            title="Add this word to your personal dictionary"
          >
            Add to dictionary
          </button>
        )}
        <button
          className="btn btn--quiet"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
