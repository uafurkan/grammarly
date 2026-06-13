import { useState } from 'react'
import type { OverlapMatch, Source } from '../engine/originality'
import {
  getWebConfig,
  setWebConfig,
  getQuota,
  type FoundSource,
} from '../engine/source-finder'

/**
 * Shared Originality panel — sources, the academic source finder, and the
 * overlap list. Used by both the text editor and the PDF editor. Quote/cite
 * actions are optional (the PDF view can't insert into the document).
 */
export default function OriginalityPanel({
  sources,
  overlaps,
  score,
  activeId,
  phase,
  onCompare,
  onAdd,
  onRemove,
  onJump,
  onQuote,
  onCite,
  onFind,
  onAddFound,
}: {
  sources: Source[]
  overlaps: OverlapMatch[]
  score: { overlapPercent: number; verbatim: number; paraphrase: number }
  activeId: string | null
  /** comparison lifecycle: 'idle' = sources changed, results stale; 'comparing' = running; 'done' = fresh results shown */
  phase: 'idle' | 'comparing' | 'done'
  onCompare: () => void
  onAdd: (label: string, text: string) => void
  onRemove: (id: string) => void
  onJump: (id: string) => void
  onQuote?: (m: OverlapMatch) => void
  onCite?: (m: OverlapMatch) => void
  onFind: () => Promise<FoundSource[]>
  onAddFound: (s: FoundSource) => void
}) {
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [finding, setFinding] = useState(false)
  const [found, setFound] = useState<FoundSource[] | null>(null)
  const [findError, setFindError] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [webEngines, setWebEngines] = useState(() => ({
    google: getWebConfig('google') !== null,
    brave: getWebConfig('brave') !== null,
    serper: getWebConfig('serper') !== null,
    bing: getWebConfig('bing') !== null,
  }))
  const [webSetup, setWebSetup] = useState<'google' | 'brave' | 'serper' | 'bing' | null>(null)
  const [webKey, setWebKey] = useState('')
  const [webCx, setWebCx] = useState('')

  const runFind = async () => {
    setFinding(true)
    setFindError(null)
    setFound(null)
    try {
      const results = await onFind()
      setFound(results)
      if (results.length === 0) setFindError('No close academic matches found. Try writing a bit more first.')
    } catch {
      setFindError('Could not reach the academic databases. Check your connection and try again.')
    } finally {
      setFinding(false)
    }
  }

  return (
    <>
      <h2>Originality</h2>
      <p className="sub">
        Compares your writing against sources you add — verbatim and paraphrased —
        so you can quote or cite them. A self-check, not a verdict.
      </p>

      <div className="src-list">
        {sources.map((s) => (
          <div key={s.id} className="src-row">
            <span title={s.text.slice(0, 200)}>{s.label}</span>
            <button className="btn btn--quiet btn--danger" onClick={() => onRemove(s.id)}>Remove</button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="src-add">
          <input
            placeholder="Source label (e.g. Smith 2021)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <textarea
            placeholder="Paste the source text here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
          />
          <div className="row">
            <button
              className="btn btn--primary"
              disabled={text.trim().length === 0}
              onClick={() => {
                onAdd(label, text)
                setLabel('')
                setText('')
                setAdding(false)
              }}
            >
              Add source
            </button>
            <button className="btn btn--quiet" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setAdding(true)}>
          + Add a source
        </button>
      )}

      <div className="find-box">
        <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} onClick={runFind} disabled={finding}>
          {finding ? 'Searching academic databases…' : '✦ Find sources for me'}
        </button>
        <p className="find-note">
          Searches 6 free academic databases automatically (OpenAlex, Crossref,
          Semantic Scholar, arXiv, Europe PMC, DOAJ).
          Connect a web-search engine below to also search the open web.
        </p>

        <div className="web-engines">
          {(
            [
              { id: 'google', label: 'Google', needsCx: true, hint: 'API key + Search engine ID (cx) from programmablesearchengine.google.com' },
              { id: 'brave',  label: 'Brave',  needsCx: false, hint: 'Subscription token from api.search.brave.com · 2 000 free/month' },
              { id: 'serper', label: 'Serper', needsCx: false, hint: 'API key from serper.dev · 2 500 free searches' },
              { id: 'bing',   label: 'Bing',   needsCx: false, hint: 'API key from Azure portal (Bing Search v7) · 1 000 free/month' },
            ] as const
          ).map(({ id, label, needsCx, hint }) =>
            webSetup === id ? (
              <div key={id} className="src-add">
                <input
                  placeholder={needsCx ? 'API key' : `${label} API key`}
                  value={webKey}
                  onChange={(e) => setWebKey(e.target.value)}
                />
                {needsCx && (
                  <input
                    placeholder="Search engine ID (cx)"
                    value={webCx}
                    onChange={(e) => setWebCx(e.target.value)}
                  />
                )}
                <p className="find-note">{hint}. Stored only in this browser.</p>
                <div className="row">
                  <button
                    className="btn btn--primary"
                    disabled={!webKey.trim() || (needsCx && !webCx.trim())}
                    onClick={() => {
                      setWebConfig(id, { key: webKey.trim(), ...(needsCx ? { cx: webCx.trim() } : {}) })
                      setWebEngines((prev) => ({ ...prev, [id]: true }))
                      setWebSetup(null)
                      setWebKey('')
                      setWebCx('')
                    }}
                  >
                    Save
                  </button>
                  <button className="btn btn--quiet" onClick={() => { setWebSetup(null); setWebKey(''); setWebCx('') }}>Cancel</button>
                </div>
              </div>
            ) : webEngines[id] ? (
              (() => {
                const q = getQuota(id)
                const pct = Math.round((q.remaining / q.limit) * 100)
                return (
                  <div key={id} className="engine-row">
                    <div className="engine-bar-wrap">
                      <div className="engine-bar" style={{ width: `${pct}%`, background: pct > 30 ? 'var(--accent)' : '#e57' }} />
                    </div>
                    <span className="engine-quota">{q.remaining.toLocaleString()} / {q.limit.toLocaleString()} left</span>
                    <span className="engine-name">{label}</span>
                    <button
                      className="btn btn--quiet btn--danger"
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={() => {
                        setWebConfig(id, null)
                        setWebEngines((prev) => ({ ...prev, [id]: false }))
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                )
              })()
            ) : (
              <button key={id} className="btn btn--quiet" onClick={() => { setWebSetup(id); setWebKey(''); setWebCx('') }}>
                + {label} Search
              </button>
            )
          )}
        </div>

        {findError && <div className="find-msg">{findError}</div>}

        {found && found.length > 0 && (
          <div className="found-list">
            {found.map((s) => (
              <div key={s.id} className="found-card">
                <div className="found-top">
                  <span className="found-pct">{Math.round(s.similarity * 100)}%</span>
                  <a href={s.url} target="_blank" rel="noreferrer" className="found-title">{s.title}</a>
                </div>
                <div className="found-meta">
                  {s.authors || 'Unknown authors'}{s.year ? ` · ${s.year}` : ''} · {s.via}
                </div>
                <button
                  className="btn btn--quiet"
                  disabled={addedIds.has(s.id)}
                  onClick={() => {
                    onAddFound(s)
                    setAddedIds((prev) => new Set(prev).add(s.id))
                  }}
                >
                  {addedIds.has(s.id) ? '✓ Added — press Compare' : 'Add as source'}
                </button>
              </div>
            ))}
            <p className="find-note">Match % is keyword-based — open a source to judge real relevance.</p>
          </div>
        )}
      </div>

      <div style={{ height: 18 }} />

      {sources.length > 0 && (
        <button
          className="btn btn--primary compare-btn"
          onClick={onCompare}
          disabled={phase === 'comparing'}
        >
          {phase === 'comparing'
            ? 'Comparing…'
            : phase === 'done'
            ? '↻ Compare again'
            : `Compare against ${sources.length === 1 ? 'this source' : `${sources.length} sources`} →`}
        </button>
      )}

      {phase === 'done' && sources.length > 0 && (
        <div className="orig-score">
          <span className="pct">{score.overlapPercent}%</span>
          <span className="lbl">
            of your text overlaps your sources<br />
            {score.verbatim} verbatim · {score.paraphrase} paraphrased
          </span>
        </div>
      )}

      {sources.length === 0 ? (
        <div className="clean">Add the sources you used, then press Compare to see where your draft overlaps them.</div>
      ) : phase !== 'done' ? (
        <div className="clean">
          {phase === 'comparing'
            ? 'Comparing your draft against your sources…'
            : 'Ready. Press “Compare” above to check your draft against these sources.'}
        </div>
      ) : overlaps.length === 0 ? (
        <div className="clean">
          <span className="mark">✓</span>
          No overlap found with your sources.
        </div>
      ) : (
        overlaps.map((m) => (
          <div
            key={m.id}
            className={`alert-card${m.id === activeId ? ' active' : ''}`}
            onClick={() => onJump(m.id)}
          >
            <div className="cat">
              <span className={`dot dot--${m.kind === 'verbatim' ? 'correctness' : 'clarity'}`} />
              {m.kind === 'verbatim' ? 'Verbatim' : `Paraphrase · ${Math.round(m.similarity * 100)}%`} · {m.sourceLabel}
            </div>
            <div className="msg" style={{ fontStyle: 'italic' }}>
              “{m.text.length > 90 ? m.text.slice(0, 90) + '…' : m.text}”
            </div>
            {(onQuote || onCite) && (
              <div className="row">
                {onQuote && (
                  <button className="btn btn--primary" onClick={(e) => { e.stopPropagation(); onQuote(m) }}>
                    Quote it
                  </button>
                )}
                {onCite && (
                  <button className="btn" onClick={(e) => { e.stopPropagation(); onCite(m) }}>
                    Add citation
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </>
  )
}
