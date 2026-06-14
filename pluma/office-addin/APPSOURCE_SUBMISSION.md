# Pluma for Word — AppSource Submission Kit

Everything needed to list the add-in on Microsoft AppSource. The manifest and
hosting are ready; the only things that require *you* (not code) are a Partner
Center account and the screenshots.

---

## 0. Status checklist

- [x] Valid manifest — `office-addin/manifest.xml` (also served at `/pluma-word.xml`)
- [x] HTTPS hosting — `https://grammarly-six.vercel.app/office.html`
- [x] Icons — 16 / 32 / 80 px (`public/icon-*.png`)
- [x] Privacy policy URL — `https://grammarly-six.vercel.app/privacy.html`
- [x] Terms of use URL — `https://grammarly-six.vercel.app/terms.html`
- [x] Support URL — `https://grammarly-six.vercel.app/`
- [ ] Partner Center account (you)
- [ ] 3–5 screenshots (you — capture from real Word)
- [ ] Submit for validation (you)

---

## 1. Finalize the manifest before submitting

1. **GUID.** A unique GUID is already set (`238c1949-cd20-433a-bab5-45c58bb2cb6e`)
   in BOTH `office-addin/manifest.xml` and `public/pluma-word.xml`. Keep it
   forever — changing it later registers a brand-new add-in. (To rotate it,
   `node -e "console.log(crypto.randomUUID())"` and replace it in both files,
   which must stay byte-identical.)
2. **Version.** Use `1.0.0.0` for the first store build (or keep `1.0.1.0`).
   Bump it on every resubmission.
3. **Validate** (Microsoft's validator is occasionally down — retry on 502):
   ```bash
   npx office-addin-manifest validate office-addin/manifest.xml
   ```

---

## 2. Listing copy — ready to paste

**Add-in name**
```
Pluma — Free Writing Assistant
```

**Short description (≤ 100 chars)**
```
Free, private grammar, spelling, clarity & tone checks inside Word. Your text stays on your device.
```

**Long description**
```
Pluma brings grammar, spelling, clarity, tone, and readability checking right
into Microsoft Word — completely free, with no account and no subscription.

Unlike cloud-based assistants, Pluma runs entirely on your device. Your document
text is never uploaded to a server to be analysed, so your writing stays private.

WHAT YOU GET
• Grammar & spelling — real dictionaries plus grammar rules, with one-click fixes.
• Clarity & readability — spot hard-to-read sentences, passive voice, and wordiness.
• Tone meter — see how formal, confident, friendly, or tentative your writing reads.
• Writing goals — tell Pluma your audience, formality, and domain; it tunes which
  suggestions matter (strict for academic work, relaxed for creative writing).
• Live checking — leave it on and Pluma keeps up as you type.
• English (US & UK) with real dialect awareness.

PRIVATE BY DESIGN
Everything runs locally. No sign-in, no tracking, no data collection. Pluma is a
writing-improvement tool, not an academic-integrity workaround.

Free, forever, for students and writers.
```

**Search keywords (5)**
```
grammar, spelling, writing assistant, proofreading, clarity
```

**Category**
```
Productivity  →  (sub) Reference / Writing
```

**Products**: Word (Windows, Mac, Web)
**Pricing**: Free
**Languages**: English (en-US)

---

## 3. Screenshots — shot list

AppSource needs at least 1 (recommend 3–5). PNG/JPG, **1366×768 or larger**,
landscape. Capture from real Word (Online is easiest) with the task pane open:

1. **The pane checking a document** — a paragraph with a few underlined errors
   visible in the doc and suggestion cards in the pane. Caption:
   *"Grammar, spelling & clarity — right inside Word."*
2. **A suggestion card mid-fix** — one card expanded showing the `wrong → right`
   change and the Accept button. Caption: *"One-click fixes with a reason."*
3. **The tone meter + readability block** — scroll the pane to the analytics.
   Caption: *"See your tone and readability at a glance."*
4. **Writing goals** — the ⌖ Goals dialog open. Caption:
   *"Set your audience and formality; Pluma tunes the rest."*
5. **Live mode on** — the Live toggle highlighted. Caption:
   *"Leave Live on and it keeps up as you type."*

Tip: a thin Pluma-green border + the caption baked into each image reads well on
the listing.

---

## 4. Partner Center flow

1. Sign in at **partner.microsoft.com** → enroll in the **Office Store** program
   (one-time: company/individual profile + tax info; free apps still need it).
2. **Marketplace offers → New offer → Office add-in.**
3. **Upload** `office-addin/manifest.xml` (Partner Center reads name, icons,
   description, support URL from it).
4. Fill the **Listing** (copy from §2), upload **Screenshots** (§3), and set the
   **Privacy** + **Terms** URLs (§0).
5. **Submit for review.** Microsoft tests on Word Web / Windows / Mac, checks the
   manifest, HTTPS, and privacy. Turnaround is usually ~5 business days.
6. On pass → live on AppSource within a day; users find it under
   **Insert → Get Add-ins → search "Pluma"**.

---

## 5. Test matrix before you submit

Sideload the manifest (see `office-addin/README.md`) and verify on each host:

| Check | Word Web | Word Win | Word Mac |
|---|---|---|---|
| Pane opens to the add-in (not the website) | ☐ | ☐ | ☐ |
| Check document lists issues | ☐ | ☐ | ☐ |
| Accept replaces the right word | ☐ | ☐ | ☐ |
| Click a card selects the text | ☐ | ☐ | ☐ |
| Live mode re-checks on edit | ☐ | ☐ | ☐ |
| ⌖ Goals changes which clarity flags show | ☐ | ☐ | ☐ |
| Dialect switch (US/UK) re-checks | ☐ | ☐ | ☐ |
| No console errors | ☐ | ☐ | ☐ |
