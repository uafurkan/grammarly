import type { Rule, RuleMatch, Dialect } from '../types'
import { regexRule, matchCase } from './shared'

const ALL_ES: Dialect[] = ['es-ES', 'es-419']

const W = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ'

// ---------------------------------------------------------------------------
// Correctness
// ---------------------------------------------------------------------------

const repeatedWord = regexRule(
  'es.repeated-word',
  ALL_ES,
  new RegExp(`\\b([${W}]+)(\\s+)\\1\\b`, 'gi'),
  (m) => ({
    replacements: [m[1]],
    category: 'correctness',
    message: `La palabra «${m[1]}» está repetida.`,
  }),
)

const doubleSpace = regexRule('es.double-space', ALL_ES, /(?<=\S) {2,}(?=\S)/g, () => ({
  replacements: [' '],
  category: 'clarity',
  message: 'Hay espacios de más — con uno basta.',
}))

// Common missing accents — only unambiguous, high-frequency cases.
const ACCENTS: Record<string, string> = {
  tambien: 'también', despues: 'después', aqui: 'aquí', alli: 'allí',
  ademas: 'además', facil: 'fácil', dificil: 'difícil', ultimo: 'último',
  ultima: 'última', proximo: 'próximo', proxima: 'próxima', dias: 'días',
  adios: 'adiós', cafe: 'café', corazon: 'corazón', cancion: 'canción',
  atencion: 'atención', informacion: 'información', educacion: 'educación',
  investigacion: 'investigación', conclusion: 'conclusión', introduccion: 'introducción',
  analisis: 'análisis', titulo: 'título', parrafo: 'párrafo', pagina: 'página',
  numero: 'número', telefono: 'teléfono', miercoles: 'miércoles', sabado: 'sábado',
  ingles: 'inglés', espanol: 'español', rapido: 'rápido', practico: 'práctico',
  academico: 'académico', academica: 'académica', basico: 'básico', critica: 'crítica',
  metodologia: 'metodología', bibliografia: 'bibliografía', economia: 'economía',
}

const missingAccent = regexRule(
  'es.missing-accent',
  ALL_ES,
  new RegExp(`\\b(${Object.keys(ACCENTS).join('|')})\\b`, 'gi'),
  (m) => {
    const fix = ACCENTS[m[1].toLowerCase()]
    return {
      replacements: [matchCase(m[1], fix)],
      category: 'correctness',
      message: `Falta la tilde: «${fix}».`,
    }
  },
)

const MISSPELLINGS_ES: Record<string, [string, string]> = {
  hechar: ['echar', '«Echar» se escribe sin h.'],
  haci: ['así', 'Se escribe «así».'],
  nesecito: ['necesito', 'Se escribe «necesito».'],
  dijistes: ['dijiste', 'El pretérito de segunda persona no lleva -s final.'],
  fuistes: ['fuiste', 'El pretérito de segunda persona no lleva -s final.'],
  'haber si': ['a ver si', 'Aquí corresponde «a ver» (mirar), no el verbo «haber».'],
  'iva a': ['iba a', 'El imperfecto de «ir» se escribe con b: «iba».'],
  'mas sin embargo': ['sin embargo', '«Mas sin embargo» es redundante.'],
}

const misspellingEs = regexRule(
  'es.misspelling',
  ALL_ES,
  new RegExp(`\\b(${Object.keys(MISSPELLINGS_ES).join('|')})\\b`, 'gi'),
  (m) => {
    const entry = MISSPELLINGS_ES[m[1].toLowerCase()]
    if (!entry) return null
    return {
      replacements: [matchCase(m[1], entry[0])],
      category: 'correctness',
      message: entry[1],
    }
  },
)

// porque → por qué inside a direct question
const porqueQuestion = regexRule(
  'es.porque-question',
  ALL_ES,
  /¿([^?¿]*)\bporque\b/gi,
  (m) => ({
    replacements: [m[0].replace(/porque/i, 'por qué')],
    category: 'correctness',
    message: 'En preguntas directas se escribe «por qué» (separado y con tilde).',
  }),
)

// Question/exclamation without opening mark. Flags the sentence-final mark.
function invertedMark(id: string, close: '?' | '!', open: '¿' | '¡', label: string): Rule {
  return {
    id,
    dialects: ALL_ES,
    apply(text) {
      const out: RuleMatch[] = []
      const re = close === '?' ? /[^.!?¿\n][^.!?\n]*\?/g : /[^.!?¡\n][^.!?\n]*!/g
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        const sentence = m[0]
        if (sentence.includes(open)) continue
        // trim leading whitespace from the flagged range
        const lead = sentence.length - sentence.trimStart().length
        const begin = m.index + lead
        const flagged = sentence.slice(lead)
        out.push({
          begin,
          end: begin + flagged.length,
          text: flagged,
          replacements: [open + flagged],
          category: 'correctness',
          message: `Las ${label} en español llevan signo de apertura: «${open}…${close}».`,
        })
      }
      return out
    },
  }
}

