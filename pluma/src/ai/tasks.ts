// Provider-agnostic writing tasks built on the streaming `generate` primitive.
// Prompts are shaped by the document's WritingContext (goals + dialect) so the
// AI respects the same intent as the rest of the app.

import { generate, type ChatTurn } from './engine'
import type { WritingGoals } from '../engine/goals'
import type { Dialect } from '../engine/types'

export interface AiContext {
  goals: WritingGoals
  dialect: Dialect
}

export type RewriteMode = 'rewrite' | 'simplify' | 'shorten' | 'expand' | 'paraphrase' | 'summarize'
export type ToneTarget = 'formal' | 'friendly' | 'confident' | 'neutral' | 'academic'

const MODE_INSTRUCTION: Record<RewriteMode, string> = {
  rewrite: 'Rewrite the text below so it reads more clearly and naturally, keeping the original meaning.',
  simplify: 'Rewrite the text below in plainer, simpler language that is easier to read. Keep the meaning.',
  shorten: 'Make the text below more concise. Remove redundancy while keeping every key point.',
  expand: 'Expand the text below with a little more detail and explanation, in the same voice.',
  paraphrase: 'Paraphrase the text below using different wording, keeping the same meaning.',
  summarize: 'Summarize the key points of the text below in a few clear sentences.',
}

function contextLine(ctx: AiContext): string {
  const lang = ctx.dialect.startsWith('es') ? 'Spanish' : 'English'
  const bits = [
    `Write in ${lang} (${ctx.dialect}).`,
    `Audience: ${ctx.goals.audience}.`,
    `Formality: ${ctx.goals.formality}.`,
    `Domain: ${ctx.goals.domain}.`,
  ]
  return bits.join(' ')
}

const BASE_SYSTEM =
  'You are a careful writing assistant. You return only the revised text, with no preamble, no quotation marks, and no explanation unless explicitly asked.'

/** Streams a rewrite of `text` in the given mode; resolves with the full result. */
export async function rewrite(
  text: string,
  mode: RewriteMode,
  ctx: AiContext,
  onToken: (t: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const messages: ChatTurn[] = [
    { role: 'system', content: `${BASE_SYSTEM} ${contextLine(ctx)}` },
    { role: 'user', content: `${MODE_INSTRUCTION[mode]}\n\n"""${text}"""` },
  ]
  return stream(messages, onToken, signal, mode === 'summarize' ? 0.5 : 0.6)
}

/** Streams a tone-shifted version of `text`. */
export async function toneShift(
  text: string,
  target: ToneTarget,
  ctx: AiContext,
  onToken: (t: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const messages: ChatTurn[] = [
    { role: 'system', content: `${BASE_SYSTEM} ${contextLine(ctx)}` },
    { role: 'user', content: `Rewrite the text below in a more ${target} tone, keeping its meaning.\n\n"""${text}"""` },
  ]
  return stream(messages, onToken, signal, 0.7)
}

/** Streams a short plain-language explanation of why a fix helps. */
export async function explainFix(
  flagged: string,
  suggestion: string,
  message: string,
  onToken: (t: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const messages: ChatTurn[] = [
    { role: 'system', content: 'You are a friendly writing tutor. Explain briefly (1-2 sentences) and plainly.' },
    {
      role: 'user',
      content: `In a sentence, explain why changing "${flagged}" to "${suggestion}" is better. Note: ${message}`,
    },
  ]
  return stream(messages, onToken, signal, 0.4)
}

async function stream(
  messages: ChatTurn[],
  onToken: (t: string) => void,
  signal: AbortSignal | undefined,
  temperature: number,
): Promise<string> {
  let full = ''
  for await (const tok of generate(messages, { temperature, signal })) {
    full += tok
    onToken(tok)
  }
  return full.trim()
}
