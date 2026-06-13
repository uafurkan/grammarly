// Generates the small PNG icons the Office add-in manifest requires. Hand-rolls
// a minimal valid PNG (solid Pluma-green with a paler quill stroke) so we don't
// pull in an image dependency. Output goes to public/ and ships with the site.

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public')
mkdirSync(outDir, { recursive: true })

// serve the add-in manifest from the site so the install page can offer it as a
// download — single source of truth in office-addin/manifest.xml
copyFileSync(join(here, '..', 'office-addin', 'manifest.xml'), join(outDir, 'pluma-word.xml'))

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

// brand colors
const BG = [47, 93, 58] // #2f5d3a
const INK = [253, 252, 248] // #fdfcf8

function png(size) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      // a simple diagonal quill stroke across the green tile
      const onStroke = Math.abs((x - y) - size * 0.05) < size * 0.09 && x > size * 0.2 && x < size * 0.8
      const [r, g, b] = onStroke ? INK : BG
      const o = y * stride + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

for (const size of [16, 32, 64, 80, 128]) {
  writeFileSync(join(outDir, `icon-${size}.png`), png(size))
}
console.log('[office] wrote icon-{16,32,64,80,128}.png')
