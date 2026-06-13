import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { checkAsync } from '../engine/checker'
import { getPersonalWords } from '../engine/personal'
import { DIALECT_LABELS, type Alert, type Dialect } from '../engine/types'
import { createDoc, getDoc, updateDoc, touchDoc } from '../store/documents'
import { getBlob } from '../store/blobs'
import { loadPdf, renderPage, type RenderedPage } from '../files/pdf-render'
import { exportCorrectedPdf, type Correction } from '../files/pdf-export'
import { needsOcr, ocrPage, releaseOcr } from '../files/pdf-ocr'
import SuggestionCard from '../components/SuggestionCard'

const MAX_PAGES = 60
const MAX_OCR_PAGES = 15
const SCALE = 1.4

interface PdfAlert {
  alert: Alert
  pageIndex: number
  itemIndex: number
  charStart: number
  charEnd: number
  rect: { left: number; top: number; width: number; height: number }
}

interface Applied {
  pageIndex: number
  itemIndex: number
  fullStr: string
}

export default function PdfEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const meta = useRef(id ? getDoc(id) : null)

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [pages, setPages] = useState<RenderedPage[]>([])
  const [dialect, setDialect] = useState<Dialect>(meta.current?.dialect ?? 'en-US')
  const [alerts, setAlerts] = useState<PdfAlert[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [applied, setApplied] = useState<Map<string, Applied>>(new Map())
  const [panelOpen, setPanelOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [ocrStatus, setOcrStatus] = useState<string | null>(null)

  const bytesRef = useRef<ArrayBuffer | null>(null)
  const pagesRef = useRef<RenderedPage[]>([])
  const loadedRef = useRef(false)

  // persist accepted corrections so they survive closing/reopening the PDF
  useEffect(() => {
    if (!id || !loadedRef.current) return
    updateDoc(id, { editorState: { corrections: [...applied.values()] } })
  }, [applied, id])

  // --- load + render ---
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!id || !meta.current || meta.current.kind !== 'pdf') {
        navigate('/docs', { replace: true })
        return
      }
      try {
        const bytes = await getBlob(id)
        if (!bytes) throw new Error('The original PDF is no longer stored on this device.')
        bytesRef.current = bytes.slice(0)
        const doc = await loadPdf(bytes)
        const count = Math.min(doc.numPages, MAX_PAGES)
        if (doc.numPages > MAX_PAGES) setTruncated(true)
        const rendered: RenderedPage[] = []
        for (let i = 0; i < count; i++) {
          if (cancelled) return
          rendered.push(await renderPage(doc, i, SCALE))
        }
        if (cancelled) return
        pagesRef.current = rendered
        setPages(rendered)
        setStatus('ready')

        // scanned pages (no text layer) → OCR them so checking + fixing work
        const scanned = rendered.filter(needsOcr).slice(0, MAX_OCR_PAGES)
        if (scanned.length > 0) {
          let done = 0
          for (const page of scanned) {
            if (cancelled) break
            setOcrStatus(`Reading scanned page ${page.pageIndex + 1}… (${++done}/${scanned.length})`)
            try {
              await ocrPage(page, dialect, SCALE)
            } catch {
              // OCR engine failed to load (offline?) — leave the page as image-only
            }
          }
          void releaseOcr()
          if (cancelled) return
          setOcrStatus(null)
          setPages([...rendered])
        }

        // restore accepted corrections from a previous session
        const saved = meta.current.editorState?.corrections ?? []
        if (saved.length > 0) {
          const restored = new Map<string, Applied>()
          for (const c of saved) {
            if (rendered[c.pageIndex]?.items[c.itemIndex]) {
              restored.set(`${c.pageIndex}:${c.itemIndex}`, c)
            }
          }
          if (restored.size > 0) setApplied(restored)
        }
        loadedRef.current = true
        touchDoc(id)
        void runCheck(rendered, dialect)
      } catch (e) {
        if (cancelled) return
        setErrorMsg(e instanceof Error ? e.message : 'Could not open this PDF.')
        setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const runCheck = useCallback(async (rendered: RenderedPage[], dia: Dialect) => {
    const personal = getPersonalWords()
    const all: PdfAlert[] = []
    for (const page of rendered) {
      const found = await checkAsync(page.text, dia, personal)
      for (const a of found) {
        // anchor: the alert must fall entirely within a single text item
        const i = lastIndexLE(page.offsets, a.begin)
        if (i < 0) continue
        const itemStart = page.offsets[i]
        const item = page.items[i]
        const itemEnd = itemStart + item.str.length
        if (a.begin < itemStart || a.end > itemEnd) continue // spans items → skip
        const charStart = a.begin - itemStart
        const charEnd = a.end - itemStart
        const frac = item.str.length ? charStart / item.str.length : 0
        const wfrac = item.str.length ? (charEnd - charStart) / item.str.length : 1
        all.push({
          alert: a,
          pageIndex: page.pageIndex,
          itemIndex: i,
          charStart,
          charEnd,
          rect: {
            left: item.left + frac * item.width,
            top: item.top,
            width: Math.max(6, wfrac * item.width),
            height: item.height,
          },
        })
      }
    }
    setAlerts(all)
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(t)
  }, [notice])

  const accept = (pa: PdfAlert, index = 0) => {
    const repl = pa.alert.replacements[index]
    if (repl === undefined) return
    const page = pagesRef.current[pa.pageIndex]
    const item = page.items[pa.itemIndex]
    const key = `${pa.pageIndex}:${pa.itemIndex}`
    const base = applied.get(key)?.fullStr ?? item.str
    // apply within the (possibly already-corrected) item string
    const start = applied.has(key) ? base.indexOf(pa.alert.text) : pa.charStart
    const fullStr =
      start >= 0
        ? base.slice(0, start) + repl + base.slice(start + pa.alert.text.length)
        : base.slice(0, pa.charStart) + repl + base.slice(pa.charEnd)
    setApplied((prev) => new Map(prev).set(key, { pageIndex: pa.pageIndex, itemIndex: pa.itemIndex, fullStr }))
    setAlerts((prev) => prev.filter((x) => x !== pa))
    if (activeId === pa.alert.id) setActiveId(null)
  }

  const dismiss = (pa: PdfAlert) => {
    setAlerts((prev) => prev.filter((x) => x !== pa))
    if (activeId === pa.alert.id) setActiveId(null)
  }

  const jumpTo = (pa: PdfAlert) => {
    setActiveId(pa.alert.id)
    document
      .querySelector(`[data-pa="${pa.pageIndex}-${pa.itemIndex}-${pa.charStart}"]`)
      ?.scrollIntoView({ block: 'center' })
  }

  const onDialectChange = (d: Dialect) => {
    setDialect(d)
    if (id) updateDoc(id, { dialect: d })
    void runCheck(pagesRef.current, d)
  }

  const download = async () => {
    if (!bytesRef.current) return
    const corrections: Correction[] = [...applied.values()].map((a) => {
      const item = pagesRef.current[a.pageIndex].items[a.itemIndex]
      return {
        pageIndex: a.pageIndex,
        pdfX: item.pdfX,
        pdfY: item.pdfY,
        pdfFontSize: item.pdfFontSize,
        pdfWidth: item.pdfWidth,
        replacement: a.fullStr,
      }
    })
    try {
      await exportCorrectedPdf(bytesRef.current.slice(0), corrections, meta.current?.title ?? 'document')
    } catch {
      setNotice('Export failed — please try again.')
    }
  }

  const convertToText = () => {
    const html = pagesRef.current
      .map((p) => `<p>${p.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`)
      .join('')
    const doc = createDoc({ title: `${meta.current?.title ?? 'document'} (text)`, content: html, dialect })
    navigate(`/doc/${doc.id}`)
  }

  if (status === 'error') {
    return (
      <div className="pdf-page">
        <div className="editor-top">
          <Link to="/docs" className="btn btn--quiet">‹ Documents</Link>
        </div>
        <div className="empty" style={{ margin: 40 }}>{errorMsg}</div>
      </div>
    )
  }

  const appliedFor = (pageIndex: number, itemIndex: number) => applied.get(`${pageIndex}:${itemIndex}`)

  return (
    <div className="pdf-page">
      <div className="editor-top">
        <Link to="/docs" className="btn btn--quiet" title="Back to documents">‹ Documents</Link>
        <span className="title" style={{ fontFamily: 'var(--serif)' }}>{meta.current?.title}</span>
        <span className="issue-pill">
          <span className={`n${alerts.length === 0 ? ' n--ok' : ''}`}>
            {alerts.length === 0 ? '✓' : alerts.length}
          </span>
          {alerts.length === 1 ? 'issue' : 'issues'}
        </span>
        <select className="dialect" value={dialect} onChange={(e) => onDialectChange(e.target.value as Dialect)} aria-label="Dialect">
          {Object.entries(DIALECT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn" onClick={convertToText} title="Extract the text into an editable document">Convert to text</button>
        <button className="btn btn--primary" onClick={download}>Download PDF</button>
        <button className="btn btn--primary mobile-only panel-toggle" onClick={() => setPanelOpen((v) => !v)}>
          {alerts.length > 0 ? `Review (${alerts.length})` : 'Review'}
        </button>
      </div>

      <div className="editor-body">
        <div className="pdf-scroll">
          {status === 'loading' && <div className="empty" style={{ margin: 40 }}>Rendering the PDF…</div>}
          {ocrStatus && <div className="ocr-banner">⟳ {ocrStatus} — scanned pages are being made checkable.</div>}
          {pages.map((page) => (
            <PageView
              key={page.pageIndex}
              page={page}
              alerts={alerts.filter((a) => a.pageIndex === page.pageIndex)}
              activeId={activeId}
              appliedFor={appliedFor}
              onAlertClick={(pa) => {
                setActiveId(pa.alert.id)
                setPanelOpen(true)
              }}
            />
          ))}
          {truncated && (
            <p className="sheet-note">Showing the first {MAX_PAGES} pages. The rest are kept in the original and exported.</p>
          )}
        </div>

        {panelOpen && <div className="panel-backdrop mobile-only" onClick={() => setPanelOpen(false)} />}
        <aside className={`panel${panelOpen ? ' open' : ''}`}>
          <button className="panel-close mobile-only" onClick={() => setPanelOpen(false)} aria-label="Close">×</button>
          <h2>Suggestions</h2>
          <p className="sub">{alerts.length} found · view stays pixel-faithful</p>
          {alerts.length === 0 ? (
            <div className="clean"><span className="mark">✓</span>Nothing to flag on these pages.</div>
          ) : (
            alerts.map((pa) => (
              <SuggestionCard
                key={pa.alert.id}
                alert={pa.alert}
                active={pa.alert.id === activeId}
                location={`Page ${pa.pageIndex + 1}`}
                onClick={() => jumpTo(pa)}
                onAccept={(index) => accept(pa, index)}
                onDismiss={() => dismiss(pa)}
              />
            ))
          )}
        </aside>
      </div>

      {notice && <div className="notice">{notice}</div>}
    </div>
  )
}

function PageView({
  page,
  alerts,
  activeId,
  appliedFor,
  onAlertClick,
}: {
  page: RenderedPage
  alerts: PdfAlert[]
  activeId: string | null
  appliedFor: (p: number, i: number) => Applied | undefined
  onAlertClick: (pa: PdfAlert) => void
}) {
  const holder = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = holder.current
    if (!el) return
    el.innerHTML = ''
    el.appendChild(page.canvas)
  }, [page])

  // corrections that touch this page
  const corrections: { item: number; str: string }[] = []
  for (let i = 0; i < page.items.length; i++) {
    const a = appliedFor(page.pageIndex, i)
    if (a) corrections.push({ item: i, str: a.fullStr })
  }

  return (
    <div className="pdf-page-wrap" style={{ width: page.width, height: page.height }}>
      <div ref={holder} className="pdf-canvas-holder" />
      {/* correction overlays (white-out original + show new word) */}
      {corrections.map(({ item, str }) => {
        const it = page.items[item]
        return (
          <div
            key={`c${item}`}
            className="pdf-correction"
            style={{ left: it.left, top: it.top, height: it.height, fontSize: it.fontSize, lineHeight: `${it.height}px` }}
          >
            {str}
          </div>
        )
      })}
      {/* error underlines */}
      {alerts.map((pa) => (
        <div
          key={pa.alert.id}
          data-pa={`${pa.pageIndex}-${pa.itemIndex}-${pa.charStart}`}
          className={`pdf-underline pdf-underline--${pa.alert.category}${pa.alert.id === activeId ? ' active' : ''}`}
          style={{ left: pa.rect.left, top: pa.rect.top, width: pa.rect.width, height: pa.rect.height }}
          onClick={() => onAlertClick(pa)}
          title={pa.alert.message}
        />
      ))}
    </div>
  )
}

/** largest index i with arr[i] <= value (arr is ascending). */
function lastIndexLE(arr: number[], value: number): number {
  let lo = 0
  let hi = arr.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] <= value) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}
