import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EditorContent, useEditor, type Editor as TTEditor } from '@tiptap/react'
import { buildExtensions } from '../editor/extensions'
import { alertRange, docText, suggestionsKey } from '../editor/suggestions-plugin'
import { originalityKey, overlapRange } from '../editor/originality-plugin'
import { check, checkAsync, fingerprint } from '../engine/checker'
import { addPersonalWord, getPersonalWords } from '../engine/personal'
import { DIALECT_LABELS, type Alert, type Dialect } from '../engine/types'
import {
  checkOriginality,
  scoreOriginality,
  type OverlapMatch,
  type Source,
} from '../engine/originality'
import { findSources, type FoundSource } from '../engine/source-finder'
import { getDoc, updateDoc } from '../store/documents'
import { exportDocx } from '../files/docx-export'
import SuggestionCard from '../components/SuggestionCard'

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const stored = useRef(id ? getDoc(id) : null)

  const [title, setTitle] = useState(stored.current?.title ?? '')
  const [dialect, setDialect] = useState<Dialect>(stored.current?.dialect ?? 'en-US')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [counts, setCounts] = useState({ words: 0, chars: 0 })
  const [notice, setNotice] = useState<string | null>(null)

  const [panel, setPanel] = useState<'grammar' | 'originality'>('grammar')
  const [sources, setSources] = useState<Source[]>(stored.current?.sources ?? [])
  const [overlaps, setOverlaps] = useState<OverlapMatch[]>([])
  const [activeOverlap, setActiveOverlap] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const editorRef = useRef<TTEditor | null>(null)
  const dialectRef = useRef(dialect)
  const titleRef = useRef(title)
  const sourcesRef = useRef(sources)
  sourcesRef.current = sources
  const dismissedRef = useRef<Set<string>>(new Set())
  const personalRef = useRef<string[]>(getPersonalWords())
  const checkTimer = useRef<number | undefined>(undefined)
  const saveTimer = useRef<number | undefined>(undefined)

  const renderAlerts = useCallback((sourceText: string, alerts: Alert[]) => {
    const editor = editorRef.current
    if (!editor) return
    // re-map offsets against the *current* document (it may have changed while
    // the worker ran); skip alerts that no longer line up.
    const { text, toPm } = docText(editor.state.doc)
    if (text !== sourceText) return // a newer check is already queued

    const kept: Alert[] = []
    const items: { alert: Alert; from: number; to: number }[] = []
    for (const a of alerts) {
      if (dismissedRef.current.has(fingerprint(a))) continue
      if (a.text.includes('\n')) continue
      const from = toPm(a.begin)
      const to = toPm(a.end)
      if (from === null || to === null || from >= to) continue
      kept.push(a)
      items.push({ alert: a, from, to })
    }

    setAlerts(kept)
    setActiveId((prev) => (prev && kept.some((a) => a.id === prev) ? prev : null))
    editor.view.dispatch(
      editor.state.tr.setMeta(suggestionsKey, { type: 'set', items, activeId: null }),
    )
  }, [])

  const runCheck = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const { text } = docText(editor.state.doc)
    setCounts({
      words: text.trim() ? text.trim().split(/\s+/).length : 0,
      chars: text.replace(/\n/g, '').length,
    })
    // instant rules-only pass, then the richer worker pass (rules + dictionary)
    renderAlerts(text, check(text, dialectRef.current))
    checkAsync(text, dialectRef.current, personalRef.current).then((alerts) =>
      renderAlerts(text, alerts),
    )
  }, [renderAlerts])

  const runOriginality = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const { text, toPm } = docText(editor.state.doc)
    const found = checkOriginality(text, sourcesRef.current)

    const items = found
      .map((m) => {
        const from = toPm(m.begin)
        const to = toPm(m.end)
        return from !== null && to !== null && from < to ? { match: m, from, to } : null
      })
      .filter((x): x is { match: OverlapMatch; from: number; to: number } => x !== null)

    setOverlaps(found)
    setActiveOverlap(null)
    editor.view.dispatch(
      editor.state.tr.setMeta(originalityKey, { type: 'set', items, activeId: null }),
    )
  }, [])

  const scheduleCheck = useCallback(() => {
    window.clearTimeout(checkTimer.current)
    checkTimer.current = window.setTimeout(() => {
      runCheck()
      if (sourcesRef.current.length > 0) runOriginality()
    }, 500)
  }, [runCheck, runOriginality])

  const scheduleSave = useCallback(() => {
    if (!id) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      const editor = editorRef.current
      if (!editor) return
      const { text } = docText(editor.state.doc)
      updateDoc(id, {
        title: titleRef.current,
        dialect: dialectRef.current,
        content: editor.getJSON(),
        words: text.trim() ? text.trim().split(/\s+/).length : 0,
        sources: sourcesRef.current,
      })
    }, 700)
  }, [id])

  const setActive = useCallback((alertId: string | null, focusEditor = false) => {
    setActiveId(alertId)
    const editor = editorRef.current
    if (!editor) return
    editor.view.dispatch(
      editor.state.tr.setMeta(suggestionsKey, { type: 'active', activeId: alertId }),
    )
    if (alertId && focusEditor) {
      const range = alertRange(editor.state, alertId)
      if (range) editor.chain().focus().setTextSelection(range.from).scrollIntoView().run()
    }
  }, [])

  const setActiveOverlapHl = useCallback((overlapId: string | null, focusEditor = false) => {
    setActiveOverlap(overlapId)
    const editor = editorRef.current
    if (!editor) return
    if (overlapId && focusEditor) {
      const range = overlapRange(editor.state, overlapId)
      if (range) editor.chain().focus().setTextSelection(range.from).scrollIntoView().run()
    }
  }, [])

  const editor = useEditor({
    extensions: buildExtensions(
      (alertId) => {
        setActive(alertId)
        setPanel('grammar')
        setPanelOpen(true)
      },
      (overlapId) => {
        setPanel('originality')
        setActiveOverlapHl(overlapId)
        setPanelOpen(true)
      },
    ),
    content: (stored.current?.content as never) ?? '',
    onUpdate: () => {
      scheduleCheck()
      scheduleSave()
    },
  })

  useEffect(() => {
    editorRef.current = editor
    if (editor) runCheck()
  }, [editor, runCheck])

  useEffect(() => {
    dialectRef.current = dialect
  }, [dialect])
  useEffect(() => {
    titleRef.current = title
  }, [title])

  useEffect(() => {
    if (!stored.current) navigate('/docs', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(t)
  }, [notice])

  const accept = (alert: Alert, index = 0) => {
    const ed = editorRef.current
    const replacement = alert.replacements[index]
    if (!ed || replacement === undefined) return
    const range = alertRange(ed.state, alert.id)
    if (!range) return
    ed.chain().focus().insertContentAt(range, replacement).run()
    window.clearTimeout(checkTimer.current)
    runCheck()
    scheduleSave()
  }

  const dismiss = (alert: Alert) => {
    dismissedRef.current.add(fingerprint(alert))
    if (activeId === alert.id) setActiveId(null)
    runCheck()
  }

  const addToDictionary = (alert: Alert) => {
    personalRef.current = addPersonalWord(alert.text)
    if (activeId === alert.id) setActiveId(null)
    runCheck()
  }

  const addSource = (label: string, text: string) => {
    const next = [...sourcesRef.current, { id: crypto.randomUUID(), label: label.trim() || `Source ${sourcesRef.current.length + 1}`, text }]
    setSources(next)
    sourcesRef.current = next
    runOriginality()
    scheduleSave()
  }

  const removeSource = (sid: string) => {
    const next = sourcesRef.current.filter((s) => s.id !== sid)
    setSources(next)
    sourcesRef.current = next
    runOriginality()
    scheduleSave()
  }

  const quoteOverlap = (m: OverlapMatch) => {
    const ed = editorRef.current
    if (!ed) return
    const range = overlapRange(ed.state, m.id)
    if (!range) return
    ed.chain()
      .focus()
      .insertContentAt(range.to, '” ')
      .insertContentAt(range.from, '“')
      .run()
    runOriginality()
    scheduleSave()
  }

  const citeOverlap = (m: OverlapMatch) => {
    const ed = editorRef.current
    if (!ed) return
    const range = overlapRange(ed.state, m.id)
    if (!range) return
    ed.chain().focus().insertContentAt(range.to, ` (${m.sourceLabel}) `).run()
    runOriginality()
    scheduleSave()
  }

  const onExport = async () => {
    const ed = editorRef.current
    if (!ed) return
    try {
      await exportDocx(ed.getJSON(), titleRef.current)
    } catch {
      setNotice('Export failed — please try again.')
    }
  }

  const onDialectChange = (d: Dialect) => {
    setDialect(d)
    dialectRef.current = d
    runCheck()
    scheduleSave()
  }

  if (!stored.current || !editor) return null

  const correctness = alerts.filter((a) => a.category === 'correctness').length

  return (
    <div className="editor-page">
      <div className="editor-top">
        <Link to="/docs" className="btn btn--quiet" title="Back to documents">‹ Documents</Link>
        <input
          className="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            scheduleSave()
          }}
          placeholder="Untitled document"
          aria-label="Document title"
        />
        <span className="issue-pill">
          <span className={`n${alerts.length === 0 ? ' n--ok' : ''}`}>
            {alerts.length === 0 ? '✓' : alerts.length}
          </span>
          {alerts.length === 0 ? 'no issues' : alerts.length === 1 ? 'issue' : 'issues'}
        </span>
        <select
          className="dialect"
          value={dialect}
          onChange={(e) => onDialectChange(e.target.value as Dialect)}
          aria-label="Language and dialect"
        >
          {Object.entries(DIALECT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button className="btn" onClick={() => window.print()}>Export PDF</button>
        <button className="btn" onClick={onExport}>Export .docx</button>
        <button
          className="btn btn--primary mobile-only panel-toggle"
          onClick={() => setPanelOpen((v) => !v)}
        >
          {alerts.length > 0 ? `Review (${alerts.length})` : 'Review'}
        </button>
      </div>

      <Toolbar editor={editor} counts={counts} />

      <div className="editor-body">
        <div className="editor-scroll">
          <div className="paper">
            <EditorContent editor={editor} />
          </div>
        </div>

        {panelOpen && <div className="panel-backdrop mobile-only" onClick={() => setPanelOpen(false)} />}

        <aside className={`panel${panelOpen ? ' open' : ''}`}>
          <button className="panel-close mobile-only" onClick={() => setPanelOpen(false)} aria-label="Close">×</button>
          <div className="panel-tabs">
            <button className={panel === 'grammar' ? 'on' : ''} onClick={() => setPanel('grammar')}>
              Suggestions{alerts.length > 0 ? ` (${alerts.length})` : ''}
            </button>
            <button
              className={panel === 'originality' ? 'on' : ''}
              onClick={() => {
                setPanel('originality')
                runOriginality()
              }}
            >
              Originality{overlaps.length > 0 ? ` (${overlaps.length})` : ''}
            </button>
          </div>

          {panel === 'originality' ? (
            <OriginalityPanel
              sources={sources}
              overlaps={overlaps}
              score={scoreOriginality(docText(editor.state.doc).text, overlaps)}
              activeId={activeOverlap}
              onAdd={addSource}
              onRemove={removeSource}
              onJump={(id) => setActiveOverlapHl(id, true)}
              onQuote={quoteOverlap}
              onCite={citeOverlap}
              onFind={() => findSources(docText(editorRef.current!.state.doc).text, { limit: 10 })}
              onAddFound={(s) => addSource(`${s.authors || s.via}${s.year ? `, ${s.year}` : ''}`, `${s.title}. ${s.abstract}`)}
            />
          ) : (
          <>
          <h2>Suggestions</h2>
          <p className="sub">
            {correctness} correctness · {alerts.length - correctness} clarity
          </p>
          {alerts.length === 0 ? (
            <div className="clean">
              <span className="mark">✓</span>
              Nothing to flag. Keep writing.
            </div>
          ) : (
            alerts.map((a) => (
              <SuggestionCard
                key={a.id}
                alert={a}
                active={a.id === activeId}
                onClick={() => setActive(a.id, true)}
                onAccept={(index) => accept(a, index)}
                onDismiss={() => dismiss(a)}
                onAddToDictionary={() => addToDictionary(a)}
              />
            ))
          )}
          </>
          )}
        </aside>
      </div>

      {notice && <div className="notice">{notice}</div>}
    </div>
  )
}

