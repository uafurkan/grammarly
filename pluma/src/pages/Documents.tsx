import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createDoc, listDocs, removeDoc, type DocMeta } from '../store/documents'
import { DIALECT_LABELS } from '../engine/types'
import { pickAndImport } from '../files/upload'

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

  const upload = () => pickAndImport((doc) => navigate(`/doc/${doc.id}`), setNotice)

  const del = (id: string) => {
    removeDoc(id)
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
            <button className="btn" onClick={upload}>Open a Word document</button>
            <button className="btn btn--primary" onClick={newDoc}>New document</button>
          </div>
        </div>

        {docs.length === 0 ? (
          <div className="empty">
            Nothing here yet. Start a new document or open a .docx — it opens
            as a clean page you can write on right away.
          </div>
        ) : (
          <div className="doc-list">
            {docs.map((d) => (
              <div key={d.id} className="doc-card" onClick={() => navigate(`/doc/${d.id}`)}>
                <div>
                  <div className="title">{d.title || 'Untitled document'}</div>
                  <div className="meta">
                    {DIALECT_LABELS[d.dialect]} · {d.words.toLocaleString()} words ·{' '}
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
