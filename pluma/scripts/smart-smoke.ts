// Full engine smoke test (rules + dictionary), Node-side.
// Run: npx esbuild scripts/smart-smoke.ts --bundle --format=esm --platform=node --outfile=/tmp/s.mjs && node /tmp/s.mjs
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runRules, resolveOverlaps } from '../src/engine/run.ts'
import { createSpeller } from '../src/engine/spell.ts'
import { spellcheck } from '../src/engine/spellcheck.ts'
import { langOf, type Dialect } from '../src/engine/types.ts'

const DICT: Record<string, string> = { 'en-US': 'en-US', 'en-GB': 'en-GB', 'es-ES': 'es-ES', 'es-419': 'es-MX' }

function fullCheck(text: string, dialect: Dialect) {
  const rules = runRules(text, dialect)
  const base = resolve(process.cwd(), 'public/dict', DICT[dialect])
  const speller = createSpeller(readFileSync(`${base}.aff`, 'utf8'), readFileSync(`${base}.dic`, 'utf8'))
  const spell = spellcheck(text, speller, new Set(), langOf(dialect)).map((m) => ({ ...m, ruleId: `${langOf(dialect)}.spelling` }))
  return resolveOverlaps([...rules, ...spell])
}

const cases: [Dialect, string][] = [
  ['en-US', 'How ace yoi'],
  [
    'en-US',
    `I goed to the store yesterday and buyed some foods, but they was very expensiv and I don't knew why. Then I seen my friend and we was talking about many things what happened last week. He tell me that he don't likes his new job because the peoples there is rude. After that, we goes to a cafe and drinked two coffees. It were a nice day even if the weather were bad.`,
  ],
  ['es-419', 'Tambien fui al tienda y comi muncho. Vosotros teneis razon. La problema es dificil. Cuando llegas?'],
]

for (const [dialect, text] of cases) {
  console.log(`\n===== ${dialect} =====`)
  const alerts = fullCheck(text, dialect)
  console.log(`${alerts.length} issues`)
  for (const a of alerts) {
    console.log(`  [${a.ruleId}] "${a.text}" → ${a.replacements[0] ?? '(advice)'}`)
  }
}
