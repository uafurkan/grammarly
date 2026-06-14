// The extension reuses Pluma's exact engine — the same rules that run on the
// website and in the Word add-in. We import the pure core (runRules +
// resolveOverlaps + goal policy) directly, deliberately bypassing checker.ts so
// the Web-Worker dictionary path (which needs bundler/worker plumbing) is never
// pulled into the content-script bundle. Rules-only still covers grammar,
// punctuation, dialect, and the common-misspelling rules.

import { runRules, resolveOverlaps } from '../../pluma/src/engine/run'
import { policyFor, DEFAULT_GOALS, type WritingGoals } from '../../pluma/src/engine/goals'
import type { Alert, Dialect } from '../../pluma/src/engine/types'

export type { Alert, Dialect }
export { DIALECT_LABELS } from '../../pluma/src/engine/types'

export function check(text: string, dialect: Dialect, goals: WritingGoals = DEFAULT_GOALS): Alert[] {
  const policy = policyFor(goals)
  return resolveOverlaps(runRules(text, dialect, policy), policy)
}
