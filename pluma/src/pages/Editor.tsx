import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EditorContent, useEditor, type Editor as TTEditor } from '@tiptap/react'
import { buildExtensions } from '../editor/extensions'
import { alertRange, docText, suggestionsKey } from '../editor/suggestions-plugin'
import { originalityKey, overlapRange } from '../editor/originality-plugin'
import { hemingwayKey, type RangedMark } from '../editor/hemingway-plugin'
import { autocompleteKey } from '../editor/autocomplete-plugin'
import { check, checkAsync, fingerprint } from '../engine/checker'
import { completions } from '../engine/datamuse'
import { addPersonalWord, getPersonalWords } from '../engine/personal'
import { DIALECT_LABELS, type Alert, type Dialect } from '../engine/types'
import {
  checkOriginality,
  scoreOriginality,
  type OverlapMatch,
  type Source,
} from '../engine/originality'
import { findSources } from '../engine/source-finder'
import { analyzeText, analyzeTone, hemingwayMarks, type WritingAnalytics, type ToneScore } from '../engine/analytics'
import { DEFAULT_GOALS, type WritingGoals } from '../engine/goals'
import { getDoc, updateDoc, saveEditorState, touchDoc, type EditorState } from '../store/documents'
import { exportDocx } from '../files/docx-export'
import SuggestionCard from '../components/SuggestionCard'
import OriginalityPanel from '../components/OriginalityPanel'
import GoalsModal from '../components/GoalsModal'
import WordPopover from '../components/WordPopover'
import BibliographyPanel from '../components/BibliographyPanel'
import AssistPanel from '../ai/AssistPanel'
import HelpAccordion from '../components/HelpAccordion'
import { isAiAvailable } from '../ai/capabilities'
import { fromFoundSource, type Reference } from '../engine/citations'

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const stored = useRef(id ? getDoc(id) : null)

  const [title, setTitle] = useState(stored.current?.title ?? '')
  const [dialect, setDialect] = useState<Dialect>(stored.current?.dialect ?? 'en-US')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [counts, setCounts] = useState({ words: 0, chars: 0 })
  const [analytics, setAnalytics] = useState<WritingAnalytics | null>(null)
  const [tone, setTone] = useState<ToneScore | null>(null)
  const [clarityOn, setClarityOn] = useState(false)
  const clarityRef = useRef(clarityOn)
  clarityRef.current = clarityOn
  const [notice, setNotice] = useState<string | null>(null)
  const [goals, setGoals] = useState<WritingGoals>(stored.current?.goals ?? DEFAULT_GOALS)
  const [goalsOpen, setGoalsOpen] = useState(false)
  const goalsRef = useRef(goals)
  goalsRef.current = goals
  const [popover, setPopover] = useState<
    { word: string; before: string; after: string; from: number; to: number; x: number; y: number } | null
  >(null)
  const acTimer = useRef<number | undefined>(undefined)
  const acCtrl = useRef<AbortController | null>(null)

  const savedState = stored.current?.editorState
  const [panel, setPanel] = useState<'grammar' | 'originality' | 'citations' | 'assist' | 'help'>(savedState?.panelTab ?? 'grammar')
  const [selText, setSelText] = useState('')
  const aiOn = isAiAvailable()
  const [sources, setSources] = useState<Source[]>(stored.current?.sources ?? [])
  const [references, setReferences] = useState<Reference[]>(stored.current?.references ?? [])
  const referencesRef = useRef(references)
  referencesRef.current = references
  const [overlaps, setOverlaps] = useState<OverlapMatch[]>([])
  const [activeOverlap, setActiveOverlap] = useState<string | null>(null)
  const [origPhase, setOrigPhase] = useState<'idle' | 'comparing' | 'done'>('idle')
  const origPhaseRef = useRef(origPhase)
  const [panelOpen, setPanelOpen] = useState(savedState?.panelOpen ?? false)

  const editorRef = useRef<TTEditor | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const dialectRef = useRef(dialect)
  const titleRef = useRef(title)
  const sourcesRef = useRef(sources)
  sourcesRef.current = sources
  const dismissedRef = useRef<Set<string>>(new Set(savedState?.dismissed ?? []))
  const panelRef = useRef(panel)
  panelRef.current = panel
  const panelOpenRef = useRef(panelOpen)
  panelOpenRef.current = panelOpen
  const personalRef = useRef<string[]>(getPersonalWords())
  const checkTimer = useRef<number | undefined>(undefined)
  const saveTimer = useRef<number | undefined>(undefined)
  const scrollTimer = useRef<number | undefined>(undefined)
  const asideRef = useRef<HTMLElement | null>(null)
  const editorDragHandleRef = useRef<HTMLDivElement | null>(null)
  const editorSwipeStartY = useRef(0)

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

  // Hemingway clarity highlights — mapped to current doc positions, dispatched
  // to the decoration plugin. Clearing (on=false) wipes the marks.
  const renderClarity = useCallback((on: boolean) => {
    const editor = editorRef.current
    if (!editor) return
    if (!on) {
      editor.view.dispatch(editor.state.tr.setMeta(hemingwayKey, { type: 'set', items: [] }))
      return
    }
    const { text, toPm } = docText(editor.state.doc)
    const items = hemingwayMarks(text)
      .map((mk): RangedMark | null => {
        const from = toPm(mk.begin)
        const to = toPm(mk.end)
        return from !== null && to !== null && from < to ? { kind: mk.kind, from, to } : null
      })
      .filter((x): x is RangedMark => x !== null)
    editor.view.dispatch(editor.state.tr.setMeta(hemingwayKey, { type: 'set', items }))
  }, [])

  const runCheck = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const { text } = docText(editor.state.doc)
    setCounts({
      words: text.trim() ? text.trim().split(/\s+/).length : 0,
      chars: text.replace(/\n/g, '').length,
    })
    const enoughForStats = text.trim().split(/\s+/).length >= 30
    setAnalytics(enoughForStats ? analyzeText(text) : null)
    setTone(enoughForStats ? analyzeTone(text) : null)
    if (clarityRef.current) renderClarity(true)
    // instant rules-only pass, then the richer worker pass (rules + dictionary)
    renderAlerts(text, check(text, dialectRef.current, goalsRef.current))
    checkAsync(text, dialectRef.current, personalRef.current, goalsRef.current).then((alerts) =>
      renderAlerts(text, alerts),
    )
  }, [renderAlerts, renderClarity])

  const toggleClarity = () => {
    const next = !clarityRef.current
    setClarityOn(next)
    clarityRef.current = next
    renderClarity(next)
  }

  // ghost-text autocomplete: after a short idle, predict the rest of the word
  // at the cursor and show it as a gray suffix (Tab accepts it).
  const scheduleAutocomplete = useCallback(() => {
    window.clearTimeout(acTimer.current)
    acTimer.current = window.setTimeout(async () => {
      const editor = editorRef.current
      if (!editor) return
      const { state } = editor
      if (!state.selection.empty) return
      const pos = state.selection.from
      const $pos = state.doc.resolve(pos)
      // only at the end of a word (next char isn't a letter)
      const next = state.doc.textBetween(pos, Math.min(pos + 1, $pos.end()))
      if (/[A-Za-z]/.test(next)) return
      const before = state.doc.textBetween($pos.start(), pos, '\n', '\n')
      const m = before.match(/[A-Za-z]{3,}$/)
      if (!m) return
      const prefix = m[0]
      acCtrl.current?.abort()
      acCtrl.current = new AbortController()
      const list = await completions(prefix, acCtrl.current.signal)
      const best = list.find(
        (w) => w.length > prefix.length && w.toLowerCase().startsWith(prefix.toLowerCase()),
      )
      if (!best) return
      const ed = editorRef.current
      if (!ed || ed.state.selection.from !== pos || !ed.state.selection.empty) return
      ed.view.dispatch(ed.state.tr.setMeta(autocompleteKey, { ghost: { pos, suffix: best.slice(prefix.length) } }))
    }, 320)
  }, [])

  const runOriginality = useCallback((): OverlapMatch[] => {
    const editor = editorRef.current
    if (!editor) return []
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
    return found
  }, [])

  // sources changed → previous comparison is stale; clear highlights, require a fresh Compare
  const markOrigStale = useCallback(() => {
    setOrigPhase('idle')
    origPhaseRef.current = 'idle'
    setOverlaps([])
    setActiveOverlap(null)
    const editor = editorRef.current
    editor?.view.dispatch(
      editor.state.tr.setMeta(originalityKey, { type: 'set', items: [], activeId: null }),
    )
  }, [])

  const scheduleCheck = useCallback(() => {
    window.clearTimeout(checkTimer.current)
    checkTimer.current = window.setTimeout(() => {
      runCheck()
      // keep overlap highlights aligned as the user edits, but only once they've compared
      if (sourcesRef.current.length > 0 && origPhaseRef.current === 'done') runOriginality()
    }, 500)
  }, [runCheck, runOriginality])

  const collectEditorState = useCallback((): EditorState => {
    const editor = editorRef.current
    return {
      selection: editor ? { from: editor.state.selection.from, to: editor.state.selection.to } : undefined,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
      panelOpen: panelOpenRef.current,
      panelTab: panelRef.current,
      dismissed: [...dismissedRef.current],
    }
  }, [])

  const writeDoc = useCallback(() => {
    if (!id) return
    const editor = editorRef.current
    if (!editor) return
    const { text } = docText(editor.state.doc)
    updateDoc(id, {
      title: titleRef.current,
      dialect: dialectRef.current,
      content: editor.getJSON(),
      words: text.trim() ? text.trim().split(/\s+/).length : 0,
      sources: sourcesRef.current,
      goals: goalsRef.current,
      references: referencesRef.current,
      editorState: collectEditorState(),
    })
  }, [id, collectEditorState])

  const addReference = (ref: Reference) => {
    const next = [...referencesRef.current, ref]
    setReferences(next)
    referencesRef.current = next
    scheduleSave()
  }

  const removeReference = (rid: string) => {
    const next = referencesRef.current.filter((r) => r.id !== rid)
    setReferences(next)
    referencesRef.current = next
    scheduleSave()
  }

  const insertAtCursor = (text: string) => {
    const ed = editorRef.current
    if (!ed) return
    ed.chain().focus().insertContent(text).run()
    scheduleSave()
  }

  const appendToDoc = (text: string) => {
    const ed = editorRef.current
    if (!ed) return
    const end = ed.state.doc.content.size
    const block = text.split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] }))
    ed.chain().focus().insertContentAt(end, block).run()
    scheduleSave()
  }

  // replace the current selection with AI output (rewrite/tone/etc.)
  const aiReplace = (text: string) => {
    const ed = editorRef.current
    if (!ed) return
    const { from, to } = ed.state.selection
    if (from === to) return
    ed.chain().focus().insertContentAt({ from, to }, text).run()
    runCheck()
    scheduleSave()
  }

  // drop AI output as a new paragraph just after the selection (summaries, etc.)
  const aiInsertBelow = (text: string) => {
    const ed = editorRef.current
    if (!ed) return
    const { to } = ed.state.selection
    const block = text.split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] }))
    ed.chain().focus().insertContentAt(to, block).run()
    runCheck()
    scheduleSave()
  }

  const changeGoals = (g: WritingGoals) => {
    setGoals(g)
    goalsRef.current = g
    if (id) updateDoc(id, { goals: g })
    runCheck()
  }

  const scheduleSave = useCallback(() => {
    if (!id) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(writeDoc, 700)
  }, [id, writeDoc])

  // persist UI-only state (cursor/scroll/panel) without bumping updatedAt
  const persistUiState = useCallback(() => {
    if (!id) return
    saveEditorState(id, collectEditorState())
  }, [id, collectEditorState])

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

  // explicit "Compare" action — runs the check, shows the result, jumps to the first overlap
  const compareNow = useCallback(() => {
    if (sourcesRef.current.length === 0) return
    setOrigPhase('comparing')
    origPhaseRef.current = 'comparing'
    window.setTimeout(() => {
      const found = runOriginality()
      setOrigPhase('done')
      origPhaseRef.current = 'done'
      if (found.length > 0) setActiveOverlapHl(found[0].id, true)
    }, 30)
  }, [runOriginality, setActiveOverlapHl])

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
      scheduleAutocomplete()
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection
      setSelText(from === to ? '' : ed.state.doc.textBetween(from, to, ' '))
    },
  })

  useEffect(() => {
    editorRef.current = editor
    if (!editor) return
    runCheck()
    // restore where the user left off
    if (id) touchDoc(id)
    const st = stored.current?.editorState
    if (st?.selection) {
      const max = editor.state.doc.content.size
      const from = Math.min(st.selection.from, max)
      const to = Math.min(st.selection.to, max)
      try {
        editor.commands.setTextSelection({ from, to })
      } catch {
        /* doc shape changed — ignore */
      }
    }
    if (st?.scrollTop && scrollRef.current) {
      // wait a frame so layout (and decorations) settle before scrolling
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = st.scrollTop!
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, runCheck])

  // double-tap a word → thesaurus popover (the browser selects the word for us)
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom as HTMLElement
    const onDbl = (e: MouseEvent) => {
      window.setTimeout(() => {
        const { state } = editor
        const { from, to, empty } = state.selection
        if (empty || to - from > 40) return
        const word = state.doc.textBetween(from, to).trim()
        if (!/^[A-Za-z][A-Za-z'-]{1,}$/.test(word)) return
        const $from = state.doc.resolve(from)
        const before = state.doc.textBetween($from.start(), from, ' ', ' ')
        const after = state.doc.textBetween(to, $from.end(), ' ', ' ')
        setPopover({ word, before, after, from, to, x: e.clientX, y: e.clientY })
      }, 0)
    }
    dom.addEventListener('dblclick', onDbl)
    return () => dom.removeEventListener('dblclick', onDbl)
  }, [editor])

  const replaceWord = (replacement: string) => {
    const ed = editorRef.current
    if (!ed || !popover) return
    ed.chain().focus().insertContentAt({ from: popover.from, to: popover.to }, replacement).run()
    setPopover(null)
    runCheck()
    scheduleSave()
  }

  // persist panel open/tab changes (skip the initial mount)
  const panelMounted = useRef(false)
  useEffect(() => {
    if (!panelMounted.current) {
      panelMounted.current = true
      return
    }
    persistUiState()
  }, [panel, panelOpen, persistUiState])

  // flush the latest content + restore state when the tab is hidden/closed,
  // so an abrupt close still leaves the project exactly where it was
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(saveTimer.current)
        writeDoc()
      }
    }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flush)
    }
  }, [writeDoc])

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

  // swipe-to-close the panel bottom sheet on mobile
  useEffect(() => {
    const handle = editorDragHandleRef.current
    if (!handle) return
    const onStart = (e: TouchEvent) => { editorSwipeStartY.current = e.touches[0].clientY }
    const onMove = (e: TouchEvent) => {
      const el = asideRef.current
      if (!el) return
      e.preventDefault()
      const dy = e.touches[0].clientY - editorSwipeStartY.current
      if (dy > 0) { el.style.transition = 'none'; el.style.transform = `translateY(${dy}px)` }
    }
    const onEnd = (e: TouchEvent) => {
      const el = asideRef.current
      if (!el) return
      const dy = e.changedTouches[0].clientY - editorSwipeStartY.current
      el.style.transform = ''
      el.style.transition = ''
      if (dy > 80) setPanelOpen(false)
    }
    handle.addEventListener('touchstart', onStart, { passive: true })
    handle.addEventListener('touchmove', onMove, { passive: false })
    handle.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      handle.removeEventListener('touchstart', onStart)
      handle.removeEventListener('touchmove', onMove)
      handle.removeEventListener('touchend', onEnd)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    persistUiState()
  }

  const onScroll = () => {
    window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(persistUiState, 400)
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
    markOrigStale()
    scheduleSave()
  }

  const removeSource = (sid: string) => {
    const next = sourcesRef.current.filter((s) => s.id !== sid)
    setSources(next)
    sourcesRef.current = next
    markOrigStale()
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
        <button className="btn" onClick={() => setGoalsOpen(true)} title="Set who you're writing for">⌖ Goals</button>
        <button className="btn" onClick={() => window.print()}>Export PDF</button>
        <button className="btn" onClick={onExport}>Export .docx</button>
        <button
          className="btn btn--primary mobile-only panel-toggle"
          onClick={() => setPanelOpen((v) => !v)}
        >
          {alerts.length > 0 ? `Review (${alerts.length})` : 'Review'}
        </button>
      </div>

      {goalsOpen && (
        <GoalsModal goals={goals} onSave={changeGoals} onClose={() => setGoalsOpen(false)} />
      )}

      {popover && (
        <WordPopover
          word={popover.word}
          before={popover.before}
          after={popover.after}
          x={popover.x}
          y={popover.y}
          onPick={replaceWord}
          onClose={() => setPopover(null)}
        />
      )}

      <Toolbar editor={editor} counts={counts} />

      <div className="editor-body">
        <div className="editor-scroll" ref={scrollRef} onScroll={onScroll}>
          <div className="paper">
            <EditorContent editor={editor} />
          </div>
        </div>

        {panelOpen && <div className="panel-backdrop mobile-only" onClick={() => setPanelOpen(false)} />}

        <aside ref={asideRef} className={`panel${panelOpen ? ' open' : ''}`}>
          <div ref={editorDragHandleRef} className="panel-drag-handle mobile-only" />
          <button className="panel-close mobile-only" onClick={() => setPanelOpen(false)} aria-label="Close">×</button>
          <div className="panel-tabs">
            <button className={panel === 'grammar' ? 'on' : ''} onClick={() => setPanel('grammar')}>
              Suggestions{alerts.length > 0 ? ` (${alerts.length})` : ''}
            </button>
            <button
              className={panel === 'originality' ? 'on' : ''}
              onClick={() => setPanel('originality')}
            >
              Originality{origPhase === 'done' && overlaps.length > 0 ? ` (${overlaps.length})` : ''}
            </button>
            <button
              className={panel === 'citations' ? 'on' : ''}
              onClick={() => setPanel('citations')}
            >
              Citations{references.length > 0 ? ` (${references.length})` : ''}
            </button>
            {aiOn && (
              <button
                className={panel === 'assist' ? 'on' : ''}
                onClick={() => setPanel('assist')}
              >
                ✦ Assist
              </button>
            )}
            <button
              className={`panel-help-tab${panel === 'help' ? ' on' : ''}`}
              onClick={() => setPanel('help')}
              title="How Pluma works"
              aria-label="How Pluma works"
            >
              ?
            </button>
          </div>

          {panel === 'help' ? (
            <HelpAccordion aiOn={aiOn} />
          ) : panel === 'assist' ? (
            <AssistPanel
              selectedText={selText}
              context={{ goals, dialect }}
              onReplace={aiReplace}
              onInsert={aiInsertBelow}
            />
          ) : panel === 'citations' ? (
            <BibliographyPanel
              references={references}
              onRemove={removeReference}
              onAddByDoi={addReference}
              onInsertInText={insertAtCursor}
              onInsertList={appendToDoc}
            />
          ) : panel === 'originality' ? (
            <OriginalityPanel
              sources={sources}
              overlaps={overlaps}
              score={scoreOriginality(docText(editor.state.doc).text, overlaps)}
              activeId={activeOverlap}
              phase={origPhase}
              onCompare={compareNow}
              onAdd={addSource}
              onRemove={removeSource}
              onJump={(id) => setActiveOverlapHl(id, true)}
              onQuote={quoteOverlap}
              onCite={citeOverlap}
              onFind={() => findSources(docText(editorRef.current!.state.doc).text, { limit: 10 })}
              onAddFound={(s) => {
                addSource(`${s.authors || s.via}${s.year ? `, ${s.year}` : ''}`, `${s.title}. ${s.abstract}`)
                addReference(fromFoundSource(s))
              }}
            />
          ) : (
          <>
          <h2>Suggestions</h2>
          <p className="sub">
            {correctness} correctness · {alerts.length - correctness} clarity
          </p>

          {analytics && (
            <div className="analytics-block">
              <div className="an-row">
                <span className="an-label">Readability</span>
                <span className="an-val">
                  <span className={`an-pill an-ease-${Math.floor(analytics.fleschEase / 20)}`}>
                    {analytics.readabilityLabel}
                  </span>
                  <span className="an-dim">grade {analytics.fleschGrade}</span>
                </span>
              </div>
              <div className="an-row">
                <span className="an-label">Avg sentence</span>
                <span className="an-val">{analytics.avgWordsPerSentence} words
                  {analytics.avgWordsPerSentence > 25
                    ? <span className="an-warn"> ↑ long</span>
                    : analytics.avgWordsPerSentence < 12
                    ? <span className="an-ok"> ↓ short</span>
                    : null}
                </span>
              </div>
              <div className="an-row">
                <span className="an-label">Passive voice</span>
                <span className="an-val">
                  {analytics.passivePct}% of sentences
                  {analytics.passivePct > 30 ? <span className="an-warn"> ↑</span> : null}
                </span>
              </div>
              <div className="an-row">
                <span className="an-label">Vocabulary</span>
                <span className="an-val">
                  {Math.round(analytics.vocabularyRichness * 100)}% unique words
                  {analytics.intensifierCount > 0
                    ? <span className="an-dim"> · {analytics.intensifierCount} filler{analytics.intensifierCount > 1 ? 's' : ''}</span>
                    : null}
                </span>
              </div>
              <div className="an-row">
                <span className="an-label">Style</span>
                <span className="an-val">{analytics.styleLabel}
                  <span className="an-dim"> · {analytics.readingMinutes < 1 ? '< 1' : analytics.readingMinutes} min read</span>
                </span>
              </div>
            </div>
          )}

          {tone && (
            <div className="tone-block">
              <div className="tone-head">
                <span className="an-label">Tone</span>
                <span className="tone-label">{tone.label}</span>
              </div>
              {([
                ['Formal', tone.formal],
                ['Confident', tone.confident],
                ['Friendly', tone.friendly],
                ['Analytical', tone.analytical],
                ['Tentative', tone.tentative],
              ] as [string, number][]).map(([name, val]) => (
                <div key={name} className="tone-row">
                  <span className="tone-name">{name}</span>
                  <span className="tone-bar-wrap"><span className="tone-bar" style={{ width: `${Math.round(val * 100)}%` }} /></span>
                </div>
              ))}
            </div>
          )}

          <button className={`clarity-toggle${clarityOn ? ' on' : ''}`} onClick={toggleClarity}>
            {clarityOn ? '✓ Clarity highlights on' : 'Show clarity highlights'}
          </button>
          {clarityOn && (
            <div className="clarity-legend">
              <span><i className="pl-hem--very-hard" /> very hard</span>
              <span><i className="pl-hem--hard" /> hard</span>
              <span><i className="pl-hem--passive" /> passive</span>
              <span><i className="pl-hem--adverb" /> adverb</span>
              <span><i className="pl-hem--weakener" /> weakener</span>
              <span><i className="pl-hem--complex-word" /> complex</span>
            </div>
          )}

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
