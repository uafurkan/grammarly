import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { check, checkAsync, fingerprint } from '../engine/checker'
import { getPersonalWords, addPersonalWord } from '../engine/personal'
import { analyzeText, analyzeTone, type WritingAnalytics, type ToneScore } from '../engine/analytics'
import { DIALECT_LABELS, type Alert, type Category, type Dialect } from '../engine/types'
import SuggestionCard from '../components/SuggestionCard'
import { readDocText, applyReplacement, selectOccurrence, occurrenceBefore } from './word'

type Filter = 'all' | Category

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'correctness', label: 'Correctness' },
  { id: 'clarity', label: 'Clarity' },
]

// How often the live checker polls the document for changes while idle. Office.js
// has no reliable "body changed" event, so — like Grammarly's own add-in — we poll.
const LIVE_POLL_MS = 2200

/**
 * Pluma inside Word. Reuses the exact same engine as the web app — the only
 * Word-specific code is the Office.js bridge in word.ts.
 *
 * Beyond a one-shot scan it offers a live mode that re-checks as you type, a
 * click-to-locate flow that selects the flagged text in the document, and
 * category tabs — matching (and going past) what Grammarly's Office add-in does.
 * Inline squiggles on the page are intentionally absent: the Office JavaScript
 * API cannot draw non-persistent underlines, a limit Grammarly hits too.
 */
