# Pluma — Browser Extension

Pluma's writing engine in **any text box on the web** — search fields, forms,
social posts, web email, comment boxes. It shares the exact same rules engine as
the website and the Word add-in (`pluma/src/engine/*`); your text never leaves
your device and there is no network call.

## What it does

- Click into any editable field (`<textarea>`, text `<input>`, or a
  `contenteditable` editor). A small **Pluma badge** appears in its corner with
  the number of suggestions (or `✓` when it's clean).
- Click the badge to open a panel of suggestions — grammar, spelling, clarity,
  punctuation, and dialect — each with a reason and an **Accept** that rewrites
  the text in place. **Dismiss** hides one.
- Pick your language/dialect from the toolbar popup (US/UK English, Spain/Latin
  American Spanish); it applies everywhere and is remembered.

## Try it (load unpacked)

```bash
cd extension
npm install      # once, for esbuild
npm run build    # bundles the engine → dist/content.js (+ copies CSS)
```

Then in the browser:

1. **Chrome / Edge:** open `chrome://extensions`, turn on **Developer mode**,
   click **Load unpacked**, and choose this `extension/` folder.
2. **Firefox:** open `about:debugging` → **This Firefox** → **Load Temporary
   Add-on**, and pick `extension/manifest.json`.

Click into any text box on a page and start typing — the badge appears.

## How it's built

- `src/checker.ts` imports the pure engine core (`runRules` + `resolveOverlaps`
  + goal policy) directly, so the Web-Worker dictionary path never enters the
  content-script bundle. Rules cover grammar, punctuation, dialect, and common
  misspellings.
- `src/content.ts` is the only DOM glue: field detection, the badge, the panel,
  and applying a fix (slice for inputs/textareas; a Range edit for
  contenteditable). It sets values through the native setter so React-controlled
  inputs notice the change.
- `build.mjs` bundles it to a single framework-free IIFE with esbuild.

## Scope (v1)

- **No inline underlines yet.** A `<textarea>` can't hold styled underlines, and
  faithfully overlaying them on arbitrary editors is a project of its own — so v1
  surfaces issues through the badge + panel, which works everywhere. Inline
  squiggles are the planned next step.
- Rules-only (no Hunspell dictionary) keeps the bundle small and instant; the
  full dictionary lives in the website and Word add-in.

## Publishing

The same listing approach as the Word add-in applies (Chrome Web Store / Firefox
Add-ons / Edge Add-ons). Bump `manifest.json` `version`, zip the folder
(with a fresh `npm run build`), and submit.
