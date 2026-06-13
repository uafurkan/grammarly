import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createDoc, listDocsFull } from '../store/documents'
import { pickAndImport, routeFor } from '../files/upload'
import { textPreview } from '../store/preview'

export default function Home() {
  const navigate = useNavigate()
  const [notice, setNotice] = useState<string | null>(null)
  const recents = listDocsFull().slice(0, 3)

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(t)
  }, [notice])

  const newDoc = () => {
    const doc = createDoc()
    navigate(`/doc/${doc.id}`)
  }

  const upload = () => pickAndImport((doc) => navigate(routeFor(doc)), setNotice)

  return (
    <div className="home">
      <div className="topbar">
        <Link to="/" className="brand">Plu<em>ma</em></Link>
        <span style={{ flex: 1 }} />
        <Link to="/docs" className="btn btn--quiet">My documents</Link>
      </div>

      <main>
        <h1>Write clearly, in your own voice.</h1>
        <p className="tagline">
          A quiet writing desk for university work. English and Spanish —
          with real attention to the dialect you actually write in.
        </p>
        <div className="actions">
          <button className="btn btn--primary" onClick={newDoc}>Start writing</button>
          <button className="btn" onClick={upload}>Open a file — Word, PDF, Excel</button>
        </div>

        {recents.length > 0 && (
          <div className="home-recents">
            <div className="home-recents-head">
              <h3>Pick up where you left off</h3>
              <Link to="/docs" className="btn btn--quiet">All documents</Link>
            </div>
            <div className="home-recents-list">
              {recents.map((d) => (
                <button key={d.id} className="home-recent" onClick={() => navigate(routeFor(d))}>
                  <span className="home-recent-title">{d.title || 'Untitled document'}</span>
                  <span className="home-recent-preview">{textPreview(d, 70)}</span>
                  <span className="home-recent-meta">
                    {d.kind === 'sheet' ? 'Spreadsheet' : d.kind === 'pdf' ? 'PDF' : 'Document'} ·{' '}
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="notes">
          <div>
            <h3>Two languages, four voices</h3>
            <p>
              American and British English. Peninsular and Latin American
              Spanish. Not one generic model pretending to be all four.
            </p>
          </div>
          <div>
            <h3>Room for real work</h3>
            <p>
              Word, PDF and Excel files up to 100&nbsp;MB — far past what the
              usual tools allow. Your whole thesis fits, and it stays put.
            </p>
          </div>
          <div>
            <h3>Suggestions, not orders</h3>
            <p>
              Every flag comes with a reason. Accept it, dismiss it, and it
              stays dismissed. Your text, your call.
            </p>
          </div>
        </div>
      </main>

      <footer>Pluma · writing assistant for students · documents stay in your browser</footer>
      {notice && <div className="notice">{notice}</div>}
    </div>
  )
}
