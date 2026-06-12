import type { Rule, RuleMatch, Dialect } from '../types'

/** Builds a regex rule. `build` returns the alert fields or null to skip a match. */
export function regexRule(
  id: string,
  dialects: Dialect[],
  pattern: RegExp,
  build: (m: RegExpExecArray) => Omit<RuleMatch, 'begin' | 'end' | 'text'> | null,
): Rule {
  return {
    id,
    dialects,
    apply(text) {
      const out: RuleMatch[] = []
      const re = new RegExp(pattern.source, pattern.flags)
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++
          continue
        }
        const built = build(m)
        if (built) out.push({ begin: m.index, end: m.index + m[0].length, text: m[0], ...built })
      }
      return out
    },
  }
}

/** Copies the capitalisation pattern of `source` onto `target`. */
export function matchCase(source: string, target: string): string {
  if (source === source.toUpperCase() && source.length > 1) return target.toUpperCase()
  if (source[0] === source[0].toUpperCase()) return target[0].toUpperCase() + target.slice(1)
  return target
}
