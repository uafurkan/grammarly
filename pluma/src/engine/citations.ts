// Citation generator — formats references in APA, MLA, Chicago, and BibTeX,
// entirely client-side. Builds from the metadata the source finder already
// returns, or from a DOI fetched via Crossref. No key, no server.

import type { FoundSource } from './source-finder'

export type CiteStyle = 'apa' | 'mla' | 'chicago' | 'bibtex'

export const CITE_STYLES: { id: CiteStyle; label: string }[] = [
  { id: 'apa', label: 'APA' },
  { id: 'mla', label: 'MLA' },
  { id: 'chicago', label: 'Chicago' },
  { id: 'bibtex', label: 'BibTeX' },
]

export interface Author {
  given?: string
  family: string
}

export interface Reference {
  id: string
  type: 'article-journal' | 'webpage' | 'book' | 'report'
  title: string
  authors: Author[]
  year: number | null
  container?: string // journal / site / publisher venue
  volume?: string
  issue?: string
  pages?: string
  publisher?: string
  doi?: string
  url?: string
  accessed?: string // ISO date, for webpages
}

// --- author-name helpers ----------------------------------------------------

function initials(given?: string): string {
  if (!given) return ''
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(' ')
}

/** "Family, G. M." */
function apaName(a: Author): string {
  const i = initials(a.given)
  return i ? `${a.family}, ${i}` : a.family
}

/** "Given Family" */
function fullName(a: Author): string {
  return [a.given, a.family].filter(Boolean).join(' ')
}

function apaAuthors(authors: Author[]): string {
  if (authors.length === 0) return ''
  if (authors.length === 1) return apaName(authors[0])
  if (authors.length <= 20) {
    const all = authors.map(apaName)
    return `${all.slice(0, -1).join(', ')}, & ${all[all.length - 1]}`
  }
  return `${authors.slice(0, 19).map(apaName).join(', ')}, … ${apaName(authors[authors.length - 1])}`
}

function mlaAuthors(authors: Author[]): string {
  if (authors.length === 0) return ''
  const first = authors[0]
  const lead = first.given ? `${first.family}, ${first.given}` : first.family
  if (authors.length === 1) return lead
  if (authors.length === 2) return `${lead}, and ${fullName(authors[1])}`
  return `${lead}, et al.`
}

// --- formatters -------------------------------------------------------------

function dot(s: string): string {
  return /[.?!]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`
}

export function formatCitation(ref: Reference, style: CiteStyle): string {
  if (style === 'bibtex') return toBibTeX(ref)
  const year = ref.year ? `${ref.year}` : 'n.d.'
  const link = ref.doi ? `https://doi.org/${ref.doi}` : ref.url ?? ''

  if (style === 'apa') {
    const parts: string[] = []
    const a = apaAuthors(ref.authors)
    if (a) parts.push(dot(a))
    parts.push(`(${year}).`)
    parts.push(dot(ref.title))
    if (ref.container) {
      let venue = `*${ref.container}*`
      if (ref.volume) venue += `, ${ref.volume}`
      if (ref.issue) venue += `(${ref.issue})`
      if (ref.pages) venue += `, ${ref.pages}`
      parts.push(dot(venue))
    } else if (ref.publisher) {
      parts.push(dot(ref.publisher))
    }
    if (link) parts.push(link)
    return parts.join(' ').trim()
  }

  if (style === 'mla') {
    const parts: string[] = []
    const a = mlaAuthors(ref.authors)
    if (a) parts.push(dot(a))
    parts.push(`"${dot(ref.title)}"`)
    if (ref.container) {
      let venue = `*${ref.container}*`
      if (ref.volume) venue += `, vol. ${ref.volume}`
      if (ref.issue) venue += `, no. ${ref.issue}`
      venue += `, ${year}`
      if (ref.pages) venue += `, pp. ${ref.pages}`
      parts.push(dot(venue))
    } else {
      parts.push(`${year}.`)
    }
    if (link) parts.push(link)
    return parts.join(' ').trim()
  }

  // chicago (notes-bibliography, simplified)
  const parts: string[] = []
  const a = mlaAuthors(ref.authors)
  if (a) parts.push(dot(a))
  parts.push(`"${dot(ref.title)}"`)
  if (ref.container) {
    let venue = `*${ref.container}*`
    if (ref.volume) venue += ` ${ref.volume}`
    if (ref.issue) venue += `, no. ${ref.issue}`
    venue += ` (${year})`
    if (ref.pages) venue += `: ${ref.pages}`
    parts.push(dot(venue))
  } else {
    if (ref.publisher) parts.push(`${ref.publisher},`)
    parts.push(`${year}.`)
  }
  if (link) parts.push(link)
  return parts.join(' ').trim()
}