function OriginalityPanel({
  sources,
  overlaps,
  score,
  activeId,
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
  onAdd: (label: string, text: string) => void
  onRemove: (id: string) => void
  onJump: (id: string) => void
  onQuote: (m: OverlapMatch) => void
  onCite: (m: OverlapMatch) => void
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

      {sources.length > 0 && (
        <div className="orig-score">
          <span className="pct">{score.overlapPercent}%</span>
          <span className="lbl">
            of your text overlaps your sources<br />
            {score.verbatim} verbatim · {score.paraphrase} paraphrased
          </span>
        </div>
      )}

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
          No source of your own? Pluma searches real academic databases
          (OpenAlex, Crossref) and suggests papers that match your writing.
        </p>

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
                  {addedIds.has(s.id) ? '✓ Added & comparing' : 'Add as source & compare'}
                </button>
              </div>
            ))}
            <p className="find-note">Match % is keyword-based — open a source to judge real relevance.</p>
          </div>
        )}
      </div>

      <div style={{ height: 18 }} />

      {sources.length === 0 ? (
        <div className="clean">Add the sources you used and Pluma will show where your draft overlaps them.</div>
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
            <div className="row">
              <button className="btn btn--primary" onClick={(e) => { e.stopPropagation(); onQuote(m) }}>
                Quote it
              </button>
              <button className="btn" onClick={(e) => { e.stopPropagation(); onCite(m) }}>
                Add citation
              </button>
            </div>
          </div>
        ))
      )}
    </>
  )
}

