import { useState } from 'react'
import { Link } from 'react-router-dom'

type Browser = 'chrome' | 'edge' | 'firefox'

function detectBrowser(): Browser {
  if (typeof navigator === 'undefined') return 'chrome'
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'edge'
  if (/Firefox\//.test(ua)) return 'firefox'
  return 'chrome'
}

interface Guide {
  label: string
  tagline: string
  note: string
  steps: { title: string; detail?: string }[]
}

const UNZIP = {
  title: 'Unzip the file',
  detail: 'You’ll get a folder named “pluma-extension”. Keep it somewhere you won’t delete — the browser loads Pluma from this folder.',
}

const GUIDES: Record<Browser, Guide> = {
  chrome: {
    label: 'Chrome',
    tagline: 'Google Chrome · Brave · any Chromium browser',
    note: 'This is the developer-mode install while Pluma is in review for the Chrome Web Store. Once it’s published, it’ll be a one-click “Add to Chrome”.',
    steps: [
      { title: 'Download the extension', detail: 'Tap the green button above to save pluma-extension.zip.' },
      UNZIP,
      { title: 'Open chrome://extensions', detail: 'Type chrome://extensions in the address bar and press Enter.' },
      { title: 'Turn on “Developer mode”', detail: 'The switch is at the top-right of the page.' },
      { title: 'Click “Load unpacked”', detail: 'Choose the unzipped “pluma-extension” folder. Done — click into any text box and the Pluma badge appears.' },
    ],
  },
  edge: {
    label: 'Edge',
    tagline: 'Microsoft Edge',
    note: 'Developer-mode install for now; a one-click listing on Edge Add-ons is on the way.',
    steps: [
      { title: 'Download the extension', detail: 'Tap the green button above to save pluma-extension.zip.' },
      UNZIP,
      { title: 'Open edge://extensions', detail: 'Type edge://extensions in the address bar and press Enter.' },
      { title: 'Turn on “Developer mode”', detail: 'The switch is on the left side of the page.' },
      { title: 'Click “Load unpacked”', detail: 'Choose the unzipped “pluma-extension” folder. Pluma is now active in your text boxes.' },
    ],
  },
  firefox: {
    label: 'Firefox',
    tagline: 'Mozilla Firefox',
    note: 'Firefox loads a temporary add-on that stays until you restart the browser. A permanent signed listing on addons.mozilla.org is planned.',
    steps: [
      { title: 'Download the extension', detail: 'Tap the green button above to save pluma-extension.zip.' },
      UNZIP,
      { title: 'Open about:debugging', detail: 'Type about:debugging in the address bar and press Enter, then click “This Firefox”.' },
      { title: 'Click “Load Temporary Add-on”', detail: 'Open the unzipped folder and pick the manifest.json file inside it.' },
      { title: 'Start writing', detail: 'Pluma is active until you close Firefox. Re-add it the same way next time.' },
    ],
  },
}

/**
 * Install page for the browser extension. Until it’s listed on the web stores,
 * this offers the legitimate developer-mode sideload: download the zip, unzip,
 * load it unpacked. OS/browser-aware, step by step.
 */
export default function ExtensionInstall() {
  const [tab, setTab] = useState<Browser>(detectBrowser)
  const g = GUIDES[tab]

  return (
    <div className="install-page">
      <div className="topbar">
        <Link to="/" className="brand">Plu<em>ma</em></Link>
        <span style={{ flex: 1 }} />
        <Link to="/" className="btn btn--quiet">Home</Link>
        <Link to="/word" className="btn btn--quiet">For Word</Link>
        <Link to="/docs" className="btn btn--quiet">My documents</Link>
      </div>

      <main className="install">
        <header className="install-hero">
          <span className="install-kicker">Pluma for your browser</span>
          <h1>Pluma, in every text box.</h1>
          <p className="install-lede">
            Grammar, spelling and clarity help in any field on the web — search
            boxes, forms, posts, web email. Free, and your text never leaves your
            device.
          </p>

          <div className="install-cta">
            <a className="btn btn--primary install-download" href="/pluma-extension.zip" download="pluma-extension.zip">
              ↓ Download the extension
            </a>
          </div>
          <p className="install-fine">
            You’ll get a small <code>pluma-extension.zip</code>. Unzip it, then
            load the folder in your browser’s extensions page — steps below.
          </p>
        </header>

        <div className="install-tabs" role="tablist">
          {(Object.keys(GUIDES) as Browser[]).map((b) => (
            <button
              key={b}
              role="tab"
              aria-selected={tab === b}
              className={`install-tab${tab === b ? ' on' : ''}`}
              onClick={() => setTab(b)}
            >
              {GUIDES[b].label}
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
            <h3>Works everywhere you type</h3>
            <p>Click into any text field and a small Pluma badge shows how many suggestions there are. Click it to review and accept fixes in place.</p>
          </div>
          <div>
            <h3>Private by default</h3>
            <p>The same engine as the website and Word add-in, running on your device. Nothing you type is uploaded anywhere.</p>
          </div>
          <div>
            <h3>Why a download, not one click?</h3>
            <p>Until the store listings go live, developer mode is the official, safe way to try an unpublished extension. One-click store installs are coming.</p>
          </div>
        </div>
      </main>

      <footer className="install-footer">
        Pluma · writing assistant for students · documents stay in your browser
        <span className="foot-sep"> · </span>
        <a href="/privacy.html">Privacy</a>
        <span className="foot-sep"> · </span>
        <a href="/terms.html">Terms</a>
      </footer>
    </div>
  )
}
