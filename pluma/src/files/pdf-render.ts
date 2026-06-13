import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type FontClass = 'serif' | 'sans' | 'mono'

export interface TextItemBox {
  str: string
  /** screen-space rect (CSS px at the given render scale) */
  left: number
  top: number
  width: number
  height: number
  fontSize: number
  /** PDF user-space coords (origin bottom-left) for faithful export */
  pdfX: number
  pdfY: number
  pdfFontSize: number
  pdfWidth: number
  /** coarse font family of the original glyphs, for faithful in-place fixes */
  fontClass: FontClass
  bold: boolean
  italic: boolean
}

/** Classifies a PDF font name/family into serif / sans / mono. */
function classifyFont(name: string): FontClass {
  const n = name.toLowerCase()
  if (/mono|courier|consol|menlo|typewriter/.test(n)) return 'mono'
  if (/serif|times|georgia|garamond|minion|cambria|book antiqua|palatino|roman/.test(n)) return 'serif'
  if (/sans|arial|helvetica|calibri|verdana|tahoma|segoe|roboto|grotesk|gothic/.test(n)) return 'sans'
  // many embedded thesis fonts are serif (Times-like) — default to serif
  return 'serif'
}

export interface RenderedPage {
  pageIndex: number
  width: number
  height: number
  canvas: HTMLCanvasElement
  items: TextItemBox[]
  /** page text = items joined by single spaces; offsets[i] = start of item i */
  text: string
  offsets: number[]
}

export async function loadPdf(data: ArrayBuffer): Promise<pdfjs.PDFDocumentProxy> {
  return pdfjs.getDocument({ data }).promise
}

/** Renders one page to a canvas and extracts positioned text items. */
export async function renderPage(
  doc: pdfjs.PDFDocumentProxy,
  pageIndex: number,
  scale: number,
): Promise<RenderedPage> {
  const page = await doc.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.floor(viewport.width * ratio)
  canvas.height = Math.floor(viewport.height * ratio)
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  const ctx = canvas.getContext('2d')!
  ctx.scale(ratio, ratio)
  await page.render({ canvas, canvasContext: ctx, viewport }).promise

  let rawContent: { items?: unknown[]; styles?: Record<string, { fontFamily?: string }> } = { items: [] }
  try {
    rawContent = (await page.getTextContent()) as typeof rawContent
  } catch {
    // some PDFs have malformed content streams — treat as image-only
  }
  const styles = rawContent.styles ?? {}
  const items: TextItemBox[] = []
  let text = ''
  const offsets: number[] = []

  for (const item of (rawContent.items ?? [])) {
    try {
      if (typeof item !== 'object' || item === null) continue
      const it = item as Record<string, unknown>
      if (typeof it.str !== 'string' || !it.str) continue
      const transform = Array.isArray(it.transform) ? (it.transform as number[]) : null
      if (!transform || transform.length < 6) continue

      // manual 2-D matrix multiply so we don't depend on Util.transform API stability
      const vt = viewport.transform as number[]
      const t = [
        vt[0] * transform[0] + vt[2] * transform[1],
        vt[1] * transform[0] + vt[3] * transform[1],
        vt[0] * transform[2] + vt[2] * transform[3],
        vt[1] * transform[2] + vt[3] * transform[3],
        vt[0] * transform[4] + vt[2] * transform[5] + vt[4],
        vt[1] * transform[4] + vt[3] * transform[5] + vt[5],
      ]
      const fontSize = Math.hypot(t[2], t[3])
      const width = (typeof it.width === 'number' ? it.width : 0) * scale
      const left = t[4]
      const top = t[5] - fontSize
      const pdfFontSize = Math.hypot(transform[2], transform[3])

      // font family + weight/style from the page's style table
      const fontName = typeof it.fontName === 'string' ? it.fontName : ''
      const family = styles[fontName]?.fontFamily ?? fontName
      const probe = `${fontName} ${family}`.toLowerCase()

      if (text) text += ' '
      offsets.push(text.length)
      text += it.str
      items.push({
        str: it.str,
        left,
        top,
        width,
        height: fontSize * 1.2,
        fontSize,
        pdfX: transform[4],
        pdfY: transform[5],
        pdfFontSize,
        pdfWidth: typeof it.width === 'number' ? it.width : 0,
        fontClass: classifyFont(probe),
        bold: /bold|black|heavy|semibold|[-,]bd\b/.test(probe),
        italic: /italic|oblique|[-,]it\b/.test(probe),
      })
    } catch {
      // skip unparseable items; the page still renders from canvas
    }
  }

  return {
    pageIndex,
    width: viewport.width,
    height: viewport.height,
    canvas,
    items,
    text,
    offsets,
  }
}
