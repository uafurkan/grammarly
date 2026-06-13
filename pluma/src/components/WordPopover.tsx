import { useEffect, useRef, useState } from 'react'
import { antonyms, contextualSynonyms } from '../engine/datamuse'

/**
 * Thesaurus popover shown when a word is double-tapped in the editor. Fetches
 * context-aware synonyms (and a few antonyms) from Datamuse; picking one
 * replaces the word. Free, keyless; degrades to "no suggestions" offline.
 */
export default function WordPopover({
  word,
  before,
  after,
  x,
  y,
  onPick,
  onClose,
}: {
  word: string
  before: string
  after: string
  x: number
  y: number
  onPick: (replacement: string) => void
  onClose: () => void
}) {
  const [syns, setSyns] = useState<string[] | null>(null)
  const [ants, setAnts] = useState<string[]>([])
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    let alive = true
    ;(async () => {
      const [s, a] = await Promise.all([
        contextualSynonyms(word, before, after, ctrl.signal),
        antonyms(word, ctrl.signal),
      ])
      if (alive) {
        setSyns(s.slice(0, 8))
        setAnts(a.slice(0, 4))
      }
    })()
    return () => { alive = false; ctrl.abort() }
  }, [word, before, after])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // keep the popover on-screen
  const left = Math.min(x, window.innerWidth - 240)
  const top = Math.min(y + 8, window.innerHeight - 200)

  return (
    <div ref={ref} className="word-pop" style={{ left, top }}>
      <div className="word-pop-head">
        <span className="word-pop-word">{word}</span>
        <button className="word-pop-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      {syns === null ? (
        <div className="word-pop-empty">Looking up synonyms…</div>
      ) : syns.length === 0 && ants.length === 0 ? (
        <div className="word-pop-empty">No suggestions found.</div>
      ) : (
        <>
          {syns.length > 0 && (
            <div className="word-pop-group">
              {syns.map((s) => (
                <button key={s} className="word-pop-chip" onClick={() => onPick(s)}>{s}</button>
              ))}
            </div>
          )}
          {ants.length > 0 && (
            <>
              <div className="word-pop-sub">Opposites</div>
              <div className="word-pop-group">
                {ants.map((a) => (
                  <button key={a} className="word-pop-chip word-pop-chip--ant" onClick={() => onPick(a)}>{a}</button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
