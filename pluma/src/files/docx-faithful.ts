// Faithful DOCX → HTML converter. Mammoth is "semantic" and deliberately drops
// alignment, colors, font sizes, highlights and images' sizing — which is why
// imported documents looked nothing like Word. This parser reads the OOXML
// directly (document.xml + rels + numbering + media) and emits HTML that the
// TipTap extension set (table, image, link, color, highlight, font-size,
// font-family, sub/superscript, text-align) can represent losslessly.

import JSZip from 'jszip'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'

// Word's highlight color names → CSS
const HIGHLIGHTS: Record<string, string> = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff',
  blue: '#0000ff', red: '#ff0000', darkBlue: '#00008b', darkCyan: '#008b8b',
  darkGreen: '#006400', darkMagenta: '#8b008b', darkRed: '#8b0000',
  darkYellow: '#808000', darkGray: '#a9a9a9', lightGray: '#d3d3d3', black: '#000000',
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml',
}

interface NumberingInfo {
  // numId → ilvl → 'bullet' | 'ordered'
  [numId: string]: Record<string, 'bullet' | 'ordered'>
}

interface Ctx {
  rels: Record<string, string>
  numbering: NumberingInfo
  headingStyles: Record<string, number> // styleId → level
  media: Record<string, string>         // zip path → data URL
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function wChild(el: Element, name: string): Element | null {
  for (const c of Array.from(el.children)) {
    if (c.localName === name) return c
  }
  return null
}

function wChildren(el: Element, name: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === name)
}

function wVal(el: Element | null): string | null {
  return el?.getAttributeNS(W, 'val') ?? el?.getAttribute('w:val') ?? el?.getAttribute('val') ?? null
}

export async function docxToFaithfulHtml(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const docXml = await zip.file('word/document.xml')?.async('text')
  if (!docXml) throw new Error('document.xml missing')

  const parser = new DOMParser()
  const doc = parser.parseFromString(docXml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('document.xml unparseable')

  const ctx: Ctx = {
    rels: await parseRels(zip),
    numbering: await parseNumbering(zip, parser),
    headingStyles: await parseStyles(zip, parser),
    media: {},
  }
  await loadMedia(zip, ctx)

  const body = doc.getElementsByTagNameNS(W, 'body')[0] ?? doc.documentElement
  return convertBlocks(Array.from(body.children), ctx)
}

async function parseRels(zip: JSZip): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const xml = await zip.file('word/_rels/document.xml.rels')?.async('text')
  if (!xml) return out
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
    const id = rel.getAttribute('Id')
    const target = rel.getAttribute('Target')
    if (id && target) out[id] = target
  }
  return out
}

async function parseNumbering(zip: JSZip, parser: DOMParser): Promise<NumberingInfo> {
  const out: NumberingInfo = {}
  const xml = await zip.file('word/numbering.xml')?.async('text')
  if (!xml) return out
  const doc = parser.parseFromString(xml, 'application/xml')

  const abstract: Record<string, Record<string, 'bullet' | 'ordered'>> = {}
  for (const an of Array.from(doc.getElementsByTagNameNS(W, 'abstractNum'))) {
    const aid = an.getAttributeNS(W, 'abstractNumId') ?? an.getAttribute('w:abstractNumId')
    if (!aid) continue
    const levels: Record<string, 'bullet' | 'ordered'> = {}
    for (const lvl of wChildren(an, 'lvl')) {
      const ilvl = lvl.getAttributeNS(W, 'ilvl') ?? lvl.getAttribute('w:ilvl') ?? '0'
      const fmt = wVal(wChild(lvl, 'numFmt'))
      levels[ilvl] = fmt === 'bullet' ? 'bullet' : 'ordered'
    }
    abstract[aid] = levels
  }
  for (const num of Array.from(doc.getElementsByTagNameNS(W, 'num'))) {
    const nid = num.getAttributeNS(W, 'numId') ?? num.getAttribute('w:numId')
    const aid = wVal(wChild(num, 'abstractNumId'))
    if (nid && aid && abstract[aid]) out[nid] = abstract[aid]
  }
  return out
}

