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
