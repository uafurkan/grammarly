import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createDoc, getDoc, listDocs, removeDoc, type DocMeta } from '../store/documents'
import { DIALECT_LABELS } from '../engine/types'
import { pickAndImport, routeFor } from '../files/upload'
import { newSheetContent } from '../files/xlsx-import'
import { deleteBlob } from '../store/blobs'

export default function Documents() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState<DocMeta[]>(() => listDocs())
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
    setDocs(listDocs())
  }

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
          <div className="doc-list">
            {docs.map((d) => (
              <div
                key={d.id}
                className="doc-card"
                onClick={() => {
                  const full = getDoc(d.id)
                  if (full) navigate(routeFor(full))
                }}
              >
                <div>
                  <div className="title">{d.title || 'Untitled document'}</div>
                  <div className="meta">
                    {d.kind === 'sheet' ? 'Spreadsheet' : d.kind === 'pdf' ? 'PDF' : DIALECT_LABELS[d.dialect]}
                    {d.kind === 'pdf' ? '' : ` · ${d.words.toLocaleString()} ${d.kind === 'sheet' ? 'cells' : 'words'}`} ·{' '}
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </div>
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
            ))}
          </div>
        )}
      </div>
      {notice && <div className="notice">{notice}</div>}
    </>
  )
}
