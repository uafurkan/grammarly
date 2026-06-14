import { useState } from 'react'

interface HelpItem {
  id: string
  icon: string
  title: string
  body: JSX.Element
}

/**
 * In-panel "how it works" guide. Each feature is a collapsible row so the user
 * can open just the one they're curious about. Content mirrors exactly what the
 * editor actually does — no promises the app can't keep.
 *
 * `aiOn` hides the on-device AI row on devices without WebGPU, matching the
 * Assist tab's own availability. `include`, when given, restricts the guide to
 * the listed feature ids — the PDF editor passes a reduced set because it has no
 * Goals / Citations / Assist / thesaurus surfaces (it stays pixel-faithful).
 */
export default function HelpAccordion({ aiOn, include }: { aiOn: boolean; include?: string[] }) {
  // multiple rows may stay open at once — this is a reference, not a wizard
  const [open, setOpen] = useState<Set<string>>(new Set(['suggestions']))

  const allowed = (id: string) => !include || include.includes(id)

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const items: HelpItem[] = [
    {
      id: 'suggestions',
      icon: '✓',
      title: 'Suggestions — grammar & spelling',
      body: (
        <>
          <p>
            As you type, mistakes are underlined live — <b>red</b> for
            correctness, <b>blue</b> for clarity. Open the <b>Suggestions</b> tab
            to see every flag explained.
          </p>
          <ul>
            <li><b>Tap a card</b> to jump to that spot in your text.</li>
            <li><b>Accept</b> applies the fix in one click.</li>
            <li><b>Add to dictionary</b> teaches Pluma a word it shouldn’t flag again.</li>
            <li><b>Dismiss</b> hides a flag for good.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'clarity',
      icon: '◎',
      title: 'Clarity highlights',
      body: (
        <p>
          In the Suggestions tab, tap <b>“Show clarity highlights”</b> to colour
          hard-to-read sentences, passive voice, adverbs, and overly complex
          words — Hemingway-style. It’s a reading-ease overlay, separate from the
          grammar underlines; tap again to turn it off.
        </p>
      ),
    },
    {
      id: 'tone',
      icon: '⌖',
      title: 'Tone meter & writing goals',
      body: (
        <>
          <p>
            The <b>tone meter</b> (under Suggestions) shows how formal, confident,
            friendly, analytical, or tentative your writing reads.
          </p>
          <p>
            Tap <b>⌖ Goals</b> at the top to set your audience, formality, and
            domain. Pluma then tunes <i>which</i> suggestions matter — stricter
            for academic work, looser for creative writing.
          </p>
        </>
      ),
    },
    {
      id: 'thesaurus',
      icon: '↹',
      title: 'Thesaurus & autocomplete',
      body: (
        <>
          <p>
            <b>Double-tap any word</b> to see context-aware synonyms; tap one to
            swap it in.
          </p>
          <p>
            As you write, a grey <b>ghost-text</b> completion may appear at the
            cursor — press <b>Tab</b> to accept it, or just keep typing to ignore
            it. Both are free and need no sign-in.
          </p>
        </>
      ),
    },
    {
      id: 'originality',
      icon: '⊚',
      title: 'Originality',
      body: (
        <>
          <p>
            Open the <b>Originality</b> tab, add the sources you used (paste their
            text, or use <b>Find sources</b> to search academic databases), then
            press <b>Compare</b>.
          </p>
          <p>
            Pluma highlights exactly where your draft overlaps a source —
            <b> verbatim</b> or <b>paraphrased</b> — and offers to <b>quote</b> or
            <b> cite</b> the passage. It’s an integrity aid: it shows you what to
            fix, it doesn’t hide it.
          </p>
        </>
      ),
    },
    {
      id: 'citations',
      icon: '“ ”',
      title: 'Citations & bibliography',
      body: (
        <>
          <p>
            In the <b>Citations</b> tab, paste a <b>DOI</b> to fetch a clean
            reference, and pick a style — <b>APA, MLA, Chicago, or BibTeX</b>.
          </p>
          <ul>
            <li><b>Cite in text</b> drops an in-text citation at your cursor.</li>
            <li><b>Insert bibliography</b> appends the full, sorted list.</li>
          </ul>
          <p>Sources you add in Originality land here automatically.</p>
        </>
      ),
    },
    ...(aiOn
      ? [{
          id: 'assist',
          icon: '✦',
          title: 'Assist — on-device AI',
          body: (
            <>
              <p>
                Select some text and open the <b>Assist</b> tab to <b>rewrite,
                simplify, shorten, expand,</b> or <b>change the tone</b>.
              </p>
              <p>
                The AI model runs <b>entirely in your browser</b> — it’s free, and
                your text never leaves your device. The first use downloads the
                model once, then works offline.
              </p>
            </>
          ),
        } as HelpItem]
      : []),
    {
      id: 'language',
      icon: '🌐',
      title: 'Languages & dialect',
      body: (
        <p>
          Use the language selector at the top to switch between American and
          British English, and Peninsular and Latin-American Spanish. Pluma checks
          spelling and grammar for the <i>exact</i> dialect you choose — not one
          generic model pretending to be all four.
        </p>
      ),
    },
    {
      id: 'privacy',
      icon: '🔒',
      title: 'Saving, privacy & export',
      body: (
        <p>
          Your document saves automatically to <b>this browser</b> — no account,
          and it works offline. Nothing is uploaded to a server. Use <b>Export
          PDF</b> or <b>Export .docx</b> from the top bar to take your work
          anywhere.
        </p>
      ),
    },
  ]

  return (
    <>
      <h2>How Pluma works</h2>
      <p className="sub">A quick guide to every tool in this panel. Tap a row to expand it.</p>

      <div className="help-acc">
        {items.filter((it) => allowed(it.id)).map((it) => {
          const isOpen = open.has(it.id)
          return (
            <div key={it.id} className={`help-row${isOpen ? ' open' : ''}`}>
              <button
                className="help-head"
                onClick={() => toggle(it.id)}
                aria-expanded={isOpen}
              >
                <span className="help-icon" aria-hidden>{it.icon}</span>
                <span className="help-title">{it.title}</span>
                <span className="help-chev" aria-hidden>{isOpen ? '–' : '+'}</span>
              </button>
              {isOpen && <div className="help-body">{it.body}</div>}
            </div>
          )
        })}
      </div>
    </>
  )
}
