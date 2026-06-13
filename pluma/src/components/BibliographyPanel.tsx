import { useState } from 'react'
import {
  CITE_STYLES,
  fetchByDoi,
  formatCitation,
  formatInText,
  type CiteStyle,
  type Reference,
} from '../engine/citations'

/**
 * Bibliography manager + citation generator. References come from the
 * originality "Add as source" flow or a pasted DOI; each renders in the chosen
 * style with copy / insert actions. Fully client-side.
 */
export default function BibliographyPanel({
  references,
  onRemove,
  onAddByDoi,
  onInsertInText,
  onInsertList,
}: {
  references: Reference[]
  onRemove: (id: string) => void
  onAddByDoi: (ref: Reference) => void
  /** insert an in-text citation at the cursor, e.g. (Smith, 2021) */
  onInsertInText?: (text: string) => void
  /** append the whole formatted bibliography to the document */
  onInsertList?: (text: string) => void
}) {
  const [style, setStyle] = useState<CiteStyle>('apa')
  const [doi, setDoi] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const addDoi = async () => {
    if (busy || !doi.trim()) return
    setBusy(true)
    setErr(null)
    try {
      const ref = await fetchByDoi(doi)
      onAddByDoi(ref)
      setDoi('')
    } catch {
      setErr('Could not find that DOI. Check it and your connection.')
    } finally {
      setBusy(false)
    }
  }

  const copy = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text)
    setCopiedId(id)
    window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500)
  }

  const fullList = references
    .map((r) => formatCitation(r, style).replace(/\*/g, ''))
    .sort((a, b) => a.localeCompare(b))
    .join('\n\n')

  return (
    <>
      <h2>Citations</h2>
      <p className="sub">
        Turn your sources into formatted references. Add by DOI, or use “Add as
        source” in Originality — both land here.
      </p>

      <div className="cite-styles">
        {CITE_STYLES.map((s) => (
          <button
            key={s.id}
            className={`cite-style${style === s.id ? ' on' : ''}`}
            onClick={() => setStyle(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="src-add" style={{ marginTop: 12 }}>
        <input
          placeholder="Paste a DOI (e.g. 10.1038/s41586-020-2649-2)"
          value={doi}
          onChange={(e) => setDoi(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void addDoi() }}
        />
        <div className="row">
          <button className="btn btn--primary" disabled={busy || !doi.trim()} onClick={addDoi}>
            {busy ? 'Looking up…' : 'Add by DOI'}
          </button>
        </div>
        {err && <div className="find-msg">{err}</div>}
      </div>

      <div style={{ height: 16 }} />

      {references.length === 0 ? (
        <div className="clean">No references yet. Add one by DOI, or from the Originality tab.</div>
      ) : (
        <>
          {references.map((r) => {
            const formatted = formatCitation(r, style)
            return (
              <div key={r.id} className="cite-card">
                <div className="cite-text" dangerouslySetInnerHTML={{ __html: emphasize(formatted) }} />
                <div className="cite-actions">
                  <button className="btn btn--quiet" onClick={() => copy(r.id, formatted.replace(/\*/g, ''))}>
                    {copiedId === r.id ? '✓ Copied' : 'Copy'}
                  </button>
                  {onInsertInText && (
                    <button className="btn btn--quiet" onClick={() => onInsertInText(formatInText(r, style))}>
                      Cite in text
                    </button>
                  )}
                  <button className="btn btn--quiet btn--danger" onClick={() => onRemove(r.id)}>Remove</button>
                </div>
              </div>
            )
          })}
          {onInsertList && (
            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              onClick={() => onInsertList(`References\n\n${fullList}`)}
            >
              Insert bibliography into document
            </button>
          )}
        </>
      )}
    </>
  )
}

/** Render *italic* spans as <em> for the on-screen preview (escaping the rest). */
function emphasize(s: string): string {
  const escaped = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>')
}