// ---------------------------------------------------------------------------
// Dialect awareness (the differentiator)
// ---------------------------------------------------------------------------

// In Latin American Spanish, "vosotros" forms read as peninsular.
const vosotrosIn419 = regexRule(
  'es.419-vosotros',
  ['es-419'],
  /\b(vosotros|vosotras|vuestro|vuestra|vuestros|vuestras|os\b(?=\s))\b/gi,
  (m) => ({
    replacements: m[1].toLowerCase().startsWith('vosotr') ? ['ustedes'] : [],
    category: 'clarity',
    message: `«${m[1]}» es propio del español peninsular; en Latinoamérica se usa «ustedes» y sus formas.`,
  }),
)

// In peninsular Spanish, voseo reads as Latin American.
const voseoInES = regexRule(
  'es.es-voseo',
  ['es-ES'],
  /\bvos (sos|tenés|querés|podés|sabés|hacés|decís)\b/gi,
  (m) => ({
    replacements: [],
    category: 'clarity',
    message: `El voseo («vos ${m[1]}») es propio de partes de Latinoamérica; en España se usa «tú eres / tienes…».`,
  }),
)

// ---------------------------------------------------------------------------
// Morphology & common errors
// ---------------------------------------------------------------------------

// "haiga" → "haya", "dijistes" already handled; add frequent verb errors.
const VERB_ERRORS: Record<string, [string, string]> = {
  haiga: ['haya', 'La forma correcta del subjuntivo es «haya».'],
  haigan: ['hayan', 'La forma correcta es «hayan».'],
  vinistes: ['viniste', 'El pretérito de segunda persona no lleva -s final.'],
  hicistes: ['hiciste', 'El pretérito de segunda persona no lleva -s final.'],
  pusistes: ['pusiste', 'El pretérito de segunda persona no lleva -s final.'],
  cocreto: ['concreto', 'Se escribe «concreto».'],
  dentrar: ['entrar', 'El verbo es «entrar», no «dentrar».'],
  diferiencia: ['diferencia', 'Se escribe «diferencia».'],
}
const verbErrorsEs = regexRule(
  'es.verb-errors',
  ALL_ES,
  new RegExp(`\\b(${Object.keys(VERB_ERRORS).join('|')})\\b`, 'gi'),
  (m) => {
    const e = VERB_ERRORS[m[1].toLowerCase()]
    return e ? { replacements: [matchCase(m[1], e[0])], category: 'correctness', message: e[1] } : null
  },
)

// Confusables: "haber" vs "a ver", "halla/haya/allá", "hay/ahí/ay", "valla/vaya".
const CONFUSABLES: Record<string, [string, string]> = {
  'aver ': ['a ver ', '¿Quisiste decir «a ver» (mirar)?'],
  'sino que': ['', ''], // skip — legitimate
}
void CONFUSABLES

// número/género agreement (conservative): "la problema" → "el problema",
// "el agua frio" left alone (too risky). Only flag a tiny set of common gender slips.
const GENDER: Record<string, string> = {
  'la problema': 'el problema',
  'el mano': 'la mano',
  'la mapa': 'el mapa',
  'el agua': 'el agua', // correct (el for stressed á), keep as no-op guard
  'la tema': 'el tema',
  'el foto': 'la foto',
  'la día': 'el día',
  'el gente': 'la gente',
}
const genderEs = regexRule(
  'es.gender-agreement',
  ALL_ES,
  /\b(el|la)\s+(problema|mano|mapa|tema|foto|día|gente)\b/gi,
  (m) => {
    const phrase = `${m[1].toLowerCase()} ${m[2].toLowerCase()}`
    const fix = GENDER[phrase]
    if (!fix || fix === phrase) return null
    return {
      replacements: [matchCase(m[0], fix)],
      category: 'correctness',
      message: `Concordancia de género: «${fix}».`,
    }
  },
)

export const ES_RULES: Rule[] = [
  repeatedWord,
  doubleSpace,
  missingAccent,
  misspellingEs,
  verbErrorsEs,
  genderEs,
  porqueQuestion,
  invertedMark('es.opening-question', '?', '¿', 'preguntas'),
  invertedMark('es.opening-exclamation', '!', '¡', 'exclamaciones'),
  vosotrosIn419,
  voseoInES,
]
