// Datamuse word API — free, keyless, quota-free, CORS-enabled. Powers the
// thesaurus popover, in-word autocomplete, and a spelling-suggestion boost.
// Every call degrades silently to [] when offline so nothing ever blocks.

const BASE = 'https://api.datamuse.com/words'

interface RawWord { word: string; score?: number }

// tiny LRU so repeated lookups (and re-renders) don't refetch
const cache = new Map<string, string[]>()
const CACHE_MAX = 200
function remember(key: string, value: string[]): string[] {
  cache.delete(key)
  cache.set(key, value)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
  return value
}

async function query(params: string, signal?: AbortSignal): Promise<string[]> {
  const cached = cache.get(params)
  if (cached) return cached
  try {
    const res = await fetch(`${BASE}?${params}`, { signal })
    if (!res.ok) return []
    const data = (await res.json()) as RawWord[]
    return remember(params, data.map((d) => d.word).filter(Boolean))
  } catch {
    return [] // offline / aborted — caller falls back
  }
}

/** Plain synonyms for a word. */
export function synonyms(word: string, signal?: AbortSignal): Promise<string[]> {
  const w = word.trim().toLowerCase()
  if (!w) return Promise.resolve([])
  return query(`rel_syn=${encodeURIComponent(w)}&max=12`, signal)
}

/** Antonyms for a word. */
export function antonyms(word: string, signal?: AbortSignal): Promise<string[]> {
  const w = word.trim().toLowerCase()
  if (!w) return Promise.resolve([])
  return query(`rel_ant=${encodeURIComponent(w)}&max=8`, signal)
}

/**
 * Context-aware synonyms: "means like" the word, biased by the surrounding
 * words so suggestions fit the sentence. Falls back to plain synonyms.
 */
export async function contextualSynonyms(
  word: string,
  before: string,
  after: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const w = word.trim().toLowerCase()
  if (!w) return []
  const lc = before.trim().split(/\s+/).pop() ?? ''
  const rc = after.trim().split(/\s+/)[0] ?? ''
  const ctx = `ml=${encodeURIComponent(w)}&max=12${lc ? `&lc=${encodeURIComponent(lc)}` : ''}${rc ? `&rc=${encodeURIComponent(rc)}` : ''}`
  const out = (await query(ctx, signal)).filter((s) => s.toLowerCase() !== w)
  return out.length > 0 ? out : synonyms(w, signal)
}

/** Completions for a partial word (spelling-pattern wildcard, ranked by frequency). */
export function completions(prefix: string, signal?: AbortSignal): Promise<string[]> {
  const p = prefix.trim().toLowerCase()
  if (p.length < 3) return Promise.resolve([])
  return query(`sp=${encodeURIComponent(p)}*&max=6&md=f`, signal)
}

/** Extra spelling candidates for a misspelled word, to enrich the offline ranker. */
export function betterSpelling(word: string, signal?: AbortSignal): Promise<string[]> {
  const w = word.trim().toLowerCase()
  if (!w) return Promise.resolve([])
  return query(`sp=${encodeURIComponent(w)}&max=5`, signal)
}