function Toolbar({ editor, counts }: { editor: TTEditor; counts: { words: number; chars: number } }) {
  const btn = (
    label: string,
    onClick: () => void,
    isOn = false,
    titleText = label,
  ) => (
    <button className={isOn ? 'on' : ''} onClick={onClick} title={titleText} type="button">
      {label}
    </button>
  )

  return (
    <div className="toolbar">
      {btn('H1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }), 'Heading 1')}
      {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), 'Heading 2')}
      {btn('H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), 'Heading 3')}
      <span className="sep" />
      {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), 'Bold')}
      {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), 'Italic')}
      {btn('U', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), 'Underline')}
      {btn('S', () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'), 'Strikethrough')}
      <span className="sep" />
      {btn('• List', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), 'Bullet list')}
      {btn('1. List', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), 'Numbered list')}
      {btn('❝', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), 'Quote')}
      <span className="sep" />
      {btn('⟸', () => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' }), 'Align left')}
      {btn('⟺', () => editor.chain().focus().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' }), 'Align center')}
      {btn('⟹', () => editor.chain().focus().setTextAlign('right').run(), editor.isActive({ textAlign: 'right' }), 'Align right')}
      <span className="sep" />
      {btn('↶', () => editor.chain().focus().undo().run(), false, 'Undo')}
      {btn('↷', () => editor.chain().focus().redo().run(), false, 'Redo')}
      <span className="count">
        {counts.words.toLocaleString()} words · {counts.chars.toLocaleString()} characters
      </span>
    </div>
  )
}