async function parseStyles(zip: JSZip, parser: DOMParser): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  const xml = await zip.file('word/styles.xml')?.async('text')
  if (!xml) return out
  const doc = parser.parseFromString(xml, 'application/xml')
  for (const st of Array.from(doc.getElementsByTagNameNS(W, 'style'))) {
    const id = st.getAttributeNS(W, 'styleId') ?? st.getAttribute('w:styleId')
    if (!id) continue
    const name = wVal(wChild(st, 'name')) ?? id
    const m = /^heading\s*(\d)$/i.exec(name) ?? /^Heading(\d)$/.exec(id)
    if (m) out[id] = Math.min(6, parseInt(m[1], 10))
  }
  return out
}

async function loadMedia(zip: JSZip, ctx: Ctx) {
  const files = Object.keys(zip.files).filter((p) => p.startsWith('word/media/'))
  for (const path of files) {
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    const mime = MIME[ext]
    if (!mime) continue // emf/wmf etc. can't render in a browser
    const b64 = await zip.file(path)!.async('base64')
    ctx.media[path] = `data:${mime};base64,${b64}`
  }
}

// ---------------------------------------------------------------------------
// Block conversion (paragraphs, tables, lists)
// ---------------------------------------------------------------------------

interface ListState { type: 'ul' | 'ol'; ilvl: number }

function convertBlocks(blocks: Element[], ctx: Ctx): string {
  let html = ''
  const listStack: ListState[] = []

  const closeListsTo = (depth: number) => {
    while (listStack.length > depth) {
      const l = listStack.pop()!
      html += `</li></${l.type}>`
    }
  }

  for (const block of blocks) {
    if (block.localName === 'tbl') {
      closeListsTo(0)
      html += convertTable(block, ctx)
      continue
    }
    if (block.localName !== 'p') continue

    const pPr = wChild(block, 'pPr')
    const numPr = pPr ? wChild(pPr, 'numPr') : null

    if (numPr) {
      const numId = wVal(wChild(numPr, 'numId')) ?? ''
      const ilvl = parseInt(wVal(wChild(numPr, 'ilvl')) ?? '0', 10)
      const fmt = ctx.numbering[numId]?.[String(ilvl)] ?? 'bullet'
      const type: 'ul' | 'ol' = fmt === 'bullet' ? 'ul' : 'ol'

      // pop deeper levels
      while (listStack.length > 0 && listStack[listStack.length - 1].ilvl > ilvl) {
        const l = listStack.pop()!
        html += `</li></${l.type}>`
      }
      const top = listStack[listStack.length - 1]
      if (top && top.ilvl === ilvl) {
        if (top.type === type) {
          html += `</li><li>`
        } else {
          listStack.pop()
          html += `</li></${top.type}><${type}><li>`
          listStack.push({ type, ilvl })
        }
      } else {
        html += `<${type}><li>`
        listStack.push({ type, ilvl })
      }
      html += `<p>${convertParagraphInner(block, ctx)}</p>`
      continue
    }

    closeListsTo(0)
    html += convertParagraph(block, ctx)
  }
  closeListsTo(0)
  return html || '<p></p>'
}

function paragraphStyle(pPr: Element | null): string {
  if (!pPr) return ''
  const styles: string[] = []
  const jc = wVal(wChild(pPr, 'jc'))
  if (jc === 'center') styles.push('text-align: center')
  else if (jc === 'right' || jc === 'end') styles.push('text-align: right')
  else if (jc === 'both' || jc === 'distribute') styles.push('text-align: justify')
  return styles.length ? ` style="${styles.join('; ')}"` : ''
}

function convertParagraph(p: Element, ctx: Ctx): string {
  const pPr = wChild(p, 'pPr')
  const inner = convertParagraphInner(p, ctx)
  const styleId = pPr ? wVal(wChild(pPr, 'pStyle')) : null
  const level = styleId ? ctx.headingStyles[styleId] : undefined
  const styleAttr = paragraphStyle(pPr)
  if (level) return `<h${level}${styleAttr}>${inner}</h${level}>`
  return `<p${styleAttr}>${inner}</p>`
}

