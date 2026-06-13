import { useEffect, useState } from 'react'

const SEEN_KEY = 'pluma.guide.v1'

/* ------------------------------------------------------------------ */
/* Animated "video-like" demos — pure CSS motion, restart per step.    */
/* ------------------------------------------------------------------ */

function GrammarDemo() {
  return (
    <div className="gd-stage">
      <div className="gd-line">
        <span>I </span>
        <span className="gd-fix">
          <span className="gd-wrong">recieve</span>
          <span className="gd-right">receive</span>
          <span className="gd-squiggle" />
        </span>
        <span> your note.</span>
      </div>
      <div className="gd-chip gd-chip--pop">receive ✓</div>
    </div>
  )
}

function GhostDemo() {
  return (
    <div className="gd-stage">
      <div className="gd-line gd-type">
        <span>The hypoth</span><span className="gd-ghost">esis</span><span className="gd-caret">▋</span>
      </div>
      <div className="gd-key gd-key--pop">Tab ↹ to accept</div>
    </div>
  )
}

function ToneDemo() {
  const bars: [string, number][] = [['Formal', 78], ['Confident', 64], ['Friendly', 30], ['Analytical', 52], ['Tentative', 18]]
  return (
    <div className="gd-stage gd-tone">
      {bars.map(([name, w], i) => (
        <div className="gd-tone-row" key={name}>
          <span className="gd-tone-name">{name}</span>
          <span className="gd-tone-track"><span className="gd-tone-fill" style={{ ['--w' as string]: `${w}%`, animationDelay: `${i * 0.12}s` }} /></span>
        </div>
      ))}
    </div>
  )
}

function AiDemo() {
  const words = 'The results clearly support the hypothesis and suggest a strong, measurable effect.'.split(' ')
  return (
    <div className="gd-stage">
      <div className="gd-ai-head">✦ Rewrite · on your device</div>
      <div className="gd-ai-text">
        {words.map((w, i) => (
          <span key={i} className="gd-ai-word" style={{ animationDelay: `${0.15 * i}s` }}>{w} </span>
        ))}
        <span className="gd-caret">▋</span>
      </div>
    </div>
  )
}

function CiteDemo() {
  return (
    <div className="gd-stage">
      <div className="gd-doi">10.1038/s41586-020-2649-2</div>
      <div className="gd-arrow">↓</div>
      <div className="gd-ref">
        Reback, J., &amp; McKinney, W. (2020). Array programming with NumPy. <em>Nature</em>, 585, 357–362.
      </div>
      <div className="gd-style-row">
        <span className="gd-style on">APA</span><span className="gd-style">MLA</span><span className="gd-style">Chicago</span><span className="gd-style">BibTeX</span>
      </div>
    </div>
  )
}

function OriginalityDemo() {
  return (
    <div className="gd-stage">
      <div className="gd-line gd-orig">
        Photosynthesis <span className="gd-hl">converts light energy into chemical energy</span> stored in glucose.
      </div>
      <div className="gd-score"><span className="gd-score-num">12%</span> overlaps your sources · 1 verbatim</div>
    </div>
  )
}

function FilesDemo() {
  return (
    <div className="gd-stage gd-files">
      {['.docx', '.pdf', '.xlsx'].map((t, i) => (
        <div key={t} className="gd-file" style={{ animationDelay: `${i * 0.18}s` }}><span className="gd-file-ext">{t}</span></div>
      ))}
      <div className="gd-file-note">Opens faithfully — formatting, tables, images intact</div>
    </div>
  )
}

function WordDemo() {
  return (
    <div className="gd-stage">
      <div className="gd-word-win">
        <div className="gd-word-bar"><span /><span /><span /></div>
        <div className="gd-word-body">
          <div className="gd-word-doc" />
          <div className="gd-word-pane">
            <div className="gd-word-pane-h">Plu<em>ma</em></div>
            <div className="gd-word-card" />
            <div className="gd-word-card" />
          </div>
        </div>
      </div>
    </div>
  )
}

