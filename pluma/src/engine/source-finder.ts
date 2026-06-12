// Finds real sources for a passage using free, CORS-enabled scholarly APIs
// (OpenAlex + Crossref) — no API key, no server — plus Google Programmable
// Search when the user connects their own key. Results are scored against the
// passage with the same keyword-overlap (Jaccard) the originality check uses,
// so the "match %" is honest, not invented.

import { contentWordSet, jaccard } from './originality'

export interface FoundSource {
  id: string
  title: string
  authors: string
  year: number | null
  url: string
  abstract: string
  similarity: number // 0..1
  via: 'OpenAlex' | 'Crossref' | 'Google'
}

// --- optional Google Custom Search (needs the user's own API key + cx) ------

const GOOGLE_KEY_STORAGE = 'pluma.google-cse.v1'

export interface GoogleCseConfig {
  key: string
  cx: string
}

export function getGoogleConfig(): GoogleCseConfig | null {
  try {
    const raw = localStorage.getItem(GOOGLE_KEY_STORAGE)
    if (!raw) return null
    const cfg = JSON.parse(raw) as GoogleCseConfig
    return cfg.key && cfg.cx ? cfg : null
  } catch {
    return null
  }
}

export function setGoogleConfig(cfg: GoogleCseConfig | null) {
  if (!cfg || !cfg.key || !cfg.cx) localStorage.removeItem(GOOGLE_KEY_STORAGE)
  else localStorage.setItem(GOOGLE_KEY_STORAGE, JSON.stringify(cfg))
}

async function searchGoogle(query: string, cfg: GoogleCseConfig, signal: AbortSignal): Promise<FoundSource[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(cfg.key)}&cx=${encodeURIComponent(cfg.cx)}&q=${encodeURIComponent(query)}&num=8`
  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const data = (await res.json()) as { items?: { title?: string; link?: string; snippet?: string }[] }
  return (data.items ?? []).map((it, i) => ({
    id: it.link ?? `g${i}`,
    title: it.title ?? 'Untitled',
    authors: '',
    year: null,
    url: it.link ?? '',
    abstract: it.snippet ?? '',
    similarity: 0,
    via: 'Google' as const,
  }))
}

const STOP = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'were',
  'has', 'have', 'had', 'not', 'but', 'their', 'they', 'which', 'when', 'what',
  'about', 'into', 'over', 'than', 'then', 'also', 'such', 'these', 'those',
  'its', 'our', 'your', 'his', 'her', 'will', 'would', 'can', 'could', 'should',
])

/** Pulls the most informative terms from a passage to build a search query. */
export function keyTerms(text: string, max = 12): string[] {
  const freq = new Map<string, number>()
  for (const m of text.toLowerCase().matchAll(/[\p{L}][\p{L}-]{3,}/gu)) {
    const w = m[0]
    if (STOP.has(w)) continue
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([w]) => w)
}

function reconstructAbstract(inv: Record<string, number[]> | null | undefined): string {
  if (!inv) return ''
  const slots: string[] = []
  for (const [word, positions] of Object.entries(inv)) {
    for (const p of positions) slots[p] = word
  }
  return slots.join(' ').slice(0, 1500)
}

async function searchOpenAlex(query: string, signal: AbortSignal): Promise<FoundSource[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=10&mailto=pluma@example.com`
  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const data = (await res.json()) as { results?: OpenAlexWork[] }
  return (data.results ?? []).map((w) => ({
    id: w.id,
    title: w.title ?? w.display_name ?? 'Untitled',
    authors:
      (w.authorships ?? []).slice(0, 3).map((a) => a.author?.display_name).filter(Boolean).join(', ') +
      ((w.authorships?.length ?? 0) > 3 ? ', et al.' : ''),
    year: w.publication_year ?? null,
    url: w.doi ?? w.primary_location?.landing_page_url ?? w.id,
    abstract: reconstructAbstract(w.abstract_inverted_index),
    similarity: 0,
    via: 'OpenAlex' as const,
  }))
}

async function searchCrossref(query: string, signal: AbortSignal): Promise<FoundSource[]> {
  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=8&select=title,author,issued,DOI,URL,abstract`
  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const data = (await res.json()) as { message?: { items?: CrossrefItem[] } }
  return (data.message?.items ?? []).map((it) => ({
    id: it.DOI ?? it.URL ?? (it.title?.[0] ?? Math.random().toString()),
    title: it.title?.[0] ?? 'Untitled',
    authors:
      (it.author ?? []).slice(0, 3).map((a) => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean).join(', ') +
      ((it.author?.length ?? 0) > 3 ? ', et al.' : ''),
    year: it.issued?.['date-parts']?.[0]?.[0] ?? null,
    url: it.URL ?? (it.DOI ? `https://doi.org/${it.DOI}` : ''),
    abstract: (it.abstract ?? '').replace(/<[^>]+>/g, ' ').trim().slice(0, 1500),
    similarity: 0,
    via: 'Crossref' as const,
  }))
}

/**
 * Searches the academic databases for a passage and returns sources ranked by
 * keyword overlap with the passage. `minSimilarity` filters weak matches.
 */
export async function findSources(
  passage: string,
  opts: { minSimilarity?: number; limit?: number; timeoutMs?: number } = {},
): Promise<FoundSource[]> {
  const { minSimilarity = 0.04, limit = 8, timeoutMs = 12000 } = opts
  const query = keyTerms(passage).join(' ')
  if (query.length < 4) return []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let results: FoundSource[] = []
  try {
    const google = getGoogleConfig()
    const searches: Promise<FoundSource[]>[] = [
      searchOpenAlex(query, controller.signal),
      searchCrossref(query, controller.signal),
    ]
    if (google) searches.push(searchGoogle(query, google, controller.signal))
    const settled = await Promise.allSettled(searches)
    results = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []))
  } finally {
    clearTimeout(timer)
  }

  const passageWords = contentWordSet(passage)
  const seen = new Set<string>()
  const scored = results
    .filter((r) => {
      const key = r.title.toLowerCase().replace(/\s+/g, ' ').trim()
      if (seen.has(key) || !r.title || r.title === 'Untitled') return false
      seen.add(key)
      return true
    })
    .map((r) => ({
      ...r,
      similarity: jaccard(passageWords, contentWordSet(`${r.title} ${r.abstract}`)),
    }))
    .filter((r) => r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)

  return scored
}

interface OpenAlexWork {
  id: string
  title?: string
  display_name?: string
  publication_year?: number
  doi?: string
  authorships?: { author?: { display_name?: string } }[]
  abstract_inverted_index?: Record<string, number[]>
  primary_location?: { landing_page_url?: string }
}

interface CrossrefItem {
  DOI?: string
  URL?: string
  title?: string[]
  abstract?: string
  author?: { given?: string; family?: string }[]
  issued?: { 'date-parts'?: number[][] }
}
