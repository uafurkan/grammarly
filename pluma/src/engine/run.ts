// Pure rule-running + overlap resolution. Imported by both the main-thread
// checker and the Web Worker, with no reference to Worker spawning, so the
// worker bundle never recursively pulls in itself.

import type { Alert, Dialect, RuleMatch } from './types'
import { langOf } from './types'
import { EN_RULES } from './rules/en'
import { ES_RULES } from './rules/es'

const MAX_ALERTS = 250

export type RuleHit = RuleMatch & { ruleId: string }

let counter = 0

export function runRules(text: string, dialect: Dialect): RuleHit[] {
  const rules = (langOf(dialect) === 'en' ? EN_RULES : ES_RULES).filter((r) =>
    r.dialects.includes(dialect),
  )
  const out: RuleHit[] = []
  for (const rule of rules) {
    for (const m of rule.apply(text, dialect)) out.push({ ...m, ruleId: rule.id })
  }
  return out
}

/**
 * Resolves overlapping matches (shortest wins) and assigns stable ids.
 */
export function resolveOverlaps(matches: RuleHit[]): Alert[] {
  const bySize = [...matches].sort((a, b) => a.end - a.begin - (b.end - b.begin))
  const kept: RuleHit[] = []
  for (const a of bySize) {
    if (kept.some((k) => a.begin < k.end && k.begin < a.end)) continue
    kept.push(a)
    if (kept.length >= MAX_ALERTS) break
  }
  return kept
    .sort((a, b) => a.begin - b.begin || a.end - b.end)
    .map((m) => ({ id: `a${++counter}`, ...m }))
}
