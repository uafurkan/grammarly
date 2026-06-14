// Builds the extension and zips a clean, store-/sideload-ready archive.
// Output: extension/pluma-extension.zip AND pluma/public/pluma-extension.zip
// (so the website can offer it as a download). Only ships what the browser
// needs — manifest, built dist/, popup, icons — never src/ or node_modules.
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'

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

const OUT = 'pluma-extension.zip'
rmSync(OUT, { force: true })
// zip the shippable pieces only
execFileSync('zip', ['-r', '-q', OUT, 'manifest.json', 'dist', 'popup', 'icons'])

mkdirSync('../pluma/public', { recursive: true })
copyFileSync(OUT, '../pluma/public/pluma-extension.zip')
console.log(`✓ packaged → extension/${OUT} and pluma/public/${OUT}`)
