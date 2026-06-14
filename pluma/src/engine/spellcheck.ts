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
 * Decides whether a single token is an unrecognised word *worth* flagging.
 * Skips the things that are almost never typos: numbers, hyphenated compounds
 * (pixel-perfect, open-source), ALL-CAPS acronyms (XML, JSON), identifiers with
 * an internal capital (camelCase / PascalCase — DrawingML, MinIO, NuGet),
 * URLs/emails, personal-dictionary words, and mid-sentence capitalised words
 * (proper nouns). Returns false for anything we recognise or deliberately let
 * through.
 */
function isUnknownCandidate(
  tok: Tok,
  text: string,
  speller: Nspell,
  personal: Set<string>,
): boolean {
  const w = tok.raw
  if (w.length < 2) return false
  if (/\d/.test(w)) return false
  if (w.includes('-')) return false // hyphenated compound (technical term)
  if (/^[A-ZÁÉÍÓÚÜÑ]{2,}$/.test(w)) return false // ALL-CAPS acronym
  if (/.[A-ZÁÉÍÓÚÜÑ]/.test(w)) return false // internal capital → identifier/brand
  if (personal.has(w.toLowerCase())) return false

  // URL/email/handle guard: check a small window around the token
  const ctx = text.slice(Math.max(0, tok.begin - 1), tok.end + 1)
  if (/[@/.]/.test(ctx[0]) || /[@/]/.test(ctx[ctx.length - 1])) return false

  if (speller.correct(w)) return false
  // tolerate sentence-initial capitalisation by also testing the lowercase form
  const lower = w.toLowerCase()
  if (lower !== w && speller.correct(lower)) return false
  // a capitalised word mid-sentence is most likely a proper noun → skip
  if (/^[A-ZÁÉÍÓÚÜÑ]/.test(w) && !isSentenceStart(text, tok.begin)) return false
  return true
}

/**
 * Produces spelling alerts for words the speller doesn't recognise.
 *
 * Beyond the per-word guards in isUnknownCandidate, it reads the *context*: a
 * word is only flagged when it stands alone among recognised words. Runs of two
 * or more unknown words in a row — Latin/lorem-ipsum filler, code, foreign
 * quotes, product names — are left untouched, because "correcting" them one
 * word at a time (amet → abet, elit → emit) is exactly the nonsense we want to
 * avoid. A real typo is almost always a lone stranger in a sentence of real
 * words; that's what we surface.
 */
export function spellcheck(
  text: string,
  speller: Nspell,
  personal: Set<string>,
  lang: 'en' | 'es',
): RuleMatch[] {
  const out: RuleMatch[] = []
  const toks = tokenize(text)
  const unknown = toks.map((tok) => isUnknownCandidate(tok, text, speller, personal))

  for (let ti = 0; ti < toks.length; ti++) {
    if (!unknown[ti]) continue
    if (out.length >= MAX_SPELL_ALERTS) break
    // context guard: skip clusters of unknown words (foreign text, code, lorem ipsum)
    if (unknown[ti - 1] || unknown[ti + 1]) continue

    const tok = toks[ti]
    const w = tok.raw
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
