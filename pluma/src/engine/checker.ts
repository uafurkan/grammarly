// Tier-1 checker: deterministic rules, runs locally in well under a frame for
// typical documents. Tier-2/3 (server GEC models, LLM rewrites) plug in behind
// the same Alert interface — see GRAMMARLY_ANALYSIS.md §6.

import type { Alert, Dialect } from './types'
import { langOf } from './types'
import { EN_RULES } from './rules/en'
import { ES_RULES } from './rules/es'

const MAX_ALERTS = 200

let counter = 0

export function check(text: string, dialect: Dialect): Alert[] {
  const rules = (langOf(dialect) === 'en' ? EN_RULES : ES_RULES).filter((r) =>
    r.dialects.includes(dialect),
  )

  const alerts: Alert[] = []
  for (const rule of rules) {
    for (const m of rule.apply(text, dialect)) {
      alerts.push({ id: `a${++counter}`, ruleId: rule.id, ...m })
    }
  }

  // Overlap resolution: shortest alerts win, so a sentence-wide alert (e.g.
  // "missing ¿") never swallows the word-level fixes inside it — those surface
  // first, and the wide alert reappears once they're resolved.
  const bySize = [...alerts].sort((a, b) => a.end - a.begin - (b.end - b.begin))
  const kept: Alert[] = []
  for (const a of bySize) {
    if (kept.some((k) => a.begin < k.end && k.begin < a.end)) continue
    kept.push(a)
    if (kept.length >= MAX_ALERTS) break
  }

  return kept.sort((a, b) => a.begin - b.begin || a.end - b.end)
}

/** Stable fingerprint so a dismissed alert stays dismissed across re-checks. */
export function fingerprint(a: Alert): string {
  return `${a.ruleId}:${a.text}`
}
