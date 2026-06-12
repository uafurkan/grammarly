// Shared alert shape, modeled on the ranged-alert pattern documented in
// GRAMMARLY_ANALYSIS.md §3. Tier-1 (local rules) emits these today; the same
// interface is what a future server-side GEC/LLM tier will return.

export type Category = 'correctness' | 'clarity'

export type Dialect = 'en-US' | 'en-GB' | 'es-ES' | 'es-419'

export type Lang = 'en' | 'es'

export interface Alert {
  id: string
  /** plain-text offsets into the checked text */
  begin: number
  end: number
  /** the flagged text */
  text: string
  /** suggested fixes; may be empty for advice-only alerts */
  replacements: string[]
  category: Category
  ruleId: string
  /** short human explanation shown on the card */
  message: string
}

export interface RuleMatch {
  begin: number
  end: number
  text: string
  replacements: string[]
  category: Category
  message: string
}

export interface Rule {
  id: string
  /** which dialects the rule applies to */
  dialects: Dialect[]
  apply(text: string, dialect: Dialect): RuleMatch[]
}

export const langOf = (d: Dialect): Lang => (d.startsWith('en') ? 'en' : 'es')

export const DIALECT_LABELS: Record<Dialect, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'es-ES': 'Español (España)',
  'es-419': 'Español (Latinoamérica)',
}
