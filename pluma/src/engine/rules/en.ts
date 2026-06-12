import type { Rule, Dialect } from '../types'
import { regexRule, matchCase } from './shared'
import { BAD_PAST, BAD_PARTICIPLE, BAD_PLURAL, THIRD_PERSON } from '../data/grammar-en'

const ALL_EN: Dialect[] = ['en-US', 'en-GB']

// ---------------------------------------------------------------------------
// Correctness
// ---------------------------------------------------------------------------

const repeatedWord = regexRule(
  'en.repeated-word',
  ALL_EN,
  /\b([A-Za-z']+)(\s+)\1\b/gi,
  (m) =>
    // "had had", "that that" are legitimate often enough to skip the noisiest ones
    ['had', 'that', 'very', 'really'].includes(m[1].toLowerCase())
      ? null
      : {
          replacements: [m[1]],
          category: 'correctness',
          message: `The word “${m[1]}” is repeated.`,
        },
)

const doubleSpace = regexRule('en.double-space', ALL_EN, /(?<=\S) {2,}(?=\S)/g, () => ({
  replacements: [' '],
  category: 'clarity',
  message: 'Multiple spaces — one is enough.',
}))

const AN_EXCEPTIONS = new Set(['university', 'unit', 'united', 'user', 'one', 'once', 'european', 'unique', 'useful'])
const A_EXCEPTIONS = new Set(['hour', 'honest', 'honor', 'honour', 'heir'])

const articleAn = regexRule('en.a-vs-an', ALL_EN, /\b(a|an) ([a-z]+)/gi, (m) => {
  const article = m[1].toLowerCase()
  const word = m[2].toLowerCase()
  const startsVowel = /^[aeiou]/.test(word)
  const wantsAn = A_EXCEPTIONS.has(word) || (startsVowel && !AN_EXCEPTIONS.has(word))
  if (article === 'a' && wantsAn) {
    return {
      replacements: [`an ${m[2]}`],
      category: 'correctness',
      message: `Use “an” before a vowel sound: “an ${word}”.`,
    }
  }
  if (article === 'an' && !wantsAn) {
    return {
      replacements: [`a ${m[2]}`],
      category: 'correctness',
      message: `Use “a” before a consonant sound: “a ${word}”.`,
    }
  }
  return null
})

const lonelyI = regexRule('en.lowercase-i', ALL_EN, /(?<=^|[\s(])i(?=[\s,.!?;:)']|$)/gm, () => ({
  replacements: ['I'],
  category: 'correctness',
  message: 'The pronoun “I” is always capitalized.',
}))

const sentenceCase = regexRule(
  'en.sentence-capital',
  ALL_EN,
  /(?<=[.!?]\s+)([a-z])(?=[a-z]*\b)/g,
  (m) => ({
    replacements: [m[1].toUpperCase()],
    category: 'correctness',
    message: 'Sentences begin with a capital letter.',
  }),
)

const SV_MAP: Record<string, string> = {
  go: 'goes', do: 'does', have: 'has', want: 'wants', need: 'needs',
  like: 'likes', make: 'makes', say: 'says', know: 'knows', think: 'thinks',
  take: 'takes', get: 'gets', work: 'works', live: 'lives', study: 'studies',
}

const subjectVerb = regexRule(
  'en.subject-verb',
  ALL_EN,
  /\b(he|she|it)\s+(go|do|have|want|need|like|make|say|know|think|take|get|work|live|study)\b/gi,
  (m) => {
    const verb = m[2].toLowerCase()
    const fixed = SV_MAP[verb]
    if (!fixed) return null
    return {
      replacements: [`${m[1]} ${fixed}`],
      category: 'correctness',
      message: `“${m[1]}” takes the third-person form: “${fixed}”.`,
    }
  },
)

const COULD_OF = regexRule('en.could-of', ALL_EN, /\b(could|would|should|must|might) of\b/gi, (m) => ({
  replacements: [`${m[1]} have`],
  category: 'correctness',
  message: `“${m[1]} of” is a mishearing of “${m[1]} have”.`,
}))

const MISSPELLINGS: Record<string, string> = {
  alot: 'a lot', definately: 'definitely', recieve: 'receive', seperate: 'separate',
  occured: 'occurred', untill: 'until', wich: 'which', becuase: 'because',
  teh: 'the', thier: 'their', freind: 'friend', beleive: 'believe',
  enviroment: 'environment', goverment: 'government', tommorow: 'tomorrow',
  truely: 'truly', arguement: 'argument', occurence: 'occurrence',
  existance: 'existence', accomodate: 'accommodate', neccessary: 'necessary',
  publically: 'publicly', concious: 'conscious', writting: 'writing',
}

const misspelling = regexRule(
  'en.misspelling',
  ALL_EN,
  new RegExp(`\\b(${Object.keys(MISSPELLINGS).join('|')})\\b`, 'gi'),
  (m) => {
    const fix = MISSPELLINGS[m[1].toLowerCase()]
    return {
      replacements: [matchCase(m[1], fix)],
      category: 'correctness',
      message: `Possible spelling mistake — did you mean “${fix}”?`,
    }
  },
)

const CONTRACTIONS: Record<string, string> = {
  dont: "don't", doesnt: "doesn't", didnt: "didn't", cant: "can't",
  wont: "won't", isnt: "isn't", arent: "aren't", wasnt: "wasn't",
  werent: "weren't", couldnt: "couldn't", wouldnt: "wouldn't",
  shouldnt: "shouldn't", havent: "haven't", hasnt: "hasn't", im: "I'm",
  youre: "you're", theyre: "they're", weve: "we've", youve: "you've",
}

const contraction = regexRule(
  'en.contraction-apostrophe',
  ALL_EN,
  new RegExp(`\\b(${Object.keys(CONTRACTIONS).join('|')})\\b`, 'gi'),
  (m) => {
    const key = m[1].toLowerCase()
    // "im", "wont", "cant" can be legitimate words in rare contexts; still the
    // student-writing odds overwhelmingly favor the contraction.
    const fix = CONTRACTIONS[key]
    return {
      replacements: [key === 'im' ? "I'm" : matchCase(m[1], fix)],
      category: 'correctness',
      message: `Missing apostrophe — “${fix}”.`,
    }
  },
)

const yourWelcome = regexRule('en.your-youre', ALL_EN, /\byour (welcome|right about|going to|not going)\b/gi, (m) => ({
  replacements: [`you're ${m[1]}`],
  category: 'correctness',
  message: `Here “you're” (you are) is intended, not the possessive “your”.`,
}))

const itsIts = regexRule(
  'en.its-its',
  ALL_EN,
  /\bits (a|an|the|not|been|very|so|really|going|important|possible|likely|clear|true)\b/gi,
  (m) => ({
    replacements: [`it's ${m[1]}`],
    category: 'correctness',
    message: `Here “it's” (it is) is intended, not the possessive “its”.`,
  }),
)

// ---------------------------------------------------------------------------
// Dialect (US ↔ UK spelling)
// ---------------------------------------------------------------------------

const UK_TO_US: Record<string, string> = {
  colour: 'color', colours: 'colors', favour: 'favor', favourite: 'favorite',
  behaviour: 'behavior', honour: 'honor', labour: 'labor', neighbour: 'neighbor',
  organise: 'organize', organised: 'organized', organisation: 'organization',
  analyse: 'analyze', analysed: 'analyzed', realise: 'realize', realised: 'realized',
  recognise: 'recognize', centre: 'center', metre: 'meter', litre: 'liter',
  theatre: 'theater', travelling: 'traveling', travelled: 'traveled',
  cancelled: 'canceled', defence: 'defense', licence: 'license', practise: 'practice',
  programme: 'program', catalogue: 'catalog', grey: 'gray',
}
const US_TO_UK: Record<string, string> = Object.fromEntries(
  Object.entries(UK_TO_US).map(([uk, us]) => [us, uk]),
)

function dialectSpelling(id: string, dialect: Dialect, map: Record<string, string>, label: string): Rule {
  const re = new RegExp(`\\b(${Object.keys(map).join('|')})\\b`, 'gi')
  return regexRule(id, [dialect], re, (m) => {
    const fix = map[m[1].toLowerCase()]
    if (!fix) return null
    return {
      replacements: [matchCase(m[1], fix)],
      category: 'correctness',
      message: `“${m[1]}” is the ${label} spelling — your document is set to ${dialect === 'en-US' ? 'American' : 'British'} English.`,
    }
  })
}

// ---------------------------------------------------------------------------
// Morphology: irregular verbs, agreement, plurals (the depth Grammarly has)
// ---------------------------------------------------------------------------

// "goed" → "went", "buyed" → "bought", …
const badPast = regexRule(
  'en.irregular-past',
  ALL_EN,
  new RegExp(`\\b(${Object.keys(BAD_PAST).join('|')})\\b`, 'gi'),
  (m) => {
    const fix = BAD_PAST[m[1].toLowerCase()]
    return fix
      ? { replacements: [matchCase(m[1], fix)], category: 'correctness', message: `Irregular past tense — “${fix}”.` }
      : null
  },
)

// "have went" → "have gone"
const badParticiple = regexRule(
  'en.bad-participle',
  ALL_EN,
  new RegExp(`\\b(have|has|had|having)\\s+(${Object.keys(BAD_PARTICIPLE).join('|')})\\b`, 'gi'),
  (m) => {
    const fix = BAD_PARTICIPLE[m[2].toLowerCase()]
    return fix
      ? {
          replacements: [`${m[1]} ${matchCase(m[2], fix)}`],
          category: 'correctness',
          message: `After “${m[1].toLowerCase()}”, use the past participle “${fix}”.`,
        }
      : null
  },
)

// "peoples" → "people"
const badPlural = regexRule(
  'en.irregular-plural',
  ALL_EN,
  new RegExp(`\\b(${Object.keys(BAD_PLURAL).join('|')})\\b`, 'gi'),
  (m) => {
    const fix = BAD_PLURAL[m[1].toLowerCase()]
    return fix
      ? { replacements: [matchCase(m[1], fix)], category: 'correctness', message: `“${fix}” is already plural (or uncountable).` }
      : null
  },
)

// be-agreement: "they was" → "they were", "we was" → "we were", "I were" → "I was",
// "it were" → "it was", "he were" → "he was".
const PLURAL_SUBJ = /\b(we|they|you|these|those)\s+(was)\b/gi
const SING_SUBJ = /\b(i|he|she|it|this|that)\s+(were)\b/gi

const wasWerePlural = regexRule('en.was-were-plural', ALL_EN, PLURAL_SUBJ, (m) => ({
  replacements: [`${m[1]} were`],
  category: 'correctness',
  message: `“${m[1].toLowerCase()}” takes “were”, not “was”.`,
}))

const wasWereSingular = regexRule('en.were-was-singular', ALL_EN, SING_SUBJ, (m) => ({
  replacements: [`${m[1]} ${m[1].toLowerCase() === 'i' ? 'was' : 'was'}`],
  category: 'correctness',
  message: `“${m[1]}” takes “was”, not “were”.`,
}))

// "the weather were" → "was": a singular common noun directly before were.
const nounWere = regexRule(
  'en.noun-were',
  ALL_EN,
  /\b(the|this|that|a|an|his|her|its|my|your|our|their)\s+([a-z]+)\s+(were)\b/gi,
  (m) => {
    const noun = m[2].toLowerCase()
    if (/s$/.test(noun) || ['people', 'police', 'children', 'men', 'women'].includes(noun)) return null
    return {
      replacements: [`${m[1]} ${m[2]} was`],
      category: 'correctness',
      message: `Singular subject “${m[1]} ${m[2]}” takes “was”.`,
    }
  },
)

// third-person singular present: "he go" → "he goes", "she don't" → "she doesn't"
const verbsAlt = Object.keys(THIRD_PERSON).join('|')
const thirdPersonS = regexRule(
  'en.third-person-s',
  ALL_EN,
  new RegExp(`\\b(he|she|it)\\s+(${verbsAlt})\\b`, 'gi'),
  (m) => {
    const fix = THIRD_PERSON[m[2].toLowerCase()]
    return fix
      ? {
          replacements: [`${m[1]} ${matchCase(m[2], fix)}`],
          category: 'correctness',
          message: `“${m[1]}” takes the -s form: “${fix}”.`,
        }
      : null
  },
)

// plural subject + 3rd-person -s verb: "we goes" → "we go", "they likes" → "they like"
const THIRD_TO_BASE: Record<string, string> = Object.fromEntries(
  Object.entries(THIRD_PERSON).map(([base, third]) => [third, base]),
)
const pluralVerbAgreement = regexRule(
  'en.plural-verb',
  ALL_EN,
  new RegExp(`\\b(we|they|you|i)\\s+(${Object.values(THIRD_PERSON).join('|')})\\b`, 'gi'),
  (m) => {
    const base = THIRD_TO_BASE[m[2].toLowerCase()]
    if (!base) return null
    return {
      replacements: [`${m[1]} ${matchCase(m[2], base)}`],
      category: 'correctness',
      message: `“${m[1].toLowerCase()}” takes the base form: “${base}”.`,
    }
  },
)

// "he don't" / "she don't" → "doesn't"; "don't likes" → "doesn't like" handled below
const dontDoesnt = regexRule(
  'en.dont-doesnt',
  ALL_EN,
  /\b(he|she|it)\s+(don't|do not)\b/gi,
  (m) => ({
    replacements: [`${m[1]} ${m[2].toLowerCase() === "don't" ? "doesn't" : 'does not'}`],
    category: 'correctness',
    message: `“${m[1]}” takes “doesn't”, not “don't”.`,
  }),
)

// "doesn't likes" / "don't likes" → base verb after do-support
const doSupportBase = regexRule(
  'en.do-support-base',
  ALL_EN,
  new RegExp(`\\b(don't|doesn't|didn't|do not|does not|did not)\\s+([a-z]+s)\\b`, 'gi'),
  (m) => {
    const v = m[2].toLowerCase()
    const base = Object.entries(THIRD_PERSON).find(([, third]) => third === v)?.[0]
    if (!base) return null
    return {
      replacements: [`${m[1]} ${matchCase(m[2], base)}`],
      category: 'correctness',
      message: `After “${m[1].toLowerCase()}”, use the base form “${base}”.`,
    }
  },
)

// missing sentence-ending punctuation before a clear new capitalised sentence
const runOn = regexRule(
  'en.run-on',
  ALL_EN,
  /[a-z]{2,}\s+(?=[A-Z][a-z]+\s+(?:I|the|he|she|they|we|it|this|that|then|after|when|but)\b)/g,
  () => null, // disabled by default (high false-positive); kept as a documented hook
)
void runOn

export const EN_RULES: Rule[] = [
  repeatedWord,
  doubleSpace,
  articleAn,
  lonelyI,
  sentenceCase,
  subjectVerb,
  thirdPersonS,
  pluralVerbAgreement,
  dontDoesnt,
  doSupportBase,
  badPast,
  badParticiple,
  badPlural,
  wasWerePlural,
  wasWereSingular,
  nounWere,
  COULD_OF,
  misspelling,
  contraction,
  yourWelcome,
  itsIts,
  dialectSpelling('en.us-spelling', 'en-US', UK_TO_US, 'British'),
  dialectSpelling('en.uk-spelling', 'en-GB', US_TO_UK, 'American'),
]
