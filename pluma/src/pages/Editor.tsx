import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EditorContent, useEditor, type Editor as TTEditor } from '@tiptap/react'
import { buildExtensions } from '../editor/extensions'
import { alertRange, docText, suggestionsKey } from '../editor/suggestions-plugin'
import { check, fingerprint } from '../engine/checker'
import { DIALECT_LABELS, type Alert, type Dialect } from '../engine/types'
import { getDoc, updateDoc } from '../store/documents'
import { exportDocx } from '../files/docx-export'

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

  const editorRef = useRef<TTEditor | null>(null)
  const dialectRef = useRef(dialect)
  const titleRef = useRef(title)
  const dismissedRef = useRef<Set<string>>(new Set())
  const checkTimer = useRef<number | undefined>(undefined)
  const saveTimer = useRef<number | undefined>(undefined)

  const runCheck = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const { text, toPm } = docText(editor.state.doc)

    const kept: Alert[] = []
    const items: { alert: Alert; from: number; to: number }[] = []
    for (const a of check(text, dialectRef.current)) {
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
    setCounts({
      words: text.trim() ? text.trim().split(/\s+/).length : 0,
      chars: text.replace(/\n/g, '').length,
    })
    editor.view.dispatch(
      editor.state.tr.setMeta(suggestionsKey, { type: 'set', items, activeId: null }),
    )
  }, [])

  const scheduleCheck = useCallback(() => {
    window.clearTimeout(checkTimer.current)
    checkTimer.current = window.setTimeout(runCheck, 500)
  }, [runCheck])

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

  const editor = useEditor({
    extensions: buildExtensions((alertId) => setActive(alertId)),
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

  const accept = (alert: Alert) => {
    const ed = editorRef.current
    if (!ed || alert.replacements.length === 0) return
    const range = alertRange(ed.state, alert.id)
    if (!range) return
    ed.chain().focus().insertContentAt(range, alert.replacements[0]).run()
    window.clearTimeout(checkTimer.current)
    runCheck()
    scheduleSave()
  }

  const dismiss = (alert: Alert) => {
    dismissedRef.current.add(fingerprint(alert))
    if (activeId === alert.id) setActiveId(null)
    runCheck()
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
        <button className="btn" onClick={onExport}>Export .docx</button>
      </div>

      <Toolbar editor={editor} counts={counts} />

      <div className="editor-body">
        <div className="editor-scroll">
          <div className="paper">
            <EditorContent editor={editor} />
          </div>
        </div>

        <aside className="panel">
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
              <div
                key={a.id}
                className={`alert-card${a.id === activeId ? ' active' : ''}`}
                onClick={() => setActive(a.id, true)}
              >
                <div className="cat">
                  <span className={`dot dot--${a.category}`} />
                  {a.category}
                </div>
                <div className="change">
                  <span className="from">{a.text.length > 40 ? a.text.slice(0, 40) + '…' : a.text}</span>
                  {a.replacements[0] !== undefined && (
                    <>
                      {' → '}
                      <span className="to">{a.replacements[0]}</span>
                    </>
                  )}
                </div>
                <div className="msg">{a.message}</div>
                <div className="row">
                  {a.replacements.length > 0 && (
                    <button
                      className="btn btn--primary"
                      onClick={(e) => {
                        e.stopPropagation()
                        accept(a)
                      }}
                    >
                      Accept
                    </button>
                  )}
                  <button
                    className="btn btn--quiet"
                    onClick={(e) => {
                      e.stopPropagation()
                      dismiss(a)
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))
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
