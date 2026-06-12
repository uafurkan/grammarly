import type { Nspell } from 'nspell'
import type { RuleMatch } from './types'
import { rankSuggestions } from './lm'

// Word = letters plus internal apostrophes/hyphens. Captures offsets so alerts
// map back to document positions.
const WORD_RE = /[\p{L}][\p{L}'’\-]*[\p{L}]|[\p{L}]/gu

interface Tok {
  raw: string
  begin: number
  end: number
}

function tokenize(text: string): Tok[] {
  const out: Tok[] = []
  let m: RegExpExecArray | null
  WORD_RE.lastIndex = 0
  while ((m = WORD_RE.exec(text)) !== null) {
    out.push({ raw: m[0], begin: m.index, end: m.index + m[0].length })
  }
  return out
}

function isSentenceStart(text: string, begin: number): boolean {
  for (let i = begin - 1; i >= 0; i--) {
    const c = text[i]
    if (c === ' ' || c === '\t' || c === '"' || c === '“' || c === '(' || c === '¿' || c === '¡') continue
    if (c === '\n' || c === '.' || c === '!' || c === '?' || c === ':') return true
    return false
  }
  return true
}

const MAX_SPELL_ALERTS = 120

/**
 * Produces spelling alerts for words the speller doesn't recognise. Skips
 * numbers, URLs/emails, all-caps acronyms, personal-dictionary words, and
 * non-initial capitalised words (likely proper nouns) to keep noise low.
 */
export function spellcheck(
  text: string,
  speller: Nspell,
  personal: Set<string>,
  lang: 'en' | 'es',
): RuleMatch[] {
  const out: RuleMatch[] = []
  const toks = tokenize(text)
  for (let ti = 0; ti < toks.length; ti++) {
    const tok = toks[ti]
    if (out.length >= MAX_SPELL_ALERTS) break
    const w = tok.raw
    if (w.length < 2) continue
    if (/\d/.test(w)) continue
    if (/^[A-ZÁÉÍÓÚÜÑ]{2,}$/.test(w)) continue // acronym
    if (personal.has(w.toLowerCase())) continue

    // URL/email/handle guard: check a small window around the token
    const ctx = text.slice(Math.max(0, tok.begin - 1), tok.end + 1)
    if (/[@/.]/.test(ctx[0]) || /[@/]/.test(ctx[ctx.length - 1])) continue

    if (speller.correct(w)) continue
    // tolerate sentence-initial capitalisation by also testing the lowercase form
    const lower = w.toLowerCase()
    if (lower !== w && speller.correct(lower)) continue
    // a capitalised word mid-sentence is most likely a proper noun → skip
    if (/^[A-ZÁÉÍÓÚÜÑ]/.test(w) && !isSentenceStart(text, tok.begin)) continue

    const prev = toks[ti - 1]?.raw
    const next = toks[ti + 1]?.raw
    const suggestions = rankSuggestions(w, speller.suggest(w), prev, next).slice(0, 6)
    out.push({
      begin: tok.begin,
      end: tok.end,
      text: w,
      replacements: suggestions,
      category: 'correctness',
      message:
        suggestions.length > 0
          ? lang === 'es'
            ? `¿Quisiste decir «${suggestions[0]}»?`
            : `Did you mean “${suggestions[0]}”?`
          : lang === 'es'
            ? 'Palabra no reconocida.'
            : 'Word not recognised.',
    })
  }
  return out
}
