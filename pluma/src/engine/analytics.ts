// Writing analytics: readability, vocabulary richness, style, sentence patterns.
// Everything runs in-browser — no API, no paywall.

export interface WritingAnalytics {
  words: number
  sentences: number
  avgWordsPerSentence: number
  fleschEase: number       // 0-100; higher = easier to read
  fleschGrade: number      // U.S. school grade level
  syllablesPerWord: number
  passiveSentences: number
  passivePct: number
  intensifierCount: number
  wordsTotal: number
  wordsUnique: number
  vocabularyRichness: number // 0-1; unique/total
  readingMinutes: number
  styleLabel: 'Academic' | 'Business' | 'Casual' | 'Creative' | 'Mixed'
  readabilityLabel: string  // human summary
}

/** Lexicon-based tone read — each field is a 0-1 intensity. Fully offline. */
export interface ToneScore {
  formal: number
  confident: number
  friendly: number
  analytical: number
  tentative: number
  label: string
}

/** A clarity issue anchored to a character range (Hemingway-style highlighting). */
export interface HemingwayMark {
  begin: number
  end: number
  kind: 'hard' | 'very-hard' | 'adverb' | 'passive' | 'weakener' | 'complex-word'
}

// ---------------------------------------------------------------------------
// Syllable counting (approximation — good enough for Flesch)
// ---------------------------------------------------------------------------

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (w.length <= 2) return 1
  let count = (w.match(/[aeiouy]+/g) ?? []).length
  if (w.endsWith('e') && !w.endsWith('le') && count > 1) count--
  if (w.endsWith('es') || w.endsWith('ed')) count = Math.max(1, count - 1)
  return Math.max(1, count)
}

// ---------------------------------------------------------------------------
// Passive voice detector (approximate)
// ---------------------------------------------------------------------------

const IRREGULAR_PARTICIPLES = new Set([
  'written', 'known', 'seen', 'done', 'gone', 'given', 'taken', 'shown',
  'become', 'run', 'come', 'made', 'said', 'thought', 'brought', 'taught',
  'bought', 'caught', 'felt', 'held', 'kept', 'left', 'lost', 'meant', 'met',
  'paid', 'put', 'read', 'sent', 'set', 'told', 'understood', 'won', 'found',
  'led', 'heard', 'built', 'bent', 'dealt', 'lent', 'spent', 'stood', 'swept',
  'broken', 'chosen', 'driven', 'eaten', 'fallen', 'forgotten', 'frozen',
  'hidden', 'risen', 'stolen', 'taken', 'thrown', 'torn', 'worn', 'beaten',
])

