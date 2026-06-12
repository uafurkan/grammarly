// Finds real sources for a passage. Always searches:
//   OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC, DOAJ
// Optionally (user provides their own key, stored only in localStorage):
//   Google Programmable Search, Brave Search, Serper (Google), Bing Web Search
// All results are scored with the same honest Jaccard keyword-overlap metric.

import { contentWordSet, jaccard } from './originality'

export type SourceVia =
  | 'OpenAlex'
  | 'Crossref'
  | 'SemanticScholar'
  | 'arXiv'
  | 'EuropePMC'
  | 'DOAJ'
  | 'Google'
  | 'Brave'
  | 'Serper'
  | 'Bing'

export interface FoundSource {
  id: string
  title: string
  authors: string
  year: number | null
  url: string
  abstract: string
  similarity: number // 0..1
  via: SourceVia
}

// ---------------------------------------------------------------------------
// Optional web-search engines (each needs the user's own API key)
// ---------------------------------------------------------------------------

type WebEngineId = 'google' | 'brave' | 'serper' | 'bing'

interface WebEngineConfig {
  key: string
  cx?: string // Google only
}

function storageKey(engine: WebEngineId) {
  return `pluma.web-search.${engine}.v1`
}

export function getWebConfig(engine: WebEngineId): WebEngineConfig | null {
  try {
    const raw = localStorage.getItem(storageKey(engine))
    if (!raw) return null
    const cfg = JSON.parse(raw) as WebEngineConfig
    return cfg.key ? cfg : null
  } catch {
    return null
  }
}

export function setWebConfig(engine: WebEngineId, cfg: WebEngineConfig | null) {
  if (!cfg?.key) localStorage.removeItem(storageKey(engine))
  else localStorage.setItem(storageKey(engine), JSON.stringify(cfg))
}

// Backwards-compat helpers used by existing UI code
export const getGoogleConfig = () => getWebConfig('google')
export const setGoogleConfig = (cfg: { key: string; cx: string } | null) =>
  setWebConfig('google', cfg)

// ---------------------------------------------------------------------------
// Free academic searches (no key needed)
// ---------------------------------------------------------------------------

const STOP = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'were',
  'has', 'have', 'had', 'not', 'but', 'their', 'they', 'which', 'when', 'what',
  'about', 'into', 'over', 'than', 'then', 'also', 'such', 'these', 'those',
  'its', 'our', 'your', 'his', 'her', 'will', 'would', 'can', 'could', 'should',
])

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

async function searchSemanticScholar(query: string, signal: AbortSignal): Promise<FoundSource[]> {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,authors,year,abstract,externalIds,openAccessPdf&limit=8`
  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const data = (await res.json()) as { data?: SsWork[] }
  return (data.data ?? []).map((w) => {
    const doi = w.externalIds?.DOI
    const arxiv = w.externalIds?.ArXiv
    const pdfUrl = w.openAccessPdf?.url
    const fallback = doi ? `https://doi.org/${doi}` : arxiv ? `https://arxiv.org/abs/${arxiv}` : pdfUrl ?? ''
    return {
      id: w.paperId,
      title: w.title ?? 'Untitled',
      authors:
        (w.authors ?? []).slice(0, 3).map((a) => a.name).filter(Boolean).join(', ') +
        ((w.authors?.length ?? 0) > 3 ? ', et al.' : ''),
      year: w.year ?? null,
      url: fallback,
      abstract: (w.abstract ?? '').slice(0, 1500),
      similarity: 0,
      via: 'SemanticScholar' as const,
    }
  })
}

async function searchArXiv(query: string, signal: AbortSignal): Promise<FoundSource[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=8&sortBy=relevance`
  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const xml = await res.text()
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.querySelectorAll('entry')).map((e, i) => {
    const get = (tag: string) => e.querySelector(tag)?.textContent?.trim() ?? ''
    const id = get('id') || `ax${i}`
    const authors = Array.from(e.querySelectorAll('author name'))
      .slice(0, 3)
      .map((n) => n.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(', ')
    const published = get('published')
    const year = published ? parseInt(published.slice(0, 4), 10) : null
    return {
      id,
      title: get('title').replace(/\s+/g, ' '),
      authors,
      year: isNaN(year!) ? null : year,
      url: id.startsWith('http') ? id : `https://arxiv.org/abs/${id}`,
      abstract: get('summary').replace(/\s+/g, ' ').slice(0, 1500),
      similarity: 0,
      via: 'arXiv' as const,
    }
  })
}

async function searchEuropePMC(query: string, signal: AbortSignal): Promise<FoundSource[]> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=8&resultType=core`
  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const data = (await res.json()) as { resultList?: { result?: EpmcResult[] } }
  return (data.resultList?.result ?? []).map((r) => ({
    id: r.pmid ?? r.doi ?? r.id ?? Math.random().toString(),
    title: r.title ?? 'Untitled',
    authors: r.authorString ?? '',
    year: r.pubYear ? parseInt(r.pubYear, 10) : null,
    url: r.doi ? `https://doi.org/${r.doi}` : r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : '',
    abstract: (r.abstractText ?? '').slice(0, 1500),
    similarity: 0,
    via: 'EuropePMC' as const,
  }))
}