function PrivacyDemo() {
  return (
    <div className="gd-stage gd-privacy">
      <div className="gd-lock">🔒</div>
      <div className="gd-badges">
        <span className="gd-badge gd-badge--pop" style={{ animationDelay: '0s' }}>On your device</span>
        <span className="gd-badge gd-badge--pop" style={{ animationDelay: '0.2s' }}>Works offline</span>
        <span className="gd-badge gd-badge--pop" style={{ animationDelay: '0.4s' }}>Free</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

interface Step {
  title: string
  blurb: string
  demo: () => JSX.Element
  tag?: 'soon'
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Pluma',
    blurb: 'A free, private writing desk for university work — grammar, clarity, tone, originality, and citations, all in your browser. Here\'s a quick tour.',
    demo: () => (
      <div className="gd-stage gd-welcome">
        <div className="gd-welcome-mark">Plu<em>ma</em></div>
        <div className="gd-welcome-sub">write clearly, in your own voice</div>
      </div>
    ),
  },
  {
    title: 'Grammar & clarity as you write',
    blurb: 'Spelling, grammar, and clarity issues are underlined live. Each one comes with a reason and a one-click fix — accept it, or dismiss it for good.',
    demo: GrammarDemo,
  },
  {
    title: 'Smart suggestions & a thesaurus',
    blurb: 'Press Tab to accept the gray ghost-text completion. Double-tap any word for context-aware synonyms. All free, no key needed.',
    demo: GhostDemo,
  },
  {
    title: 'Tone meter & writing goals',
    blurb: 'See the tone of your writing at a glance, and set goals (audience, formality, domain) so Pluma tunes which suggestions matter — academic, casual, or creative.',
    demo: ToneDemo,
  },
  {
    title: 'Rewrite with on-device AI',
    blurb: 'An optional AI runs entirely in your browser — rewrite, simplify, shorten, or change tone. It\'s free and private: your text never leaves your device.',
    demo: AiDemo,
  },
  {
    title: 'Originality, honestly',
    blurb: 'Add the sources you used, press Compare, and Pluma shows exactly where your draft overlaps them — verbatim or paraphrased — so you can quote or cite.',
    demo: OriginalityDemo,
  },
  {
    title: 'Citations in one tap',
    blurb: 'Paste a DOI or add a found source, and get a clean reference in APA, MLA, Chicago, or BibTeX — plus in-text citations dropped straight into your document.',
    demo: CiteDemo,
  },
  {
    title: 'Open anything, up to 100 MB',
    blurb: 'Word, PDF, and Excel files open faithfully — formatting, tables, and images preserved. Scanned PDFs are read with on-device OCR.',
    demo: FilesDemo,
  },
  {
    title: 'Pluma, inside Word',
    blurb: 'Install the free add-in and get the same checks in Microsoft Word — on Windows, Mac, or the web. Find it under "Pluma for Word".',
    demo: WordDemo,
  },
  {
    title: 'Private, offline, and free',
    blurb: 'Your documents live in your browser, not on a server. Install Pluma as an app, work offline, and move everything between devices with a one-file backup.',
    demo: PrivacyDemo,
  },
  {
    title: 'More on the way',
    blurb: 'A browser extension for every text box on the web, deeper AI help, and richer collaboration are coming next — all keeping the free, private promise.',
    demo: () => (
      <div className="gd-stage gd-soon">
        <span className="gd-badge">Browser extension</span>
        <span className="gd-badge">Google Docs</span>
        <span className="gd-badge">More AI</span>
      </div>
    ),
    tag: 'soon',
  },
]

export default function Guide() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) {
      setStep(0)
      setOpen(true)
    }
    const onOpen = () => { setStep(0); setOpen(true) }
    window.addEventListener('pluma:guide', onOpen)
    return () => window.removeEventListener('pluma:guide', onOpen)
  }, [])

  const close = () => {
    localStorage.setItem(SEEN_KEY, '1')
    setOpen(false)
  }

  if (!open) return null
  const s = STEPS[step]
  const last = step === STEPS.length - 1
  const Demo = s.demo

  return (
    <div className="guide-backdrop" onClick={close}>
      <div className="guide-card" onClick={(e) => e.stopPropagation()}>
        <button className="guide-skip" onClick={close}>Skip</button>

        <div className="guide-demo" key={step}>
          <Demo />
        </div>

        <div className="guide-body">
          {s.tag === 'soon' && <span className="guide-soon-tag">Coming soon</span>}
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
            <button className="btn btn--primary" onClick={close}>Start writing</button>
          ) : (
            <button className="btn btn--primary" onClick={() => setStep((v) => v + 1)}>Next</button>
          )}
        </div>
      </div>
    </div>
  )
}
