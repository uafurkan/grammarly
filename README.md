# Pluma

**Pluma** ("quill" in Spanish) is a writing assistant for university work —
English (US/UK) and Spanish (Spain/Latin America), with real dialect
awareness. It is being built to outdo Grammarly in the areas where Grammarly
is weakest; the full competitive/technical analysis lives in
[`GRAMMARLY_ANALYSIS.md`](./GRAMMARLY_ANALYSIS.md).

## What works today (MVP, `pluma/`)

- **Blank-page writing**: "New document" opens a clean page you write and
  format directly in the browser (headings, bold/italic/underline, lists,
  quotes, alignment, undo/redo).
- **Live checking while you type**: real-time, fully in-browser (no API key, no
  server), with a 500 ms debounce and wavy underlines (red = correctness, blue =
  clarity). Suggestion cards explain every flag; accept, dismiss, or "Add to
  dictionary". Three layers work together:
  1. **Real Hunspell dictionaries** (en-US, en-GB, es-ES, es-MX — ~50k stems
     each, expanding to millions of inflected forms via affix rules) plus an
     academic/technical supplement, run in a **Web Worker** so they never block
     typing. Catches non-words like "yoi", "expensiv".
  2. **Morphology grammar rules**: irregular past tense (goed→went, buyed→bought),
     subject–verb agreement (they was→were, it were→was, he tell→tells, we
     goes→go), do-support, irregular plurals (peoples→people), plus Spanish
     accents, ¿¡, gender and dialect (vosotros/ustedes, voseo).
  3. **A small on-device ranker** (edit distance + frequency, no neural net) that
     orders spelling suggestions so the intended word wins (yoi→you).
- **Dialect-aware**: en-US ↔ en-GB spelling, Spanish missing accents,
  inverted ¿/¡, «por qué» in questions, and peninsular-vs-LatAm usage
  (vosotros/ustedes, voseo) — switchable per document.
- **Word, PDF and Excel**, up to **100 MB**: open `.docx`, `.xlsx`/`.xls`/`.csv`
  (editable grid with cell-level checking), and `.pdf` in a **pixel-faithful
  editor** — the page is rendered exactly as the original, errors are underlined
  in place, and accepted fixes are written back with `pdf-lib` (white-out +
  same-position word) so **download preserves the original appearance**. A
  "Convert to text" option extracts the writing into a normal document. Large
  originals are kept in IndexedDB. Export to `.docx`, `.xlsx`, or corrected PDF.
- **Find sources**: in the Originality panel, search real academic databases
  (OpenAlex + Crossref, free, no key) for papers matching your draft, ranked by
  honest keyword overlap, and add any as a source to compare against.
- **Originality self-check**: add the sources you used and Pluma highlights
  where your draft overlaps them — both **verbatim** and **paraphrased**
  (word-shingles + sentence-level similarity) — then offers to quote or cite
  the passage. This closes the gap Grammarly's reviewers flag: its plagiarism
  check is verbatim/web-only and source-blind. It is an integrity aid, not an
  evasion tool.
- **Quiet design**: paper-and-ink look, no gloss; documents persist in
  `localStorage` (no account needed yet).

## Architecture

The MVP deliberately mirrors the proven pattern documented in the analysis
(§3, §6):

- `pluma/src/engine/` — checker + per-language rule sets emit **ranged
  alerts** `{begin, end, replacements, category, message}`. The same interface
  is where server-side GEC models / LLM tiers (Tier-2/3) will plug in.
- `pluma/src/editor/suggestions-plugin.ts` — ProseMirror decorations mapped
  through every transaction, so underlines stay glued to the text while you
  type (the client-side "rebase" pattern).
- `pluma/src/files/` — DOCX import (mammoth) / export (docx). PDF and Excel
  surfaces are the next planned file types.

## Run it

```bash
cd pluma
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
```

Engine smoke test: `npx esbuild scripts/engine-smoke.ts --bundle --format=esm --outfile=/tmp/s.mjs && node /tmp/s.mjs`

## Roadmap (from the analysis)

1. Server-side Tier-2: per-dialect GEC tagger + on-demand LLM rewrites behind
   the existing `Alert` interface.
2. PDF and Excel viewing/editing surfaces feeding the same checking pipeline.
3. Accounts + cloud documents; collaboration via the same Delta model.
4. Citations and structure feedback for essays.

## Scope boundary

Pluma helps students **improve their own writing** — it explains every
suggestion, shows where a draft overlaps its sources, and leaves the decision
to the writer. It deliberately does **not** include AI-detection-evasion
("humanizer") functionality whose purpose is to disguise AI-generated text from
academic-integrity checks, even in testing builds.
