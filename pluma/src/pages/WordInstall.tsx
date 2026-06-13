import { useState } from 'react'
import { Link } from 'react-router-dom'

type Platform = 'windows' | 'mac' | 'web'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'windows'
  const ua = navigator.userAgent
  if (/Mac/.test(ua) && !/iPhone|iPad/.test(ua)) return 'mac'
  if (/Win/.test(ua)) return 'windows'
  return 'web'
}

interface Guide {
  label: string
  tagline: string
  note: string
  steps: { title: string; detail?: string }[]
}

const GUIDES: Record<Platform, Guide> = {
  windows: {
    label: 'Windows',
    tagline: 'Windows 7 · 8 · 10 · 11',
    note: 'The desktop add-in needs Word 2016, 2019, 2021 or Microsoft 365. On older Office (2010 / 2013) or Windows 7, use “Word on the web” instead — it works exactly the same and installs nothing.',
    steps: [
      { title: 'Download the add-in file', detail: 'Tap the green “Download the add-in” button above. You’ll get a small pluma-word.xml file (usually in your Downloads folder).' },
      { title: 'Open Word and any document', detail: 'A blank document is fine.' },
      { title: 'Go to Insert → Add-ins', detail: 'On the top ribbon, open the Insert tab, then click “Add-ins” (or “Get Add-ins”).' },
      { title: 'Open “My Add-ins” → “Upload My Add-in”', detail: 'The Upload link is at the top-right of the window.' },
      { title: 'Choose pluma-word.xml', detail: 'Pick the file you just downloaded and confirm. Pluma now opens in a panel on the right.' },
    ],
  },
  mac: {
    label: 'Mac',
    tagline: 'Every MacBook — Intel & Apple Silicon',
    note: 'Needs Word 2016 or newer. If you’re not sure, “Word on the web” always works and installs nothing.',
    steps: [
      { title: 'Download the add-in file', detail: 'Tap the green “Download the add-in” button above to save pluma-word.xml.' },
      { title: 'Open Word and any document' },
      { title: 'Go to Insert menu → Add-ins', detail: 'From the menu bar, choose Insert → Add-ins → “Get Add-ins”.' },
      { title: 'Open “My Add-ins” → “Upload My Add-in”' },
      { title: 'Choose pluma-word.xml', detail: 'Pluma opens in a panel on the right.' },
    ],
  },
  web: {
    label: 'Word on the web',
    tagline: 'Any browser · free · nothing to install',
    note: 'This is the easiest route, and it works on every computer — including Windows 7 and older Macs. You only need a free Microsoft account.',
    steps: [
      { title: 'Download the add-in file', detail: 'Tap the green “Download the add-in” button above.' },
      { title: 'Open Word on the web', detail: 'Go to word.new (or word.office.com) and sign in with a free Microsoft account.' },
      { title: 'Open a document, then Home → Add-ins', detail: 'Click “Add-ins”, then “More Add-ins”.' },
      { title: 'Open “My Add-ins” → “Upload My Add-in”' },
      { title: 'Choose pluma-word.xml', detail: 'Pluma opens in a panel on the right.' },
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
  const [showVersion, setShowVersion] = useState(false)
  const g = GUIDES[tab]

  return (
    <div className="install-page">
      <div className="topbar">
        <Link to="/" className="brand">Plu<em>ma</em></Link>
        <span style={{ flex: 1 }} />
        <Link to="/" className="btn btn--quiet">Home</Link>
        <Link to="/docs" className="btn btn--quiet">My documents</Link>
      </div>

      <main className="install">
        <header className="install-hero">
          <span className="install-kicker">Pluma for Microsoft Word</span>
          <h1>Pluma, right inside Word.</h1>
          <p className="install-lede">
            The same grammar, clarity, tone and readability checks — in a panel
            inside Word. Free, and your text never leaves your device.
          </p>

          <div className="install-cta">
            <a className="btn btn--primary install-download" href="/pluma-word.xml" download="pluma-word.xml">
              ↓ Download the add-in
            </a>
            <a className="btn" href="https://word.new" target="_blank" rel="noreferrer">
              Open Word on the web →
            </a>
          </div>
          <p className="install-fine">
            You’ll get a small <code>pluma-word.xml</code> file — it just tells Word
            where to load Pluma from. There’s nothing else to install.
          </p>
        </header>

        {/* Version helper — the most common point of confusion */}
        <div className={`install-version${showVersion ? ' open' : ''}`}>
          <button className="install-version-q" onClick={() => setShowVersion((v) => !v)}>
            <span>Not sure which version of Office you have?</span>
            <span className="install-chev">{showVersion ? '–' : '+'}</span>
          </button>
          {showVersion && (
            <div className="install-version-a">
              <p>
                Open Word → <b>File</b> → <b>Account</b> → look under <b>“About Word”</b>.
              </p>
              <ul>
                <li><b>2016, 2019, 2021 or Microsoft 365</b> — great, follow the steps below.</li>
                <li><b>2010 or 2013</b> (or no “Account” menu) — your desktop Word is too old, so use the <b>“Word on the web”</b> tab instead. It’s free and works the same.</li>
              </ul>
            </div>
          )}
        </div>

        <div className="install-tabs" role="tablist">
          {(Object.keys(GUIDES) as Platform[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={tab === p}
              className={`install-tab${tab === p ? ' on' : ''}`}
              onClick={() => setTab(p)}
            >
              {GUIDES[p].label}
            </button>
          ))}
        </div>

        <div className="install-card">
          <p className="install-card-sub">{g.tagline}</p>
          <ol className="install-steps">
            {g.steps.map((s, i) => (
              <li key={i}>
                <span className="install-step-n">{i + 1}</span>
                <span className="install-step-body">
                  <span className="install-step-title">{s.title}</span>
                  {s.detail && <span className="install-step-detail">{s.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
          <p className="install-note">{g.note}</p>
        </div>

        <div className="install-features">
          <div>
            <h3>One brain, everywhere</h3>
            <p>The add-in runs the exact same engine as this website — so Word gets the same checks, with no second product to maintain.</p>
          </div>
          <div>
            <h3>Private by default</h3>
            <p>Checking happens on your device. Your document text isn’t uploaded anywhere to be analysed.</p>
          </div>
          <div>
            <h3>Why a download, not one click?</h3>
            <p>For security, Microsoft doesn’t let any website push an add-in straight into Word. This one-file upload is the official, safe way.</p>
          </div>
        </div>
      </main>

      <footer className="install-footer">Pluma · writing assistant for students · documents stay in your browser</footer>
    </div>
  )
}
