import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createDoc, listDocsFull, removeDoc, type StoredDoc } from '../store/documents'
import { DIALECT_LABELS } from '../engine/types'
import { pickAndImport, routeFor } from '../files/upload'
import { newSheetContent } from '../files/xlsx-import'
import { deleteBlob } from '../store/blobs'
import { textPreview, recencyBucket, RECENCY_ORDER, type RecencyBucket } from '../store/preview'

function kindLabel(d: StoredDoc): string {
  if (d.kind === 'sheet') return 'Spreadsheet'
  if (d.kind === 'pdf') return 'PDF'
  return DIALECT_LABELS[d.dialect]
}

function metaLine(d: StoredDoc): string {
  const count =
    d.kind === 'pdf' ? '' : ` · ${d.words.toLocaleString()} ${d.kind === 'sheet' ? 'cells' : 'words'}`
  return `${kindLabel(d)}${count} · ${new Date(d.updatedAt).toLocaleDateString()}`
}

export default function Documents() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState<StoredDoc[]>(() => listDocsFull())
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(t)
  }, [notice])

  const newDoc = () => {
    const doc = createDoc()
    navigate(`/doc/${doc.id}`)
  }

  const newSheet = () => {
    const doc = createDoc({ title: 'Untitled spreadsheet', kind: 'sheet', content: newSheetContent() })
    navigate(`/sheet/${doc.id}`)
  }

  const upload = () => pickAndImport((doc) => navigate(routeFor(doc)), setNotice)

  const del = (id: string) => {
    removeDoc(id)
    void deleteBlob(id)
    setDocs(listDocsFull())
  }

  const open = (d: StoredDoc) => navigate(routeFor(d))

  // the single most-recently-touched document, for "continue where you left off"
  const resume = useMemo(() => {
    if (docs.length === 0) return null
    return [...docs].sort(
      (a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt),
    )[0]
  }, [docs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return docs
    return docs.filter(
      (d) =>
        (d.title || 'untitled').toLowerCase().includes(q) ||
        textPreview(d, 200).toLowerCase().includes(q),
    )
  }, [docs, query])

  // group filtered docs by recency bucket, preserving newest-first order
  const groups = useMemo(() => {
    const map = new Map<RecencyBucket, StoredDoc[]>()
    for (const d of filtered) {
      const b = recencyBucket(d.updatedAt)
      ;(map.get(b) ?? map.set(b, []).get(b)!).push(d)
    }
    return RECENCY_ORDER.filter((b) => map.has(b)).map((b) => ({ bucket: b, items: map.get(b)! }))
  }, [filtered])

  const card = (d: StoredDoc) => (
    <div key={d.id} className="doc-card" onClick={() => open(d)}>
      <div className="doc-card-main">
        <div className="title">{d.title || 'Untitled document'}</div>
        <div className="preview">{textPreview(d)}</div>
        <div className="meta">{metaLine(d)}</div>
      </div>
      <button
        className="btn btn--quiet btn--danger"
        onClick={(e) => {
          e.stopPropagation()
          if (window.confirm(`Delete “${d.title || 'Untitled document'}”?`)) del(d.id)
        }}
      >
        Delete
      </button>
    </div>
  )

  return (
    <>
      <div className="topbar">
        <Link to="/" className="brand">Plu<em>ma</em></Link>
      </div>
      <div className="docs">
        <div className="head">
          <h1>Documents</h1>
          <div className="row">
            <button className="btn" onClick={upload}>Open a file</button>
            <button className="btn" onClick={newSheet}>New spreadsheet</button>
            <button className="btn btn--primary" onClick={newDoc}>New document</button>
          </div>
        </div>

        {docs.length === 0 ? (
          <div className="empty">
            Nothing here yet. Start a new document or open a Word, PDF or
            Excel file — it opens as a clean page you can work on right away.
          </div>
        ) : (
          <>
            {resume && (
              <button className="resume-strip" onClick={() => open(resume)}>
                <div className="resume-text">
                  <span className="resume-label">Continue where you left off</span>
                  <span className="resume-title">{resume.title || 'Untitled document'}</span>
                  <span className="resume-preview">{textPreview(resume, 90)}</span>
                </div>
                <span className="resume-arrow">›</span>
              </button>
            )}

            <input
              className="doc-search"
              placeholder="Search your documents…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {filtered.length === 0 ? (
              <div className="empty">No documents match “{query}”.</div>
            ) : (
              groups.map(({ bucket, items }) => (
                <div key={bucket} className="doc-group">
                  <h2 className="doc-group-head">{bucket}</h2>
                  <div className="doc-list">{items.map(card)}</div>
                </div>
              ))
            )}
          </>
        )}
      </div>
      {notice && <div className="notice">{notice}</div>}
    </>
  )
}
