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
        <button className="btn btn--quiet" title="How to use Pluma" onClick={() => window.dispatchEvent(new Event('pluma:guide'))}>How it works</button>
        <Link to="/extension" className="btn btn--quiet">For your browser</Link>
        <Link to="/word" className="btn btn--quiet">Pluma for Word</Link>
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

        <section className="home-get">
          <h2 className="home-get-title">Get Pluma everywhere — free</h2>
          <div className="home-get-grid">
            <div className="get-card">
              <span className="get-kicker">Browser extension</span>
              <h3>In every text box on the web</h3>
              <p>Grammar, spelling and clarity in search boxes, forms, posts and web email — on your device.</p>
              <div className="get-actions">
                <a className="btn btn--primary" href="/pluma-extension.zip" download="pluma-extension.zip">↓ Download</a>
                <Link className="btn btn--quiet" to="/extension">How to install</Link>
              </div>
            </div>
            <div className="get-card">
              <span className="get-kicker">Microsoft Word</span>
              <h3>Pluma inside Word</h3>
              <p>The same checks in a panel inside Word — on Windows, Mac, or the web. One small file to add.</p>
              <div className="get-actions">
                <a className="btn btn--primary" href="/pluma-word.xml" download="pluma-word.xml">↓ Download</a>
                <Link className="btn btn--quiet" to="/word">How to install</Link>
              </div>
            </div>
          </div>
        </section>

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

      <footer>
        Pluma · writing assistant for students · documents stay in your browser
        <span className="foot-sep"> · </span>
        <a href="/privacy.html">Privacy</a>
        <span className="foot-sep"> · </span>
        <a href="/terms.html">Terms</a>
      </footer>
      {notice && <div className="notice">{notice}</div>}
    </div>
  )
}