const PASSIVE_RE = /\b(?:am|is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(\w+)\b/gi

function isPassiveVoiceSentence(sentence: string): boolean {
  PASSIVE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PASSIVE_RE.exec(sentence)) !== null) {
    const v = m[1].toLowerCase()
    if (v.endsWith('ed') || IRREGULAR_PARTICIPLES.has(v)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Weak intensifiers
// ---------------------------------------------------------------------------

const INTENSIFIERS = /\b(very|really|extremely|incredibly|absolutely|totally|literally|basically|honestly|obviously|simply|just|quite|rather|pretty|somewhat|fairly|awfully|terribly)\b/gi

// ---------------------------------------------------------------------------
// Style heuristics
// ---------------------------------------------------------------------------

const ACADEMIC_WORDS = new Set([
  'therefore', 'however', 'furthermore', 'moreover', 'nevertheless', 'consequently',
  'hypothesis', 'methodology', 'framework', 'analysis', 'empirical', 'theoretical',
  'significant', 'demonstrate', 'illustrate', 'indicate', 'suggest', 'conclude',
  'research', 'study', 'findings', 'evidence', 'data', 'results', 'discussion',
])

const BUSINESS_WORDS = new Set([
  'leverage', 'synergy', 'stakeholder', 'deliverable', 'actionable', 'bandwidth',
  'scalable', 'robust', 'proactive', 'streamline', 'optimize', 'utilize',
  'implement', 'initiative', 'objective', 'strategy', 'solution', 'pipeline',
])

const CASUAL_MARKERS = /\b(you|your|we|our|gonna|wanna|gotta|yeah|hey|ok|okay|cool|stuff|thing|things|get|got|kind of|sort of|a lot|really|just|so)\b/gi

// ---------------------------------------------------------------------------
// Main analyzeText function
// ---------------------------------------------------------------------------

export function analyzeText(text: string): WritingAnalytics {
  const trimmed = text.trim()
  if (!trimmed) {
    return {
      words: 0, sentences: 0, avgWordsPerSentence: 0,
      fleschEase: 0, fleschGrade: 0, syllablesPerWord: 0,
      passiveSentences: 0, passivePct: 0, intensifierCount: 0,
      wordsTotal: 0, wordsUnique: 0, vocabularyRichness: 0,
      readingMinutes: 0, styleLabel: 'Mixed', readabilityLabel: 'No text',
    }
  }

  // Split into sentences (avoid lookbehind — not available on old iOS Safari)
  const sentenceList = trimmed
    .replace(/([.!?])\s+/g, '$1\x00')
    .split('\x00')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  const sentences = Math.max(1, sentenceList.length)

  // Words
  const wordList = trimmed.toLowerCase().match(/\b[a-z']{1,}\b/g) ?? []
  const wordsTotal = wordList.length || 1
  const wordsUnique = new Set(wordList).size
  const vocabularyRichness = parseFloat((wordsUnique / wordsTotal).toFixed(2))

  // Syllables
  const allWords = trimmed.match(/\b[a-zA-Z']+\b/g) ?? []
  const syllableTotal = allWords.reduce((sum, w) => sum + countSyllables(w), 0)
  const syllablesPerWord = parseFloat((syllableTotal / (allWords.length || 1)).toFixed(2))

  // Flesch scores
  const avgWords = wordsTotal / sentences
  const avgSyllables = syllableTotal / (allWords.length || 1)
  const fleschEase = Math.min(100, Math.max(0, Math.round(206.835 - 1.015 * avgWords - 84.6 * avgSyllables)))
  const fleschGrade = Math.min(18, Math.max(1, parseFloat((0.39 * avgWords + 11.8 * avgSyllables - 15.59).toFixed(1))))

  // Passive
  let passiveSentences = 0
  for (const s of sentenceList) {
    if (isPassiveVoiceSentence(s)) passiveSentences++
  }
  const passivePct = Math.round((passiveSentences / sentences) * 100)

  // Intensifiers
  const intensifierCount = (trimmed.match(INTENSIFIERS) ?? []).length

  // Reading time (230 wpm average)
  const readingMinutes = parseFloat((wordsTotal / 230).toFixed(1))

  // Style detection
  let academicScore = 0, businessScore = 0, casualScore = 0
  for (const w of wordList) {
    if (ACADEMIC_WORDS.has(w)) academicScore++
    if (BUSINESS_WORDS.has(w)) businessScore++
  }
  casualScore = (trimmed.match(CASUAL_MARKERS) ?? []).length
  const styleLabel: WritingAnalytics['styleLabel'] =
    academicScore > 3 && academicScore >= businessScore && academicScore >= casualScore / 2
      ? 'Academic'
      : businessScore > 3 && businessScore >= academicScore
      ? 'Business'
      : casualScore > wordsTotal * 0.12
      ? 'Casual'
      : academicScore === 0 && businessScore === 0 && casualScore < 3
      ? 'Creative'
      : 'Mixed'

  // Readability label
  const readabilityLabel =
    fleschEase >= 80 ? 'Very easy'
    : fleschEase >= 70 ? 'Easy'
    : fleschEase >= 60 ? 'Standard'
    : fleschEase >= 50 ? 'Fairly difficult'
    : fleschEase >= 30 ? 'Difficult'
    : 'Very difficult'

  return {
    words: wordsTotal,
    sentences,
    avgWordsPerSentence: parseFloat(avgWords.toFixed(1)),
    fleschEase,
    fleschGrade,
    syllablesPerWord,
    passiveSentences,
    passivePct,
    intensifierCount,
    wordsTotal,
    wordsUnique,
    vocabularyRichness,
    readingMinutes,
    styleLabel,
    readabilityLabel,
  }
}

// ---------------------------------------------------------------------------
// Tone meter (lexicon ratios — LIWC-style, offline)
// ---------------------------------------------------------------------------

const FORMAL_MARKERS = new Set([
  'therefore', 'however', 'furthermore', 'moreover', 'nevertheless', 'consequently',
  'thus', 'hence', 'regarding', 'herein', 'whereas', 'accordingly', 'notwithstanding',
  'subsequently', 'aforementioned', 'shall', 'thereby', 'wherein',
])
const INFORMAL_MARKERS = new Set([
  'gonna', 'wanna', 'gotta', 'yeah', 'hey', 'ok', 'okay', 'cool', 'stuff', 'kinda',
  'sorta', 'lol', 'awesome', 'guys', 'buddy', 'nope', 'yep', 'huh', 'wow',
])
const CONFIDENT_MARKERS = new Set([
  'clearly', 'certainly', 'definitely', 'undoubtedly', 'obviously', 'always', 'never',
  'must', 'will', 'surely', 'proven', 'guarantee', 'guaranteed', 'strongly', 'absolutely',
  'undeniably', 'evidently', 'indeed',
])
const TENTATIVE_MARKERS = new Set([
  'maybe', 'perhaps', 'might', 'could', 'possibly', 'seems', 'appears', 'somewhat',
  'fairly', 'probably', 'apparently', 'presumably', 'arguably', 'relatively', 'likely',
  'suppose', 'guess', 'sort', 'kind',
])
const FRIENDLY_MARKERS = new Set([
  'you', 'your', 'yours', 'we', 'our', 'us', 'thanks', 'thank', 'please', 'glad',
  'happy', 'welcome', 'hope', 'love', 'appreciate', 'great', 'wonderful',
])
const ANALYTICAL_MARKERS = new Set([
  'because', 'therefore', 'thus', 'since', 'analysis', 'data', 'result', 'results',
  'hypothesis', 'evidence', 'factor', 'cause', 'effect', 'consequently', 'hence',
  'compare', 'function', 'measure', 'correlation', 'variable',
])

export function analyzeTone(text: string): ToneScore {
  const words = text.toLowerCase().match(/\b[a-z']+\b/g) ?? []
  const total = words.length || 1
  let formal = 0, informal = 0, confident = 0, tentative = 0, friendly = 0, analytical = 0
  for (const w of words) {
    if (FORMAL_MARKERS.has(w)) formal++
    if (INFORMAL_MARKERS.has(w)) informal++
    if (CONFIDENT_MARKERS.has(w)) confident++
    if (TENTATIVE_MARKERS.has(w)) tentative++
    if (FRIENDLY_MARKERS.has(w)) friendly++
    if (ANALYTICAL_MARKERS.has(w)) analytical++
  }
  // contractions read as informal
  informal += (text.match(/\b\w+'(?:t|re|ll|ve|d|s|m)\b/gi) ?? []).length

  // intensity: ~4% marker density saturates a bar; formal nets out informal
  const norm = (n: number) => Math.min(1, Math.max(0, n) / (total * 0.04))
  const score: ToneScore = {
    formal: norm(formal - informal * 0.5),
    confident: norm(confident),
    friendly: norm(friendly),
    analytical: norm(analytical),
    tentative: norm(tentative),
    label: 'Neutral',
  }
  const ranked: [string, number][] = [
    ['Formal', formal], ['Confident', confident], ['Friendly', friendly],
    ['Analytical', analytical], ['Tentative', tentative],
  ]
  ranked.sort((a, b) => b[1] - a[1])
  if (ranked[0][1] >= 2) score.label = ranked[0][0]
  else if (informal > formal && informal >= 2) score.label = 'Casual'
  return score
}

// ---------------------------------------------------------------------------
// Hemingway-style clarity marks (character-ranged)
// ---------------------------------------------------------------------------

const ADVERB_WHITELIST = new Set([
  'only', 'family', 'reply', 'apply', 'early', 'holy', 'rely', 'ugly', 'july',
  'supply', 'multiply', 'imply', 'fly', 'ally', 'anomaly', 'assembly', 'comply',
  'likely', 'lonely', 'friendly', 'lovely', 'daily', 'weekly', 'monthly', 'yearly',
  'melancholy', 'italy', 'apply', 'jelly', 'belly', 'rally', 'silly', 'bully',
])
const WEAKENERS = new Set([
  'very', 'really', 'extremely', 'incredibly', 'absolutely', 'totally', 'literally',
  'basically', 'honestly', 'obviously', 'simply', 'just', 'quite', 'rather', 'pretty',
  'somewhat', 'fairly', 'awfully', 'terribly',
])
const COMPLEX_WORDS = new Set([
  'utilize', 'leverage', 'facilitate', 'demonstrate', 'numerous', 'individuals',
  'approximately', 'sufficient', 'additional', 'regarding', 'subsequently', 'commence',
  'terminate', 'endeavor', 'utilization', 'methodology', 'aforementioned', 'nevertheless',
  'furthermore', 'notwithstanding', 'consequently',
])

function* iterateSentences(text: string): Generator<{ start: number; text: string }> {
  const re = /[^.!?]+[.!?]*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const raw = m[0]
    const lead = raw.length - raw.trimStart().length
    const s = raw.trim()
    if (s) yield { start: m.index + lead, text: s }
  }
}

export function hemingwayMarks(text: string): HemingwayMark[] {
  const marks: HemingwayMark[] = []
  for (const sent of iterateSentences(text)) {
    const sLen = sent.text.length
    const n = (sent.text.match(/\b[a-zA-Z']+\b/g) ?? []).length
    if (n >= 20) marks.push({ begin: sent.start, end: sent.start + sLen, kind: 'very-hard' })
    else if (n >= 14) marks.push({ begin: sent.start, end: sent.start + sLen, kind: 'hard' })

    // passive (be + optional adverb + past participle)
    PASSIVE_RE.lastIndex = 0
    let pm: RegExpExecArray | null
    while ((pm = PASSIVE_RE.exec(sent.text)) !== null) {
      const v = pm[1].toLowerCase()
      if (v.endsWith('ed') || IRREGULAR_PARTICIPLES.has(v)) {
        marks.push({ begin: sent.start + pm.index, end: sent.start + pm.index + pm[0].length, kind: 'passive' })
      }
    }

    // word-level: weakeners, adverbs, complex words
    const wre = /\b[a-zA-Z']+\b/g
    let wm: RegExpExecArray | null
    while ((wm = wre.exec(sent.text)) !== null) {
      const w = wm[0].toLowerCase()
      const b = sent.start + wm.index
      const e = b + wm[0].length
      if (WEAKENERS.has(w)) marks.push({ begin: b, end: e, kind: 'weakener' })
      else if (COMPLEX_WORDS.has(w)) marks.push({ begin: b, end: e, kind: 'complex-word' })
      else if (w.length > 3 && /ly$/.test(w) && !ADVERB_WHITELIST.has(w)) marks.push({ begin: b, end: e, kind: 'adverb' })
    }
  }
  return marks
}
