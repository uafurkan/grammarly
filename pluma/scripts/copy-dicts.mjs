// Copies the Hunspell .aff/.dic dictionaries out of the installed npm packages
// into public/dict so they are served as static assets and lazy-loaded by the
// spell-check worker. Runs automatically on `npm install` (postinstall) and
// before build, so Vercel always has them.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'public/dict')
mkdirSync(out, { recursive: true })

const MAP = {
  'en-US': 'dictionary-en',
  'en-GB': 'dictionary-en-gb',
  'es-ES': 'dictionary-es',
  'es-MX': 'dictionary-es-mx',
}

let copied = 0
for (const [name, pkg] of Object.entries(MAP)) {
  for (const ext of ['aff', 'dic']) {
    const src = resolve(root, 'node_modules', pkg, `index.${ext}`)
    if (!existsSync(src)) {
      console.warn(`[dict] missing ${src} — is ${pkg} installed?`)
      continue
    }
    copyFileSync(src, resolve(out, `${name}.${ext}`))
    copied++
  }
}
console.log(`[dict] copied ${copied} dictionary files into public/dict`)