export default function OfficeApp() {
  const [dialect, setDialect] = useState<Dialect>('en-US')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [analytics, setAnalytics] = useState<WritingAnalytics | null>(null)
  const [tone, setTone] = useState<ToneScore | null>(null)
  const [docText, setDocText] = useState('')
  const [busy, setBusy] = useState(false)
  const [liveBusy, setLiveBusy] = useState(false)
  const [checked, setChecked] = useState(false)
  const [live, setLive] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Refs let the idle poller read the latest values without being torn down and
  // re-created on every keystroke of state — the interval is set up exactly once.
  const liveRef = useRef(live)
  const checkedRef = useRef(checked)
  const runningRef = useRef(false)
  const lastTextRef = useRef('')
  const dialectRef = useRef(dialect)
  const dismissedRef = useRef(dismissed)

  useEffect(() => { liveRef.current = live }, [live])
  useEffect(() => { checkedRef.current = checked }, [checked])
  useEffect(() => { dialectRef.current = dialect }, [dialect])
  useEffect(() => { dismissedRef.current = dismissed }, [dismissed])

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(t)
  }, [notice])

  /**
   * The single source of truth for a scan. `silent` powers the live path: it
   * skips the blocking spinner and the instant-pass flash, and leaves the user's
   * place untouched. `text` lets the poller hand over the body it already read.
   */
  const performCheck = useCallback(async (opts: { silent?: boolean; text?: string } = {}) => {
    if (runningRef.current) return
    runningRef.current = true
    if (opts.silent) setLiveBusy(true)
    else setBusy(true)
    try {
      const text = opts.text ?? (await readDocText())
      lastTextRef.current = text
      setDocText(text)
      const personal = getPersonalWords()
      // On a manual check, paint the instant (sync) pass first so something shows
      // immediately; the live path skips it to avoid a visible flicker.
      if (!opts.silent) {
        setAlerts(check(text, dialectRef.current).filter((a) => !dismissedRef.current.has(fingerprint(a))))
      }
      const full = await checkAsync(text, dialectRef.current, personal)
      setAlerts(full.filter((a) => !dismissedRef.current.has(fingerprint(a))))
      const enough = text.trim().split(/\s+/).filter(Boolean).length >= 30
      setAnalytics(enough ? analyzeText(text) : null)
      setTone(enough ? analyzeTone(text) : null)
      setChecked(true)
      checkedRef.current = true
    } catch {
      if (!opts.silent) setNotice('Could not read the document.')
    } finally {
      runningRef.current = false
      setBusy(false)
      setLiveBusy(false)
    }
  }, [])

  // Idle poller: once a first check has run, watch the document for edits and
  // re-check quietly. Cheap guards keep it from overlapping or doing needless work.
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (!liveRef.current || !checkedRef.current || runningRef.current) return
      let text: string
      try {
        text = await readDocText()
      } catch {
        return
      }
      if (text === lastTextRef.current) return
      void performCheck({ silent: true, text })
    }, LIVE_POLL_MS)
    return () => window.clearInterval(id)
  }, [performCheck])

  // Re-check (quietly) when the dialect changes, but only after the first scan.
  useEffect(() => {
    if (checkedRef.current) void performCheck({ silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialect])

  const applyFix = async (alert: Alert, index: number) => {
    const replacement = alert.replacements[index]
    if (replacement === undefined) return
    const occ = occurrenceBefore(docText, alert.text, alert.begin)
    try {
      const ok = await applyReplacement(alert.text, replacement, occ)
      if (!ok) { setNotice('Could not find that text to replace.'); return }
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id))
      if (activeId === alert.id) setActiveId(null)
      // Let Word settle, then re-scan quietly so the list stays in sync.
      window.setTimeout(() => void performCheck({ silent: true }), 250)
    } catch {
      setNotice('Could not apply the change.')
    }
  }

  const dismiss = (alert: Alert) => {
    setDismissed((prev) => new Set(prev).add(fingerprint(alert)))
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id))
    if (activeId === alert.id) setActiveId(null)
  }

  const addToDictionary = (alert: Alert) => {
    addPersonalWord(alert.text)
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id))
    if (activeId === alert.id) setActiveId(null)
  }

  const jumpTo = (alert: Alert) => {
    setActiveId(alert.id)
    const occ = occurrenceBefore(docText, alert.text, alert.begin)
    void selectOccurrence(alert.text, occ)
  }

  const counts = useMemo(() => ({
    all: alerts.length,
    correctness: alerts.filter((a) => a.category === 'correctness').length,
    clarity: alerts.filter((a) => a.category === 'clarity').length,
  }), [alerts])

  const visible = useMemo(
    () => (filter === 'all' ? alerts : alerts.filter((a) => a.category === filter)),
    [alerts, filter],
  )

  return (
    <div className="office-pane">
      <div className="office-top">
        <span className="office-brand">Plu<em>ma</em> <span className="office-host">for Word</span></span>
        <select className="dialect" value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)} aria-label="Language">
          {Object.entries(DIALECT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <button className="btn btn--primary office-check" onClick={() => void performCheck()} disabled={busy}>
        {busy ? 'Checking…' : checked ? '↻ Re-check document' : 'Check document'}
      </button>

      <div className="office-controls">
        <label className="office-live" title="Re-check automatically as you type">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          <span className="office-live-track"><span className="office-live-thumb" /></span>
          <span className="office-live-text">
            Live
            {live && checked && <span className={`office-live-dot${liveBusy ? ' on' : ''}`} />}
          </span>
        </label>
      </div>

      {checked && (
        <div className="office-tabs" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              className={`office-tab${filter === f.id ? ' on' : ''}`}
              onClick={() => setFilter(f.id)}
              disabled={f.id !== 'all' && counts[f.id] === 0}
            >
              {f.label}<span className="office-tab-n">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      )}

      {analytics && (
        <div className="analytics-block">
          <div className="an-row"><span className="an-label">Readability</span>
            <span className="an-val"><span className={`an-pill an-ease-${Math.floor(analytics.fleschEase / 20)}`}>{analytics.readabilityLabel}</span><span className="an-dim">grade {analytics.fleschGrade}</span></span>
          </div>
          <div className="an-row"><span className="an-label">Avg sentence</span><span className="an-val">{analytics.avgWordsPerSentence} words</span></div>
          <div className="an-row"><span className="an-label">Passive voice</span><span className="an-val">{analytics.passivePct}%{analytics.passivePct > 30 ? <span className="an-warn"> ↑</span> : null}</span></div>
          <div className="an-row"><span className="an-label">Reading time</span><span className="an-val">{analytics.readingMinutes < 1 ? '< 1' : analytics.readingMinutes} min</span></div>
        </div>
      )}

      {tone && (
        <div className="tone-block">
          <div className="tone-head"><span className="an-label">Tone</span><span className="tone-label">{tone.label}</span></div>
          {([['Formal', tone.formal], ['Confident', tone.confident], ['Friendly', tone.friendly], ['Analytical', tone.analytical], ['Tentative', tone.tentative]] as [string, number][]).map(([n, v]) => (
            <div key={n} className="tone-row"><span className="tone-name">{n}</span><span className="tone-bar-wrap"><span className="tone-bar" style={{ width: `${Math.round(v * 100)}%` }} /></span></div>
          ))}
        </div>
      )}

      <div className="office-list">
        {checked && alerts.length === 0 ? (
          <div className="clean"><span className="mark">✓</span>Nothing to flag.</div>
        ) : checked && visible.length === 0 ? (
          <div className="clean"><span className="mark">✓</span>No {filter} issues.</div>
        ) : (
          visible.map((a) => (
            <SuggestionCard
              key={a.id}
              alert={a}
              active={a.id === activeId}
              onClick={() => jumpTo(a)}
              onAccept={(index) => applyFix(a, index)}
              onDismiss={() => dismiss(a)}
              onAddToDictionary={() => addToDictionary(a)}
            />
          ))
        )}
      </div>

      {!checked && (
        <p className="office-hint">
          Pluma checks grammar, spelling, and clarity right inside Word — free,
          and your text stays on your device. Press “Check document” to start;
          leave <b>Live</b> on and it keeps up as you write.
        </p>
      )}

      {notice && <div className="notice">{notice}</div>}
    </div>
  )
}