export function formatInText(ref: Reference, style: CiteStyle): string {
  const year = ref.year ? `${ref.year}` : 'n.d.'
  const fam = ref.authors[0]?.family
  if (style === 'apa') {
    if (!fam) return `(${year})`
    if (ref.authors.length === 1) return `(${fam}, ${year})`
    if (ref.authors.length === 2) return `(${fam} & ${ref.authors[1].family}, ${year})`
    return `(${fam} et al., ${year})`
  }
  // mla / chicago author-page style (page unknown → author only)
  if (!fam) return `("${ref.title.slice(0, 20)}…")`
  if (ref.authors.length > 2) return `(${fam} et al.)`
  if (ref.authors.length === 2) return `(${fam} and ${ref.authors[1].family})`
  return `(${fam})`
}

export function toBibTeX(ref: Reference): string {
  const fam = ref.authors[0]?.family?.toLowerCase().replace(/[^a-z]/g, '') ?? 'ref'
  const key = `${fam}${ref.year ?? ''}`
  const typ = ref.type === 'book' ? 'book' : ref.type === 'webpage' ? 'misc' : 'article'
  const fields: [string, string | undefined][] = [
    ['author', ref.authors.map(fullName).join(' and ') || undefined],
    ['title', ref.title],
    ['journal', ref.container],
    ['year', ref.year ? `${ref.year}` : undefined],
    ['volume', ref.volume],
    ['number', ref.issue],
    ['pages', ref.pages],
    ['publisher', ref.publisher],
    ['doi', ref.doi],
    ['url', ref.url],
  ]
  const body = fields
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${k} = {${v}}`)
    .join(',\n')
  return `@${typ}{${key},\n${body}\n}`
}

// --- builders ---------------------------------------------------------------

function parseAuthorString(s: string): Author[] {
  // "Jane Smith, John Doe, et al." → [{given,family}, …]
  return s
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^et al\.?$/i.test(p))
    .map((name) => {
      const parts = name.split(/\s+/)
      if (parts.length === 1) return { family: parts[0] }
      return { given: parts.slice(0, -1).join(' '), family: parts[parts.length - 1] }
    })
}

export function fromFoundSource(s: FoundSource): Reference {
  return {
    id: crypto.randomUUID(),
    type: s.container ? 'article-journal' : 'webpage',
    title: s.title.replace(/\.$/, ''),
    authors: parseAuthorString(s.authors),
    year: s.year,
    container: s.container,
    doi: s.doi,
    url: s.url || undefined,
  }
}

interface CrossrefWork {
  title?: string[]
  author?: { given?: string; family?: string }[]
  issued?: { 'date-parts'?: number[][] }
  'container-title'?: string[]
  volume?: string
  issue?: string
  page?: string
  publisher?: string
  DOI?: string
  URL?: string
}

/** Fetch a full reference from a DOI via Crossref (free, polite mailto). */
export async function fetchByDoi(doi: string, signal?: AbortSignal): Promise<Reference> {
  const clean = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}?mailto=pluma@example.com`, { signal })
  if (!res.ok) throw new Error('DOI not found')
  const w = ((await res.json()) as { message?: CrossrefWork }).message
  if (!w) throw new Error('DOI not found')
  return {
    id: crypto.randomUUID(),
    type: w['container-title']?.[0] ? 'article-journal' : 'report',
    title: w.title?.[0] ?? 'Untitled',
    authors: (w.author ?? []).map((a) => ({ given: a.given, family: a.family ?? '' })).filter((a) => a.family),
    year: w.issued?.['date-parts']?.[0]?.[0] ?? null,
    container: w['container-title']?.[0],
    volume: w.volume,
    issue: w.issue,
    pages: w.page,
    publisher: w.publisher,
    doi: w.DOI ?? clean,
    url: w.URL,
  }
}