async function searchDOAJ(query: string, signal: AbortSignal): Promise<FoundSource[]> {
  const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=8`
  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const data = (await res.json()) as { results?: DoajResult[] }
  return (data.results ?? []).map((r) => {
    const bib = r.bibjson
    const doi = bib?.identifier?.find((x) => x.type === 'doi')?.id
    const link = bib?.link?.find((x) => x.type === 'fulltext')?.url ?? (doi ? `https://doi.org/${doi}` : '')
    return {
      id: r.id ?? doi ?? Math.random().toString(),
      title: bib?.title ?? 'Untitled',
      authors: (bib?.author ?? []).slice(0, 3).map((a) => a.name).filter(Boolean).join(', '),
      year: bib?.year ? parseInt(bib.year, 10) : null,
      url: link,
      abstract: (bib?.abstract ?? '').slice(0, 1500),
      similarity: 0,
      via: 'DOAJ' as const,
    }
  })
}

// ---------------------------------------------------------------------------
// Optional keyed web searches
// ---------------------------------------------------------------------------

async function searchGoogle(query: string, cfg: WebEngineConfig, signal: AbortSignal): Promise<FoundSource[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(cfg.key)}&cx=${encodeURIComponent(cfg.cx ?? '')}&q=${encodeURIComponent(query)}&num=8`
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

async function searchBrave(query: string, cfg: WebEngineConfig, signal: AbortSignal): Promise<FoundSource[]> {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`,
    { signal, headers: { 'X-Subscription-Token': cfg.key, Accept: 'application/json' } },
  )
  if (!res.ok) return []
  const data = (await res.json()) as { web?: { results?: { title?: string; url?: string; description?: string }[] } }
  return (data.web?.results ?? []).map((it, i) => ({
    id: it.url ?? `br${i}`,
    title: it.title ?? 'Untitled',
    authors: '',
    year: null,
    url: it.url ?? '',
    abstract: it.description ?? '',
    similarity: 0,
    via: 'Brave' as const,
  }))
}

async function searchSerper(query: string, cfg: WebEngineConfig, signal: AbortSignal): Promise<FoundSource[]> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    signal,
    headers: { 'X-API-KEY': cfg.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 8 }),
  })
  if (!res.ok) return []
  const data = (await res.json()) as { organic?: { title?: string; link?: string; snippet?: string }[] }
  return (data.organic ?? []).map((it, i) => ({
    id: it.link ?? `sr${i}`,
    title: it.title ?? 'Untitled',
    authors: '',
    year: null,
    url: it.link ?? '',
    abstract: it.snippet ?? '',
    similarity: 0,
    via: 'Serper' as const,
  }))
}

async function searchBing(query: string, cfg: WebEngineConfig, signal: AbortSignal): Promise<FoundSource[]> {
  const res = await fetch(
    `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=8`,
    { signal, headers: { 'Ocp-Apim-Subscription-Key': cfg.key } },
  )
  if (!res.ok) return []
  const data = (await res.json()) as { webPages?: { value?: { name?: string; url?: string; snippet?: string }[] } }
  return (data.webPages?.value ?? []).map((it, i) => ({
    id: it.url ?? `bi${i}`,
    title: it.name ?? 'Untitled',
    authors: '',
    year: null,
    url: it.url ?? '',
    abstract: it.snippet ?? '',
    similarity: 0,
    via: 'Bing' as const,
  }))
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function findSources(
  passage: string,
  opts: { minSimilarity?: number; limit?: number; timeoutMs?: number } = {},
): Promise<FoundSource[]> {
  const { minSimilarity = 0.04, limit = 10, timeoutMs = 14000 } = opts
  const query = keyTerms(passage).join(' ')
  if (query.length < 4) return []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let results: FoundSource[] = []
  try {
    const searches: Promise<FoundSource[]>[] = [
      searchOpenAlex(query, controller.signal),
      searchCrossref(query, controller.signal),
      searchSemanticScholar(query, controller.signal),
      searchArXiv(query, controller.signal),
      searchEuropePMC(query, controller.signal),
      searchDOAJ(query, controller.signal),
    ]
    const google = getWebConfig('google')
    const brave = getWebConfig('brave')
    const serper = getWebConfig('serper')
    const bing = getWebConfig('bing')
    if (google) searches.push(searchGoogle(query, google, controller.signal))
    if (brave) searches.push(searchBrave(query, brave, controller.signal))
    if (serper) searches.push(searchSerper(query, serper, controller.signal))
    if (bing) searches.push(searchBing(query, bing, controller.signal))

    const settled = await Promise.allSettled(searches)
    results = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []))
  } finally {
    clearTimeout(timer)
  }

  const passageWords = contentWordSet(passage)
  const seen = new Set<string>()
  return results
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
}

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

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

interface SsWork {
  paperId: string
  title?: string
  abstract?: string
  year?: number
  authors?: { name: string }[]
  externalIds?: { DOI?: string; ArXiv?: string }
  openAccessPdf?: { url: string }
}

interface EpmcResult {
  id?: string
  pmid?: string
  doi?: string
  title?: string
  authorString?: string
  pubYear?: string
  abstractText?: string
}

interface DoajResult {
  id?: string
  bibjson?: {
    title?: string
    abstract?: string
    year?: string
    author?: { name: string }[]
    link?: { url: string; type: string }[]
    identifier?: { type: string; id: string }[]
  }
}
