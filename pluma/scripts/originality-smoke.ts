import { checkOriginality, scoreOriginality } from '../src/engine/originality.ts'

const source = {
  id: 's1',
  label: 'Smith 2021',
  text: `Climate change is driven primarily by the emission of greenhouse gases from
human activity. The burning of fossil fuels releases carbon dioxide into the
atmosphere, trapping heat and raising global temperatures over time.`,
}

const draft = `In my essay I argue the following. Climate change is driven primarily by the
emission of greenhouse gases from human activity. However, the release of carbon
dioxide from fossil fuels traps heat in the atmosphere and raises global
temperatures gradually. This is my own unrelated sentence about cats and dogs.`

const matches = checkOriginality(draft, [source])
for (const m of matches) {
  console.log(`[${m.kind} ${Math.round(m.similarity * 100)}% · ${m.sourceLabel}] "${m.text.slice(0, 70)}…"`)
}
console.log('score:', scoreOriginality(draft, matches))
