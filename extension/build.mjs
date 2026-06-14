// Bundles the content script (engine + DOM glue) into a single IIFE and copies
// the CSS. No framework, no worker — the rules engine is pure TypeScript.
import { build } from 'esbuild'
import { copyFileSync, mkdirSync } from 'node:fs'

mkdirSync('dist', { recursive: true })

await build({
  entryPoints: ['src/content.ts'],
  bundle: true,
  format: 'iife',
  target: ['chrome110', 'firefox110'],
  outfile: 'dist/content.js',
  legalComments: 'none',
  logLevel: 'info',
})

copyFileSync('src/content.css', 'dist/content.css')
console.log('✓ extension built → dist/')
