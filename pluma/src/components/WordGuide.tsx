import { useEffect, useState } from 'react'

/* ------------------------------------------------------------------ */
/* Animated, video-like demos for installing the Word add-in.          */
/* Reuses the site guide's CSS shell (guide-backdrop / guide-card).     */
/* ------------------------------------------------------------------ */

function WelcomeDemo() {
  return (
    <div className="gd-stage">
      <div className="gd-word-win">
        <div className="gd-word-bar"><span /><span /><span /></div>
        <div className="gd-word-body">
          <div className="gd-word-doc" />
          <div className="gd-word-pane gd-word-pane--in">
            <div className="gd-word-pane-h">Plu<em>ma</em></div>
            <div className="gd-word-card" />
            <div className="gd-word-card" />
          </div>
        </div>
      </div>
    </div>
  )
}

function DownloadDemo() {
  return (
    <div className="gd-stage gd-dl">
      <div className="gd-dl-btn gd-dl-btn--press">↓ Download the add-in</div>
      <div className="gd-dl-file">
        <span className="gd-dl-ext">.xml</span>
        <span className="gd-dl-name">pluma-word</span>
      </div>
    </div>
  )
}

function RibbonDemo({ menu }: { menu: string }) {
  return (
    <div className="gd-stage">
      <div className="gd-ribbon">
        <span>Home</span>
        <span className="gd-ribbon-on">{menu}</span>
        <span>Layout</span>
        <span>Review</span>
        <span className="gd-ribbon-chip gd-ribbon-chip--pop">＋ Add-ins</span>
        <span className="gd-cursor gd-cursor--ribbon">▲</span>
      </div>
      <div className="gd-ribbon-hint">{menu} tab → <b>Add-ins</b></div>
    </div>
  )
}

function UploadDemo() {
  return (
    <div className="gd-stage gd-upl">
      <div className="gd-upl-win">
        <div className="gd-upl-tabs"><span>Store</span><span className="on">My Add-ins</span></div>
        <div className="gd-upl-link gd-upl-link--pop">⤴ Upload My Add-in</div>
        <div className="gd-upl-file gd-upl-file--rise">pluma-word.xml ✓</div>
      </div>
    </div>
  )
}

function DoneDemo() {
  return (
    <div className="gd-stage">
      <div className="gd-word-win">
        <div className="gd-word-bar"><span /><span /><span /></div>
        <div className="gd-word-body">
          <div className="gd-word-doc">
            <span className="gd-done-squiggle" />
          </div>
          <div className="gd-word-pane gd-word-pane--in">
            <div className="gd-word-pane-h">Plu<em>ma</em> ✓</div>
            <div className="gd-word-card gd-word-card--pop" style={{ animationDelay: '0.2s' }} />
            <div className="gd-word-card gd-word-card--pop" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

interface Step {
  title: string
  blurb: string
  demo: () => JSX.Element
  badge?: string
}

const STEPS: Step[] = [
  {
    title: 'Get Pluma inside Word',
    blurb: 'In a few clicks you’ll have the same grammar, clarity and tone checks in a panel right inside Microsoft Word — free, and private. Here’s exactly how, on every platform.',
    demo: WelcomeDemo,
  },
  {
    title: 'Step 1 — Download the file',
    blurb: 'On this page, tap the green “Download the add-in” button. You’ll get a tiny pluma-word.xml file (it lands in your Downloads folder). It just tells Word where to find Pluma — nothing else installs.',
    demo: DownloadDemo,
  },
  {
    title: 'Windows · Word 2016 / 2019 / 2021 / 365',
    badge: 'Windows',
    blurb: 'Open Word and any document. On the top ribbon, click the Insert tab, then the “Add-ins” (or “Get Add-ins”) button.',
    demo: () => <RibbonDemo menu="Insert" />,
  },
  {
    title: 'Windows — upload the file',
    badge: 'Windows',
    blurb: 'In the window that opens, switch to “My Add-ins”, click “Upload My Add-in” (top-right), choose the pluma-word.xml you downloaded, and confirm.',
    demo: UploadDemo,
  },
  {
    title: 'Mac · every MacBook',
    badge: 'Mac',
    blurb: 'Open Word, then from the top menu bar choose Insert → Add-ins → “Get Add-ins”. Open “My Add-ins”, click “Upload My Add-in”, and pick pluma-word.xml. Needs Word 2016 or newer.',
    demo: () => <RibbonDemo menu="Insert" />,
  },
  {
    title: 'Word on the web · any computer',
    badge: 'Web',
    blurb: 'No install at all. Go to word.new (or word.office.com), sign in with a free Microsoft account, open a document, then Home → Add-ins → More Add-ins → “My Add-ins” → “Upload My Add-in” → choose pluma-word.xml. This is the easiest route on old PCs and Windows 7.',
    demo: () => <RibbonDemo menu="Home" />,
  },
  {
    title: 'That’s it — start writing',
    blurb: 'Pluma opens in a panel on the right. Press “Check document” and your fixes appear, each with a reason and a one-click apply. Everything runs on your device.',
    demo: DoneDemo,
  },
]

export default function WordGuide({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setStep((v) => Math.min(STEPS.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setStep((v) => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const s = STEPS[step]
  const last = step === STEPS.length - 1
  const Demo = s.demo

  return (
    <div className="guide-backdrop" onClick={onClose}>
      <div className="guide-card" onClick={(e) => e.stopPropagation()}>
        <button className="guide-skip" onClick={onClose}>Close</button>

        <div className="guide-demo" key={step}>
          <Demo />
        </div>

        <div className="guide-body">
          {s.badge && <span className="guide-soon-tag">{s.badge}</span>}
          <h2>{s.title}</h2>
          <p>{s.blurb}</p>
        </div>

        <div className="guide-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`guide-dot${i === step ? ' on' : ''}`}
              onClick={() => setStep(i)}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        <div className="guide-nav">
          <button className="btn btn--quiet" onClick={() => setStep((v) => Math.max(0, v - 1))} disabled={step === 0}>
            Back
          </button>
          {last ? (
            <button className="btn btn--primary" onClick={onClose}>Got it</button>
          ) : (
            <button className="btn btn--primary" onClick={() => setStep((v) => v + 1)}>Next</button>
          )}
        </div>
      </div>
    </div>
  )
}
