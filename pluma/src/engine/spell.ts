import nspell from 'nspell'
import type { Nspell } from 'nspell'
import type { Dialect } from './types'

// Maps a UI dialect to the vendored Hunspell dictionary served from public/dict.
const DICT_FILE: Record<Dialect, string> = {
  'en-US': 'en-US',
  'en-GB': 'en-GB',
  'es-ES': 'es-ES',
  'es-419': 'es-MX',
}

// Academic / technical supplement so common scholarly vocabulary that some
// Hunspell builds miss is never flagged. Extend freely — this is the
// "academic dictionary" layer on top of the base ~50k-stem dictionaries.
const ACADEMIC_EXTRA = `dataset datasets metadata workflow workflows preprint preprints
runtime frontend backend dataset biomarker biomarkers genome genomic proteomic phenotype phenotypes
qualitative quantitative paradigm paradigms epistemology ontology heuristic heuristics stochastic
deliverable deliverables scalable scalability multimodal interdisciplinary sociocultural socioeconomic
neoliberal postcolonial dataset dataset analyses operationalize operationalise problematize contextualize
de la transversal cuantitativo cualitativo paradigma epistemología heurístico estocástico interdisciplinario
socioeconómico genoma genómico fenotipo metaanálisis operacionalizar contextualizar`
  .split(/\s+/)
  .filter((w) => w.length > 2)

const cache = new Map<Dialect, Promise<Nspell>>()

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`dict fetch failed: ${url} (${res.status})`)
  return res.text()
}

/** Lazily loads (and caches) a speller for a dialect. Fetches from public/dict. */
export function getSpeller(dialect: Dialect): Promise<Nspell> {
  let p = cache.get(dialect)
  if (!p) {
    const base = DICT_FILE[dialect]
    p = (async () => {
      const [aff, dic] = await Promise.all([
        fetchText(`/dict/${base}.aff`),
        fetchText(`/dict/${base}.dic`),
      ])
      const speller = nspell(aff, dic)
      for (const w of ACADEMIC_EXTRA) speller.add(w)
      return speller
    })()
    cache.set(dialect, p)
  }
  return p
}

/** Build a speller from already-loaded buffers (used by the Node smoke test). */
export function createSpeller(aff: string, dic: string): Nspell {
  const speller = nspell(aff, dic)
  for (const w of ACADEMIC_EXTRA) speller.add(w)
  return speller
}
