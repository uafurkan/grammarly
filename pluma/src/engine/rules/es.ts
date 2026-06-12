import type { Rule, RuleMatch, Dialect } from '../types'

const ALL_ES: Dialect[] = ['es-ES', 'es-419']

function regexRule(
  id: string,
  dialects: Dialect[],
  pattern: RegExp,
  build: (m: RegExpExecArray) => Omit<RuleMatch, 'begin' | 'end' | 'text'> | null,
): Rule {
  return {
    id,
    dialects,
    apply(text) {
      const out: RuleMatch[] = []
      const re = new RegExp(pattern.source, pattern.flags)
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++
          continue
        }
        const built = build(m)
        if (built) out.push({ begin: m.index, end: m.index + m[0].length, text: m[0], ...built })
      }
      return out
    },
  }
}

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

function matchCase(source: string, target: string): string {
  if (source === source.toUpperCase() && source.length > 1) return target.toUpperCase()
  if (source[0] === source[0].toUpperCase()) return target[0].toUpperCase() + target.slice(1)
  return target
}

export const ES_RULES: Rule[] = [
  repeatedWord,
  doubleSpace,
  missingAccent,
  misspellingEs,
  porqueQuestion,
  invertedMark('es.opening-question', '?', '¿', 'preguntas'),
  invertedMark('es.opening-exclamation', '!', '¡', 'exclamaciones'),
  vosotrosIn419,
  voseoInES,
]
