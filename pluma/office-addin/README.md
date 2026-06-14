# Pluma for Word (Office Add-in)

Pluma's writing engine — grammar, spelling, clarity, tone, and readability —
running inside Microsoft Word as a task-pane add-in. It shares the exact same
engine as the web app (`src/engine/*`); the only Word-specific code is the
Office.js bridge in `src/office/word.ts`. Your text never leaves your device.

The task pane is served from the same site as the web app, at
**`https://grammarly-six.vercel.app/office.html`** (built from `office.html`).

## Try it now (sideload)

You don't need to publish anything to test it — sideload `manifest.xml`.

### Word on the web (easiest)
1. Open a document at [word.office.com](https://word.office.com).
2. **Home → Add-ins → More Add-ins → My Add-ins → Upload My Add-in**.
3. Choose `office-addin/manifest.xml`.
4. A **Pluma** button appears on the Home tab → click **Open Pluma**.

### Word on Windows
1. Put `manifest.xml` in a folder, e.g. `C:\pluma-addin\`.
2. Share that folder (Properties → Sharing) and copy the share path.
3. **File → Options → Trust Center → Trust Center Settings → Trusted Add-in
   Catalogs**, add the share path, tick *Show in Menu*, restart Word.
4. **Insert → My Add-ins → Shared Folder → Pluma**.

### Word on Mac
Copy `manifest.xml` to
`~/Library/Containers/com.microsoft.Word/Data/Documents/wef/`, restart Word,
then **Insert → My Add-ins → Pluma**.

## How it works

- **Check document** reads the whole body via Office.js (`body.text`), runs the
  shared checker (instant rules + worker spell-check), and lists issues.
- **Accept** finds the right occurrence of the flagged text (Nth match, derived
  from the engine's char offset) and replaces it in place.
- Clicking a card selects that spot in the document so you can see it.
- Readability, passive-voice, reading-time, and the tone meter come straight
  from `src/engine/analytics.ts`.

## Publishing

To list it on Microsoft AppSource, follow the step-by-step kit in
[`APPSOURCE_SUBMISSION.md`](./APPSOURCE_SUBMISSION.md) — it has the finalized
manifest notes, ready-to-paste listing copy, a screenshot shot-list, the Partner
Center flow, and a per-host test matrix. Hosting and the privacy/terms pages are
already covered by the existing Vercel deploy.
