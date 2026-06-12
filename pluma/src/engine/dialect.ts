import type { Dialect } from './types'

const ES_MARKERS = /[¿¡ñ]|á|é|í|ó|ú/i
const ES_STOPWORDS = /\b(el|la|los|las|que|de|en|un|una|por|para|con|es|está|pero|como|más)\b/gi
const EN_STOPWORDS = /\b(the|and|of|to|in|is|that|it|for|with|as|was|are|this|but|have)\b/gi

/**
 * Cheap per-document language guess used to pick a sensible default dialect.
 * The user can always override via the selector.
 */
export function guessDialect(text: string, fallback: Dialect = 'en-US'): Dialect {
  const sample = text.slice(0, 4000)
  if (sample.trim().length < 20) return fallback
  const es = (sample.match(ES_STOPWORDS)?.length ?? 0) + (ES_MARKERS.test(sample) ? 3 : 0)
  const en = sample.match(EN_STOPWORDS)?.length ?? 0
  if (es > en * 1.2) return fallback.startsWith('es') ? fallback : 'es-419'
  if (en > es * 1.2) return fallback.startsWith('en') ? fallback : 'en-US'
  return fallback
}
