// Writing goals: who is this for, how formal, what domain/intent. Goals don't
// rewrite any rule — they sit on top of the existing rule engine as a *policy*
// that suppresses or re-weights whole rule families by ruleId. One source of
// truth ("WritingContext") read by the checker, the analytics, and (later) the
// AI prompt builder, so the whole product reacts to the same intent.

import type { Category, Dialect } from './types'

export interface WritingGoals {
  audience: 'general' | 'knowledgeable' | 'expert'
  formality: 'informal' | 'neutral' | 'formal'
  domain: 'general' | 'academic' | 'business' | 'creative' | 'email'
  intent: 'inform' | 'describe' | 'convince' | 'tell-story'
}

export const DEFAULT_GOALS: WritingGoals = {
  audience: 'general',
  formality: 'neutral',
  domain: 'general',
  intent: 'inform',
}

/** Per-document context shared by every "smart" subsystem. */
export interface WritingContext {
  goals: WritingGoals
  dialect: Dialect
}

export interface GoalPolicy {
  /** drop this rule's hits entirely for the chosen goals */
  suppress(ruleId: string): boolean
  /** relative importance, used to decide which alerts survive the cap */
  weightFor(ruleId: string, category: Category): number
}

type Family =
  | 'passive'
  | 'intensifier'
  | 'wordy'
  | 'hedging'
  | 'longsentence'
  | 'spelling'
  | 'other'

function familyOf(ruleId: string): Family {
  if (ruleId.endsWith('.spelling')) return 'spelling'
  if (/passive/.test(ruleId)) return 'passive'
  if (/intensifier/.test(ruleId)) return 'intensifier'
  if (/wordy/.test(ruleId)) return 'wordy'
  if (/hedg/.test(ruleId)) return 'hedging'
  if (/long-sentence/.test(ruleId)) return 'longsentence'
  return 'other' // all the grammar/spelling correctness rules — never touched
}

/**
 * Builds the policy for a set of goals. Only *clarity/style* families are ever
 * suppressed or re-weighted; correctness (grammar, spelling) is untouchable.
 */
export function policyFor(goals: WritingGoals): GoalPolicy {
  return {
    suppress(ruleId: string): boolean {
      const fam = familyOf(ruleId)
      if (fam === 'spelling' || fam === 'other') return false
      // Creative / storytelling deliberately uses passive voice, long sentences,
      // and emphatic intensifiers — don't nag about them.
      if (goals.domain === 'creative' && (fam === 'passive' || fam === 'longsentence' || fam === 'intensifier')) return true
      if (goals.intent === 'tell-story' && (fam === 'passive' || fam === 'longsentence')) return true
      // Casual writing: hedging ("I think", "sort of") is fine.
      if (goals.formality === 'informal' && fam === 'hedging') return true
      // Expert readers tolerate longer, denser sentences.
      if (goals.audience === 'expert' && fam === 'longsentence') return true
      return false
    },
    weightFor(ruleId: string, category: Category): number {
      // Correctness always outranks style when the alert cap bites.
      if (category === 'correctness') return 3
      const fam = familyOf(ruleId)
      let w = 1
      // Concision-focused domains care more about wordiness and weak intensifiers.
      if ((goals.domain === 'academic' || goals.domain === 'business' || goals.domain === 'email') &&
        (fam === 'wordy' || fam === 'intensifier')) w += 1
      // Formal writing leans on tighter phrasing and fewer hedges.
      if (goals.formality === 'formal' && (fam === 'hedging' || fam === 'wordy')) w += 1
      // Persuasive writing wants confident, hedge-free prose.
      if (goals.intent === 'convince' && fam === 'hedging') w += 1
      return w
    },
  }
}

export const GOAL_LABELS = {
  audience: { general: 'General', knowledgeable: 'Knowledgeable', expert: 'Expert' },
  formality: { informal: 'Informal', neutral: 'Neutral', formal: 'Formal' },
  domain: { general: 'General', academic: 'Academic', business: 'Business', creative: 'Creative', email: 'Email' },
  intent: { inform: 'Inform / explain', describe: 'Describe', convince: 'Convince', 'tell-story': 'Tell a story' },
} as const
