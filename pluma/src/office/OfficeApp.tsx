import { useEffect, useState } from 'react'
import { check, checkAsync, fingerprint } from '../engine/checker'
import { getPersonalWords, addPersonalWord } from '../engine/personal'
import { analyzeText, analyzeTone, type WritingAnalytics, type ToneScore } from '../engine/analytics'
import { DIALECT_LABELS, type Alert, type Dialect } from '../engine/types'
import SuggestionCard from '../components/SuggestionCard'
import { readDocText, applyReplacement, selectOccurrence, occurrenceBefore } from './word'

/**
 * Pluma inside Word. Reuses the exact same engine as the web app — the only
 * Word-specific code is the Office.js bridge in word.ts. Scans the document on
 * demand, lists issues, and applies a fix straight into the document.
 */
export default function OfficeApp() {
  const [dialect, setDialect] = useState<Dialect>('en-US')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [analytics, setAnalytics] = useState<WritingAnalytics | null>(null)
  const [tone, setTone] = useState<ToneScore | null>(null)
  const [docText, setDocText] = useState('')
  const [busy, setBusy] = useState(false)
  const [checked, setChecked] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(t)
  }, [notice])

  const runCheck = async () => {
    setBusy(true)
    try {
      const text = await readDocText()
      setDocText(text)
      const personal = getPersonalWords()
      const instant = check(text, dialect).filter((a) => !dismissed.has(fingerprint(a)))
      setAlerts(instant)
      const full = await checkAsync(text, dialect, personal)
      setAlerts(full.filter((a) => !dismissed.has(fingerprint(a))))
      const enough = text.trim().split(/\s+/).length >= 30
      setAnalytics(enough ? analyzeText(text) : null)
      setTone(enough ? analyzeTone(text) : null)
      setChecked(true)
    } catch {
      setNotice('Could not read the document.')
    } finally {
      setBusy(false)
    }
  }

  const applyFix = async (alert: Alert, index: number) => {
    const replacement = alert.replacements[index]
    if (replacement === undefined) return
    const occ = occurrenceBefore(docText, alert.text, alert.begin)
    try {
      const ok = await applyReplacement(alert.text, replacement, occ)
      if (!ok) { setNotice('Could not find that text to replace.'); return }
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id))
      window.setTimeout(runCheck, 200)
    } catch {
      setNotice('Could not apply the change.')
    }
  }

  const dismiss = (alert: Alert) => {
    setDismissed((prev) => new Set(prev).add(fingerprint(alert)))
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id))
  }

  const addToDictionary = (alert: Alert) => {
    addPersonalWord(alert.text)
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id))
  }

  const jumpTo = (alert: Alert) => {
    const occ = occurrenceBefore(docText, alert.text, alert.begin)
    void selectOccurrence(alert.text, occ)
  }

  const correctness = alerts.filter((a) => a.category === 'correctness').length

  return (
    <div className="office-pane">
      <div className="office-top">
        <span className="office-brand">Plu<em>ma</em> <span className="office-host">for Word</span></span>
        <select className="dialect" value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)} aria-label="Language">
          {Object.entries(DIALECT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <button className="btn btn--primary office-check" onClick={runCheck} disabled={busy}>
        {busy ? 'Checking…' : checked ? '↻ Re-check document' : 'Check document'}
      </button>

      {checked && (
        <p className="sub office-summary">
          {alerts.length === 0
            ? 'No issues found — nicely done.'
            : `${correctness} correctness · ${alerts.length - correctness} clarity`}
        </p>
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
        ) : (
          alerts.map((a) => (
            <SuggestionCard
              key={a.id}
              alert={a}
              active={false}
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
          and your text stays on your device. Press “Check document” to start.
        </p>
      )}

      {notice && <div className="notice">{notice}</div>}
    </div>
  )
}
