// OCR for scanned PDF pages (pages with no extractable text layer).
// Runs tesseract.js fully in the browser; each recognized line becomes a
// TextItemBox so the existing check → underline → fix → export pipeline
// works on scanned documents exactly like on digital ones.

import type { RenderedPage, TextItemBox } from './pdf-render'
import type { Dialect } from '../engine/types'

interface OcrBox { x0: number; y0: number; x1: number; y1: number }
interface OcrLine { text: string; confidence: number; bbox: OcrBox }

const MIN_CONFIDENCE = 40

let workerPromise: Promise<import('tesseract.js').Worker> | null = null
let workerLang = ''

async function getWorker(lang: string) {
  if (workerPromise && workerLang === lang) return workerPromise
  if (workerPromise) {
    const old = await workerPromise
    void old.terminate()
  }
  workerLang = lang
  workerPromise = (async () => {
    const { createWorker } = await import('tesseract.js')
    return createWorker(lang)
  })()
  return workerPromise
}

export function ocrLang(dialect: Dialect): string {
  return dialect.startsWith('es') ? 'spa' : 'eng'
}

/** True when a rendered page has no usable text layer (scanned page). */
export function needsOcr(page: RenderedPage): boolean {
  return page.text.replace(/\s+/g, '').length < 10
}

function collectLines(data: unknown): OcrLine[] {
  const d = data as {
    blocks?: { paragraphs?: { lines?: OcrLine[] }[] }[] | null
    lines?: OcrLine[]
  }
  if (Array.isArray(d.lines) && d.lines.length) return d.lines
  const out: OcrLine[] = []
  for (const b of d.blocks ?? []) {
    for (const p of b.paragraphs ?? []) {
      for (const l of p.lines ?? []) out.push(l)
    }
  }
  return out
}

/**
 * OCRs one rendered page in place: fills page.items / page.text / page.offsets
 * from the recognized lines. Returns true if any text was found.
 */
export async function ocrPage(page: RenderedPage, dialect: Dialect, scale: number): Promise<boolean> {
  const worker = await getWorker(ocrLang(dialect))
  const result = await worker.recognize(
    page.canvas,
    {},
    { blocks: true, text: true } as never,
  )
  const lines = collectLines(result.data)

  // canvas internal pixels → CSS px
  const ratio = page.canvas.width / page.width || 1

  const items: TextItemBox[] = []
  let text = ''
  const offsets: number[] = []

  for (const line of lines) {
    const str = (line.text ?? '').replace(/\s+/g, ' ').trim()
    if (!str || (line.confidence ?? 0) < MIN_CONFIDENCE) continue
    const left = line.bbox.x0 / ratio
    const top = line.bbox.y0 / ratio
    const width = (line.bbox.x1 - line.bbox.x0) / ratio
    const height = (line.bbox.y1 - line.bbox.y0) / ratio
    const baselineCss = top + height * 0.82

    if (text) text += ' '
    offsets.push(text.length)
    text += str
    items.push({
      str,
      left,
      top,
      width,
      height,
      fontSize: height * 0.85,
      pdfX: left / scale,
      pdfY: (page.height - baselineCss) / scale,
      pdfFontSize: (height * 0.85) / scale,
      pdfWidth: width / scale,
    })
  }

  page.items = items
  page.text = text
  page.offsets = offsets
  return items.length > 0
}

export async function releaseOcr() {
  if (!workerPromise) return
  const w = await workerPromise
  workerPromise = null
  workerLang = ''
  void w.terminate()
}
