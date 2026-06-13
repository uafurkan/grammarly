/// <reference lib="webworker" />
// Runs the rule packs + dictionary spell-check off the main thread.

import type { Alert, Dialect, RuleMatch } from './types'
import { langOf } from './types'
import { runRules, resolveOverlaps } from './run'
import { policyFor, type WritingGoals } from './goals'
import { getSpeller } from './spell'
import { spellcheck } from './spellcheck'

interface Req {
  reqId: number
  text: string
  dialect: Dialect
  personal: string[]
  goals?: WritingGoals
}

let counter = 0

self.onmessage = async (e: MessageEvent<Req>) => {
  const { reqId, text, dialect, personal, goals } = e.data
  const policy = goals ? policyFor(goals) : undefined
  let alerts: Alert[] = []
  try {
    const ruleMatches: (RuleMatch & { ruleId: string })[] = runRules(text, dialect, policy)

    let spellMatches: (RuleMatch & { ruleId: string })[] = []
    try {
      const speller = await getSpeller(dialect)
      const lang = langOf(dialect)
      const personalSet = new Set(personal.map((w) => w.toLowerCase()))
      spellMatches = spellcheck(text, speller, personalSet, lang).map((m) => ({
        ...m,
        ruleId: `${lang}.spelling`,
      }))
    } catch {
      // dictionary unavailable → rules only
    }

    alerts = resolveOverlaps([...ruleMatches, ...spellMatches], policy)
  } catch {
    alerts = []
  }
  // re-key ids so they're unique per response
  alerts = alerts.map((a) => ({ ...a, id: `w${reqId}_${++counter}` }))
  ;(self as unknown as Worker).postMessage({ reqId, alerts })
}
