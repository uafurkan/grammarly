import { useState } from 'react'
import { Link } from 'react-router-dom'

type Platform = 'web' | 'windows' | 'mac'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'web'
  const ua = navigator.userAgent
  if (/Win/.test(ua)) return 'windows'
  if (/Mac/.test(ua)) return 'mac'
  return 'web'
}

const STEPS: Record<Platform, { label: string; note: string; steps: string[] }> = {
  web: {
    label: 'Word on the web',
    note: 'Works in any browser — including on Windows 7 and older Macs. Nothing to install.',
    steps: [
      'Open Word on the web and open (or create) a document.',
      'Go to the Home tab → Add-ins → More Add-ins.',
      'Open the “My Add-ins” tab → “Upload My Add-in”.',
      'Choose the pluma-word.xml file you downloaded.',
      'Click “Open Pluma” on the Home tab — done.',
    ],
  },
  windows: {
    label: 'Windows (7 · 8 · 10 · 11)',
    note: 'The desktop add-in needs Word 2016 or newer (Windows 8.1/10/11). On Windows 7 with older Office, use “Word on the web” instead — it works the same.',
    steps: [
      'Download the add-in (button above).',
      'In Word: Insert tab → Add-ins → “Get Add-ins”.',
      'Open the “My Add-ins” tab → click “Upload My Add-in” (top-right).',
      'Browse to pluma-word.xml → Upload.',
      'Pluma appears on the Home tab → “Open Pluma”.',
    ],
  },
  mac: {
    label: 'Mac (all MacBooks)',
    note: 'Needs Word 2016 or newer. Works on every MacBook — Intel and Apple Silicon. Or just use “Word on the web”.',
    steps: [
      'Download the add-in (button above).',
      'In Word: Insert menu → Add-ins → “Get Add-ins”.',
      'Open the “My Add-ins” tab → click “Upload My Add-in”.',
      'Choose pluma-word.xml → Upload.',
      'Pluma appears on the Home tab → “Open Pluma”.',
    ],
  },
}

/**
 * Install page for the Word add-in. A website cannot silently install an add-in
 * into desktop Office (Microsoft blocks that for security), so this offers the
 * legitimate one-file sideload — download the manifest, upload it in Word —
 * with OS-aware, step-by-step guidance.
 */
export default function WordInstall() {
  const [tab, setTab] = useState<Platform>(detectPlatform)

  return (
    <div className="home">
      <div className="topbar">
        <Link to="/" className="brand">Plu<em>ma</em></Link>
        <span style={{ flex: 1 }} />
        <Link to="/docs" className="btn btn--quiet">My documents</Link>
      </div>

      <main className="install">
        <h1>Pluma, inside Word.</h1>
        <p className="tagline">
          The same grammar, clarity, tone, and readability checks — running in a
          panel right inside Microsoft Word. Free, and your text never leaves your
          device. Works on Windows, Mac, and Word on the web.
        </p>

        <div className="install-cta">
          <a className="btn btn--primary" href="/pluma-word.xml" download="pluma-word.xml">
            ↓ Download the add-in
          </a>
          <a className="btn" href="https://word.new" target="_blank" rel="noreferrer">
            Open Word on the web
          </a>
        </div>
        <p className="install-fine">
          You'll get a small <code>pluma-word.xml</code> file. It just tells Word
          where to load Pluma from — there's nothing else to install.
        </p>

        <div className="install-tabs">
          {(Object.keys(STEPS) as Platform[]).map((p) => (
            <button key={p} className={`install-tab${tab === p ? ' on' : ''}`} onClick={() => setTab(p)}>
              {STEPS[p].label}
            </button>
          ))}
        </div>

        <div className="install-card">
          <ol className="install-steps">
            {STEPS[tab].steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className="install-note">{STEPS[tab].note}</p>
        </div>

        <div className="notes">
          <div>
            <h3>One brain, everywhere</h3>
            <p>The add-in runs the exact same engine as this website — so Word gets the same checks, with no second product to maintain.</p>
          </div>
          <div>
            <h3>Private by default</h3>
            <p>Checking happens on your device. Your document text isn't uploaded anywhere to be analysed.</p>
          </div>
          <div>
            <h3>Why a download, not one click?</h3>
            <p>For security, Microsoft doesn't let any website push an add-in straight into your Word. The one-file upload above is the official, safe way.</p>
          </div>
        </div>
      </main>

      <footer>Pluma · writing assistant for students · documents stay in your browser</footer>
    </div>
  )
}
