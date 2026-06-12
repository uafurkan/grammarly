// Quick smoke test for the Tier-1 engine: node --experimental-strip-types scripts/engine-smoke.ts
import { check } from '../src/engine/checker.ts'

const en = `i think she go to the university every day. He could of finished his thesis,
but he recieve a email about teh deadline. Your welcome to join. its a important topic.
The colour of the the results was unclear.  Two  spaces here.`

const es = `Tambien creo que la investigacion es dificil. Cuando llegas? Vosotros teneis razon.
Quiero saber ¿porque no viniste? La conclusion del analisis es es clara!`

for (const [dialect, text] of [['en-US', en], ['es-419', es]] as const) {
  console.log(`\n=== ${dialect} ===`)
  for (const a of check(text, dialect)) {
    console.log(
      `[${a.category}] "${a.text}" → ${a.replacements[0] ?? '(advice)'}  — ${a.message} (${a.ruleId})`,
    )
  }
}
