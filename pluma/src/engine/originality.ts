// Source-aware originality check. This is a *self-check* that helps a writer
// find passages overlapping their own reference sources so they can quote or
// cite them properly — the opposite of an evasion tool. It closes the gap the
// research flagged in Grammarly: verbatim-only, source-blind matching.
//
// Two signals:
//   1. Verbatim overlap — shared word-shingles (default 5-grams).
//   2. Paraphrase overlap — sentences with high word-set (Jaccard) similarity.

export interface Source {
  id: string
  label: string
  text: string
}

export interface OverlapMatch {
  id: string
  begin: number
  end: number
  text: string
  sourceLabel: string
  kind: 'verbatim' | 'paraphrase'
  /** 0..1 similarity for paraphrase; 1 for verbatim */
  similarity: number
}

const SHINGLE = 5
const PARAPHRASE_MIN = 0.62
const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'with', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'that', 'this',
  'these', 'those', 'from', 'into', 'over', 'under', 'about', 'by', 'than',
  'then', 'also', 'such', 'however', 'their', 'them', 'they', 'its', 'has',
  'have', 'had', 'not', 'can', 'will', 'would', 'which', 'while', 'when',
  'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'de', 'del', 'en', 'que',
  'es', 'son', 'por', 'para', 'con', 'se', 'su', 'sus', 'lo', 'al', 'como',
  'más', 'mas', 'pero', 'este', 'esta', 'estos', 'estas', 'sin', 'sobre',
])

interface Word {
  norm: string
  begin: number
  end: number
}

function tokenize(text: string): Word[] {
  const words: Word[] = []
  const re = /[\p{L}\p{N}']+/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    words.push({ norm: m[0].toLowerCase(), begin: m.index, end: m.index + m[0].length })
  }
  return words
}

function shingleSet(words: Word[], k = SHINGLE): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i + k <= words.length; i++) {
    set.add(words.slice(i, i + k).map((w) => w.norm).join(' '))
  }
  return set
}

// Very light stemmer so paraphrases match despite inflection
// (releases→release, trapping→trap, temperaturas→temperatur). Not linguistic —
// just enough to make word-set overlap robust across EN and ES endings.
const SUFFIXES = ['ciones', 'mente', 'edly', 'ing', 'ed', 'es', 'er', 'ly', 's', 'e']
function stem(w: string): string {
  for (const suf of SUFFIXES) {
    if (w.length - suf.length >= 3 && w.endsWith(suf)) {
      const base = w.slice(0, -suf.length)
      // collapse a doubled final consonant: trapp→trap, runn→run
      return base.replace(/([bcdfghjklmnpqrstvwxz])\1$/, '$1')
    }
  }
  return w
}

function contentWords(text: string): Set<string> {
  return new Set(
    tokenize(text)
      .map((w) => w.norm)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

function splitSentences(text: string): { text: string; begin: number }[] {
  const out: { text: string; begin: number }[] = []
  // Split on sentence terminators only. Newlines are treated as in-sentence
  // whitespace so a sentence wrapped across lines (common in pasted sources)
  // stays whole.
  const re = /[^.!?¿¡]+[.!?]?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[0].trim().length > 0) out.push({ text: m[0], begin: m.index })
  }
  return out
}

let counter = 0

export function checkOriginality(text: string, sources: Source[]): OverlapMatch[] {
  const usable = sources.filter((s) => s.text.trim().length > 0)
  if (usable.length === 0 || text.trim().length === 0) return []

  const docWords = tokenize(text)
  const matches: OverlapMatch[] = []

  // pre-compute per-source structures
  const prepared = usable.map((s) => ({
    label: s.label,
    shingles: shingleSet(tokenize(s.text)),
    sentences: splitSentences(s.text).map((sent) => contentWords(sent.text)),
  }))

  // --- 1. verbatim: scan doc shingles, merge consecutive hits into spans ---
  let runStart = -1
  let runEnd = -1
  let runLabel = ''
  const flushRun = () => {
    if (runStart >= 0) {
      matches.push({
        id: `o${++counter}`,
        begin: docWords[runStart].begin,
        end: docWords[runEnd].end,
        text: text.slice(docWords[runStart].begin, docWords[runEnd].end),
        sourceLabel: runLabel,
        kind: 'verbatim',
        similarity: 1,
      })
    }
    runStart = -1
  }
  for (let i = 0; i + SHINGLE <= docWords.length; i++) {
    const shingle = docWords.slice(i, i + SHINGLE).map((w) => w.norm).join(' ')
    const hit = prepared.find((p) => p.shingles.has(shingle))
    if (hit) {
      if (runStart < 0) {
        runStart = i
        runLabel = hit.label
      }
      runEnd = i + SHINGLE - 1
    } else if (runStart >= 0 && i > runEnd) {
      flushRun()
    }
  }
  flushRun()

  // --- 2. paraphrase: sentence-level Jaccard, skipping verbatim spans ---
  for (const sent of splitSentences(text)) {
    const begin = sent.begin
    const end = begin + sent.text.length
    if (matches.some((mm) => mm.begin < end && begin < mm.end)) continue
    const words = contentWords(sent.text)
    if (words.size < 5) continue
    let best = 0
    let bestLabel = ''
    for (const p of prepared) {
      for (const ws of p.sentences) {
        const sim = jaccard(words, ws)
        if (sim > best) {
          best = sim
          bestLabel = p.label
        }
      }
    }
    if (best >= PARAPHRASE_MIN) {
      const trimmed = sent.text.length - sent.text.trimStart().length
      matches.push({
        id: `o${++counter}`,
        begin: begin + trimmed,
        end,
        text: sent.text.trim(),
        sourceLabel: bestLabel,
        kind: 'paraphrase',
        similarity: best,
      })
    }
  }

  return matches.sort((a, b) => a.begin - b.begin)
}

export interface OriginalityScore {
  /** percentage of words covered by any overlap */
  overlapPercent: number
  verbatim: number
  paraphrase: number
}

export function scoreOriginality(text: string, matches: OverlapMatch[]): OriginalityScore {
  const total = tokenize(text).length || 1
  let covered = 0
  for (const m of matches) covered += tokenize(m.text).length
  return {
    overlapPercent: Math.min(100, Math.round((covered / total) * 100)),
    verbatim: matches.filter((m) => m.kind === 'verbatim').length,
    paraphrase: matches.filter((m) => m.kind === 'paraphrase').length,
  }
}
