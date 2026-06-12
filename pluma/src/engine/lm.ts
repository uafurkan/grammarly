// The "small smart" layer: no API, no neural net — a compact, fast statistical
// ranker that makes spelling corrections feel intelligent. It re-orders a
// speller's raw suggestions so the contextually likely word wins
// (yoi → you, expensiv → expensive) using three cheap, honest signals:
// edit distance, a high-frequency word list, and shape preservation.

const HIGH_FREQ_EN = `the be to of and a in that have i it for not on with he as you do at
this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me
when make can like time no just him know take people into year your good some could them see other than then now look only come
its over think also back after use two how our work first well way even new want because any these give day most us is are was
were been has had did said get made find went could people water been call who oil sit now find long down day get come made may
part student write essay because example research study result analysis method data conclusion introduction argument evidence
source paragraph sentence paper thesis chapter section figure table reference quote cite author university course professor`
  .split(/\s+/)
  .filter(Boolean)

const HIGH_FREQ_ES = `de la que el en y a los del se las por un para con no una su al lo como más pero sus le ya o este sí porque
esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso
ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar
estudiante ensayo investigación estudio resultado análisis método dato conclusión introducción argumento evidencia fuente
párrafo oración trabajo tesis capítulo sección figura tabla referencia cita autor universidad curso profesor`
  .split(/\s+/)
  .filter(Boolean)

const FREQ_RANK = new Map<string, number>()
;[...HIGH_FREQ_EN, ...HIGH_FREQ_ES].forEach((w, i) => {
  if (!FREQ_RANK.has(w)) FREQ_RANK.set(w, i)
})

/** Damerau-style edit distance, capped for speed. */
export function editDistance(a: string, b: string): number {
  a = a.toLowerCase()
  b = b.toLowerCase()
  const m = a.length
  const n = b.length
  if (Math.abs(m - n) > 3) return Math.abs(m - n)
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1) // transposition
      }
    }
  }
  return dp[m][n]
}

// Lightweight context model: which kind of word tends to follow a given word.
// Lets the ranker prefer an adjective after "very", a noun after "the", a
// base verb after "I/we/they", etc. — the "looks at context, not random" ask.
const ADJ_HINT = /(?:ous|ful|ive|able|ible|al|ant|ent|ic|ish|less|like|y)$/
const ADV_HINT = /ly$/
const NOUN_HINT = /(?:tion|ment|ness|ity|ship|ance|ence|ist|ism|er|or|age)$/
const VERB_HINT = /(?:ate|ify|ize|ise|en)$/

type Expect = 'adj' | 'noun' | 'verb' | 'adv' | null

function expectAfter(prev: string | undefined): Expect {
  if (!prev) return null
  const p = prev.toLowerCase()
  if (['very', 'so', 'too', 'quite', 'really', 'extremely', 'more', 'most', 'less'].includes(p)) return 'adj'
  if (['the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their'].includes(p)) return 'noun'
  if (['i', 'we', 'they', 'you', 'to'].includes(p)) return 'verb'
  if (['is', 'are', 'was', 'were', 'be', 'been', 'being'].includes(p)) return 'adj'
  return null
}

function posScore(word: string, expect: Expect): number {
  if (!expect) return 0
  const w = word.toLowerCase()
  const match =
    (expect === 'adj' && ADJ_HINT.test(w)) ||
    (expect === 'adv' && ADV_HINT.test(w)) ||
    (expect === 'noun' && NOUN_HINT.test(w)) ||
    (expect === 'verb' && VERB_HINT.test(w))
  return match ? -0.5 : 0 // reward, don't punish (hints are weak)
}

/**
 * Re-rank raw speller suggestions for `word`. Lower score = better. Combines
 * edit distance, word frequency, first-letter/length similarity, and — when
 * neighbouring words are provided — a light part-of-speech expectation so the
 * contextually likely correction floats to the top.
 */
export function rankSuggestions(
  word: string,
  suggestions: string[],
  prev?: string,
  next?: string,
): string[] {
  const w = word.toLowerCase()
  const expect = expectAfter(prev)
  void next
  return [...new Set(suggestions)]
    .map((s) => {
      const sl = s.toLowerCase()
      const dist = editDistance(w, sl)
      const freq = FREQ_RANK.has(sl) ? FREQ_RANK.get(sl)! / 1000 : 1.2
      const firstLetter = w[0] === sl[0] ? 0 : 0.6
      const lenDiff = Math.abs(w.length - sl.length) * 0.15
      return { s, score: dist + freq + firstLetter + lenDiff + posScore(sl, expect) }
    })
    .sort((a, b) => a.score - b.score)
    .map((x) => x.s)
}

export function isCommon(word: string): boolean {
  return FREQ_RANK.has(word.toLowerCase())
}
