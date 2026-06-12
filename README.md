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
- **Live checking while you type**: a Tier-1 rules engine runs locally with a
  500 ms debounce and renders wavy underlines (red = correctness, blue =
  clarity). Suggestion cards explain every flag; accept or dismiss — dismissed
  flags stay dismissed.
- **Dialect-aware**: en-US ↔ en-GB spelling, Spanish missing accents,
  inverted ¿/¡, «por qué» in questions, and peninsular-vs-LatAm usage
  (vosotros/ustedes, voseo) — switchable per document.
- **Word documents**: open `.docx` (limits: **400,000 characters / 25 MB** —
  4× Grammarly's 100k/4 MB) and export back to `.docx`.
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

Pluma helps students **improve their own writing** — it explains every
suggestion and leaves the decision to the writer. It does not include
AI-detection-evasion ("humanizer") functionality.
