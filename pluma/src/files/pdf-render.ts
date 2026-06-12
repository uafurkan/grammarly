import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

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

  const content = await page.getTextContent()
  const items: TextItemBox[] = []
  let text = ''
  const offsets: number[] = []

  for (const item of content.items) {
    if (!('str' in item) || !item.str) continue
    const t = pdfjs.Util.transform(viewport.transform, item.transform)
    const fontSize = Math.hypot(t[2], t[3])
    const width = item.width * scale
    const left = t[4]
    const top = t[5] - fontSize
    const pdfFontSize = Math.hypot(item.transform[2], item.transform[3])

    if (text) text += ' '
    offsets.push(text.length)
    text += item.str
    items.push({
      str: item.str,
      left,
      top,
      width,
      height: fontSize * 1.2,
      fontSize,
      pdfX: item.transform[4],
      pdfY: item.transform[5],
      pdfFontSize,
      pdfWidth: item.width,
    })
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
