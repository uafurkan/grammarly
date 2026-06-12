import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createDoc } from '../store/documents'
import { pickAndImport } from '../files/upload'

export default function Home() {
  const navigate = useNavigate()
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
          <button className="btn" onClick={upload}>Open a Word document</button>
        </div>

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
              Documents up to 400,000 characters and 25&nbsp;MB — four times
              what the usual tools allow. Your thesis fits.
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