function convertParagraphInner(p: Element, ctx: Ctx): string {
  let html = ''
  for (const child of Array.from(p.children)) {
    if (child.localName === 'r') html += convertRun(child, ctx)
    else if (child.localName === 'hyperlink') html += convertHyperlink(child, ctx)
    else if (child.localName === 'smartTag' || child.localName === 'ins') {
      // unwrap containers that hold runs
      for (const r of wChildren(child, 'r')) html += convertRun(r, ctx)
    }
  }
  return html
}

function convertHyperlink(h: Element, ctx: Ctx): string {
  const rid = h.getAttributeNS(R, 'id') ?? h.getAttribute('r:id')
  const href = rid ? ctx.rels[rid] : null
  let inner = ''
  for (const r of wChildren(h, 'r')) inner += convertRun(r, ctx)
  if (!href) return inner
  return `<a href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>`
}

// ---------------------------------------------------------------------------
// Run conversion (formatting + text + images)
// ---------------------------------------------------------------------------

function convertRun(r: Element, ctx: Ctx): string {
  const rPr = wChild(r, 'rPr')

  // collect the run's text + breaks + images
  let content = ''
  for (const child of Array.from(r.children)) {
    switch (child.localName) {
      case 't':
        content += esc(child.textContent ?? '')
        break
      case 'br':
        content += '<br>'
        break
      case 'tab':
        content += '&nbsp;&nbsp;&nbsp;&nbsp;'
        break
      case 'noBreakHyphen':
        content += '-'
        break
      case 'drawing':
        content += convertDrawing(child, ctx)
        break
      case 'pict':
        content += convertPict(child, ctx)
        break
    }
  }
  if (!content) return ''

  if (!rPr) return content

  const on = (name: string) => {
    const el = wChild(rPr, name)
    if (!el) return false
    const v = wVal(el)
    return v === null || (v !== '0' && v !== 'false' && v !== 'none')
  }

  // inline span styles
  const spanStyles: string[] = []
  const color = wVal(wChild(rPr, 'color'))
  if (color && color !== 'auto' && /^[0-9a-fA-F]{6}$/.test(color)) spanStyles.push(`color: #${color}`)
  const sz = wVal(wChild(rPr, 'sz'))
  if (sz) {
    const pt = parseInt(sz, 10) / 2
    if (pt > 0 && pt !== 11 && pt !== 12) spanStyles.push(`font-size: ${pt}pt`)
  }
  const fonts = wChild(rPr, 'rFonts')
  const family =
    fonts?.getAttributeNS(W, 'ascii') ?? fonts?.getAttribute('w:ascii') ??
    fonts?.getAttributeNS(W, 'hAnsi') ?? fonts?.getAttribute('w:hAnsi')
  if (family && !/^(Calibri|Cambria)$/i.test(family)) spanStyles.push(`font-family: ${family}`)

  let out = content
  const highlight = wVal(wChild(rPr, 'highlight'))
  if (highlight && HIGHLIGHTS[highlight]) {
    out = `<mark data-color="${HIGHLIGHTS[highlight]}" style="background-color: ${HIGHLIGHTS[highlight]}">${out}</mark>`
  } else {
    const shd = wChild(rPr, 'shd')
    const fill = shd?.getAttributeNS(W, 'fill') ?? shd?.getAttribute('w:fill')
    if (fill && fill !== 'auto' && /^[0-9a-fA-F]{6}$/.test(fill)) {
      out = `<mark data-color="#${fill}" style="background-color: #${fill}">${out}</mark>`
    }
  }
  if (spanStyles.length) out = `<span style="${spanStyles.join('; ')}">${out}</span>`

  const vert = wVal(wChild(rPr, 'vertAlign'))
  if (vert === 'superscript') out = `<sup>${out}</sup>`
  else if (vert === 'subscript') out = `<sub>${out}</sub>`
  if (on('strike') || on('dstrike')) out = `<s>${out}</s>`
  if (on('u')) out = `<u>${out}</u>`
  if (on('i') || on('iCs')) out = `<em>${out}</em>`
  if (on('b') || on('bCs')) out = `<strong>${out}</strong>`
  return out
}

