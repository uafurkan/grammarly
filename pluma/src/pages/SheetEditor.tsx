import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { check, fingerprint } from '../engine/checker'
import { DIALECT_LABELS, type Alert, type Dialect } from '../engine/types'
import { getDoc, updateDoc } from '../store/documents'
import { exportXlsx, newSheetContent, type SheetContent } from '../files/xlsx-import'
import SuggestionCard from '../components/SuggestionCard'

interface SheetAlert {
  key: string
  sheet: number
  r: number
  c: number
  alert: Alert
}

const MAX_SCANNED_CELLS = 20_000
const MAX_RENDER_ROWS = 500
const MIN_ROWS = 40
const MIN_COLS = 10

function colName(i: number): string {
  let name = ''
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) {
    name = String.fromCharCode(65 + (n % 26)) + name
  }
  return name
}

export default function SheetEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const stored = useRef(id ? getDoc(id) : null)

  const initial = (stored.current?.content as SheetContent | undefined)?.sheets
    ? (stored.current!.content as SheetContent)
    : newSheetContent()

  const [content, setContent] = useState<SheetContent>(initial)
  const [sheetIdx, setSheetIdx] = useState(0)
  const [title, setTitle] = useState(stored.current?.title ?? '')
  const [dialect, setDialect] = useState<Dialect>(stored.current?.dialect ?? 'en-US')
  const [active, setActive] = useState<{ r: number; c: number } | null>(null)
  const [alerts, setAlerts] = useState<SheetAlert[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const dismissedRef = useRef<Set<string>>(new Set())
  const checkTimer = useRef<number | undefined>(undefined)
  const saveTimer = useRef<number | undefined>(undefined)
  const contentRef = useRef(content)
  contentRef.current = content
  const dialectRef = useRef(dialect)
  dialectRef.current = dialect
  const titleRef = useRef(title)
  titleRef.current = title

  useEffect(() => {
    if (!stored.current || stored.current.kind !== 'sheet') navigate('/docs', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(t)
  }, [notice])

  const runCheck = useCallback(() => {
    const found: SheetAlert[] = []
    let scanned = 0
    outer: for (let s = 0; s < contentRef.current.sheets.length; s++) {
      const { rows } = contentRef.current.sheets[s]
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          const value = rows[r][c]
          if (!value || !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2}/.test(value)) continue
          if (++scanned > MAX_SCANNED_CELLS) break outer
          for (const a of check(value, dialectRef.current)) {
            if (dismissedRef.current.has(fingerprint(a))) continue
            found.push({ key: `${s}:${r}:${c}:${a.ruleId}:${a.begin}`, sheet: s, r, c, alert: a })
            if (found.length >= 200) break outer
          }
        }
      }
    }
    setAlerts(found)
    setActiveKey((prev) => (prev && found.some((f) => f.key === prev) ? prev : null))
  }, [])

  const scheduleCheck = useCallback(() => {
    window.clearTimeout(checkTimer.current)
    checkTimer.current = window.setTimeout(runCheck, 500)
  }, [runCheck])

  const scheduleSave = useCallback(() => {
    if (!id) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      const filled = contentRef.current.sheets.reduce(
        (n, s) => n + s.rows.reduce((m, r) => m + r.filter(Boolean).length, 0),
        0,
      )
      updateDoc(id, {
        title: titleRef.current,
        dialect: dialectRef.current,
        content: contentRef.current,
        words: filled,
      })
    }, 700)
  }, [id])

  useEffect(() => {
    runCheck()
  }, [runCheck])

  const setCell = (r: number, c: number, value: string) => {
    setContent((prev) => {
      const sheets = [...prev.sheets]
      const rows = sheets[sheetIdx].rows.map((row) => [...row])
      while (rows.length <= r) rows.push([])
      while (rows[r].length <= c) rows[r].push('')
      rows[r][c] = value
      sheets[sheetIdx] = { ...sheets[sheetIdx], rows }
      return { ...prev, sheets }
    })
    scheduleCheck()
    scheduleSave()
  }

  const acceptAlert = (sa: SheetAlert, index = 0) => {
    const value = contentRef.current.sheets[sa.sheet].rows[sa.r]?.[sa.c] ?? ''
    const repl = sa.alert.replacements[index]
    if (repl === undefined) return
    const next = value.slice(0, sa.alert.begin) + repl + value.slice(sa.alert.end)
    setSheetIdx(sa.sheet)
    setCell(sa.r, sa.c, next)
    window.clearTimeout(checkTimer.current)
    // re-check on next tick so state has settled
    window.setTimeout(runCheck, 0)
  }

  const dismissAlert = (sa: SheetAlert) => {
    dismissedRef.current.add(fingerprint(sa.alert))
    runCheck()
  }

  const jumpTo = (sa: SheetAlert) => {
    setSheetIdx(sa.sheet)
    setActive({ r: sa.r, c: sa.c })
    setActiveKey(sa.key)
    document
      .querySelector(`[data-cell="${sa.r}-${sa.c}"]`)
      ?.scrollIntoView({ block: 'center', inline: 'center' })
  }

  const sheet = content.sheets[sheetIdx] ?? content.sheets[0]
  const usedRows = sheet.rows.length
  const usedCols = sheet.rows.reduce((m, r) => Math.max(m, r.length), 0)
  const nRows = Math.min(Math.max(usedRows + 12, MIN_ROWS), MAX_RENDER_ROWS)
  const nCols = Math.max(usedCols + 3, MIN_COLS)

  const flagged = useMemo(() => {
    const set = new Set<string>()
    for (const a of alerts) if (a.sheet === sheetIdx) set.add(`${a.r}-${a.c}`)
    return set
  }, [alerts, sheetIdx])

  if (!stored.current) return null

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
          placeholder="Untitled spreadsheet"
          aria-label="Spreadsheet title"
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
          onChange={(e) => {
            setDialect(e.target.value as Dialect)
            dialectRef.current = e.target.value as Dialect
            runCheck()
            scheduleSave()
          }}
          aria-label="Language and dialect"
        >
          {Object.entries(DIALECT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button className="btn" onClick={() => exportXlsx(contentRef.current, titleRef.current)}>
          Export .xlsx
        </button>
        <button
          className="btn btn--primary mobile-only panel-toggle"
          onClick={() => setPanelOpen((v) => !v)}
        >
          {alerts.length > 0 ? `Review (${alerts.length})` : 'Review'}
        </button>
      </div>

      <div className="sheet-tabs">
        {content.sheets.map((s, i) => (
          <button
            key={i}
            className={i === sheetIdx ? 'on' : ''}
            onClick={() => {
              setSheetIdx(i)
              setActive(null)
            }}
          >
            {s.name}
          </button>
        ))}
        <span className="count">
          {usedRows.toLocaleString()} rows · text in cells is checked as you type
        </span>
      </div>

      <div className="editor-body">
        <div className="sheet-scroll">
          <table className="sheet">
            <thead>
              <tr>
                <th className="rowhead" />
                {Array.from({ length: nCols }, (_, c) => (
                  <th key={c}>{colName(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: nRows }, (_, r) => (
                <tr key={r}>
                  <th className="rowhead">{r + 1}</th>
                  {Array.from({ length: nCols }, (_, c) => {
                    const value = sheet.rows[r]?.[c] ?? ''
                    const isActive = active?.r === r && active?.c === c
                    return (
                      <td
                        key={c}
                        data-cell={`${r}-${c}`}
                        className={`${flagged.has(`${r}-${c}`) ? 'flag' : ''}${isActive ? ' sel' : ''}`}
                        onClick={() => setActive({ r, c })}
                      >
                        {isActive ? (
                          <input
                            autoFocus
                            value={value}
                            onChange={(e) => setCell(r, c, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setActive({ r: r + 1, c })
                              else if (e.key === 'Escape') setActive(null)
                              else if (e.key === 'Tab') {
                                e.preventDefault()
                                setActive({ r, c: c + 1 })
                              }
                            }}
                            onBlur={() => setActive((a) => (a?.r === r && a?.c === c ? null : a))}
                          />
                        ) : (
                          <span>{value}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {usedRows > MAX_RENDER_ROWS && (
            <p className="sheet-note">
              Showing the first {MAX_RENDER_ROWS} rows — the rest of the data is kept and exported.
            </p>
          )}
        </div>

        {panelOpen && <div className="panel-backdrop mobile-only" onClick={() => setPanelOpen(false)} />}

        <aside className={`panel${panelOpen ? ' open' : ''}`}>
          <button className="panel-close mobile-only" onClick={() => setPanelOpen(false)} aria-label="Close">×</button>
          <h2>Suggestions</h2>
          <p className="sub">{alerts.length} across the workbook</p>
          {alerts.length === 0 ? (
            <div className="clean">
              <span className="mark">✓</span>
              Nothing to flag in your cells.
            </div>
          ) : (
            alerts.map((sa) => (
              <SuggestionCard
                key={sa.key}
                alert={sa.alert}
                active={sa.key === activeKey}
                location={`${content.sheets[sa.sheet].name} · ${colName(sa.c)}${sa.r + 1}`}
                onClick={() => jumpTo(sa)}
                onAccept={(index) => acceptAlert(sa, index)}
                onDismiss={() => dismissAlert(sa)}
              />
            ))
          )}
        </aside>
      </div>

      {notice && <div className="notice">{notice}</div>}
    </div>
  )
}