function mediaUrl(target: string, ctx: Ctx): string | null {
  const clean = target.replace(/^\//, '')
  return ctx.media[`word/${clean}`] ?? ctx.media[clean] ?? null
}

function convertDrawing(d: Element, ctx: Ctx): string {
  const blips = d.getElementsByTagNameNS(A, 'blip')
  if (!blips.length) return ''
  const rid = blips[0].getAttributeNS(R, 'embed') ?? blips[0].getAttribute('r:embed')
  if (!rid || !ctx.rels[rid]) return ''
  const url = mediaUrl(ctx.rels[rid], ctx)
  if (!url) return ''
  // EMU → px (1px = 9525 EMU)
  let dims = ''
  const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
  const ext = d.getElementsByTagNameNS(WP, 'extent')[0] ?? d.getElementsByTagName('wp:extent')[0]
  if (ext) {
    const cx = parseInt(ext.getAttribute('cx') ?? '0', 10)
    const cy = parseInt(ext.getAttribute('cy') ?? '0', 10)
    if (cx > 0 && cy > 0) dims = ` width="${Math.round(cx / 9525)}" height="${Math.round(cy / 9525)}"`
  }
  return `<img src="${url}"${dims}>`
}

function convertPict(p: Element, ctx: Ctx): string {
  // legacy VML images: v:imagedata r:id
  for (const el of Array.from(p.getElementsByTagName('*'))) {
    if (el.localName === 'imagedata') {
      const rid = el.getAttributeNS(R, 'id') ?? el.getAttribute('r:id')
      if (rid && ctx.rels[rid]) {
        const url = mediaUrl(ctx.rels[rid], ctx)
        if (url) return `<img src="${url}">`
      }
    }
  }
  return ''
}

// ---------------------------------------------------------------------------
// Tables (with gridSpan + vMerge handling)
// ---------------------------------------------------------------------------

interface CellInfo {
  el: Element
  colspan: number
  vmerge: 'restart' | 'continue' | null
  col: number      // starting grid column
  rowspan: number
}

function convertTable(tbl: Element, ctx: Ctx): string {
  const rows = wChildren(tbl, 'tr')
  const grid: CellInfo[][] = []

  for (const tr of rows) {
    const cells: CellInfo[] = []
    let col = 0
    for (const tc of wChildren(tr, 'tc')) {
      const tcPr = wChild(tc, 'tcPr')
      const colspan = parseInt(wVal(tcPr ? wChild(tcPr, 'gridSpan') : null) ?? '1', 10) || 1
      const vEl = tcPr ? wChild(tcPr, 'vMerge') : null
      const vmerge: CellInfo['vmerge'] = vEl ? ((wVal(vEl) ?? 'continue') === 'restart' ? 'restart' : 'continue') : null
      cells.push({ el: tc, colspan, vmerge, col, rowspan: 1 })
      col += colspan
    }
    grid.push(cells)
  }

  // compute rowspans for vMerge restarts
  for (let ri = 0; ri < grid.length; ri++) {
    for (const cell of grid[ri]) {
      if (cell.vmerge !== 'restart') continue
      let span = 1
      for (let rj = ri + 1; rj < grid.length; rj++) {
        const below = grid[rj].find((c) => c.col === cell.col && c.vmerge === 'continue')
        if (!below) break
        span++
      }
      cell.rowspan = span
    }
  }

  let html = '<table><tbody>'
  for (const row of grid) {
    html += '<tr>'
    for (const cell of row) {
      if (cell.vmerge === 'continue') continue
      const attrs =
        (cell.colspan > 1 ? ` colspan="${cell.colspan}"` : '') +
        (cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : '')
      const inner = convertBlocks(Array.from(cell.el.children).filter((c) => c.localName !== 'tcPr'), ctx)
      html += `<td${attrs}>${inner}</td>`
    }
    html += '</tr>'
  }
  html += '</tbody></table>'
  return html
}
