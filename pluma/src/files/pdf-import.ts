// Use the *legacy* build: it self-polyfills Promise.withResolvers and other
// modern APIs, so PDFs open on older iOS Safari / Chrome too (the cause of
// "most PDFs fail" reports).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { ImportError, MAX_CHARS, MAX_FILE_BYTES, sizeError } from './docx-import'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface ImportedPdf {
  title: string
  html: string
  pages: number
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Extracts the text of a PDF into editable paragraphs. Layout, images and
 * exact line breaks are not preserved — the goal is to get the *writing*
 * into the checking pipeline, not to re-render the PDF.
 */
export async function importPdf(file: File): Promise<ImportedPdf> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportError(sizeError(file))
  }

  let doc: pdfjs.PDFDocumentProxy
  try {
    doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  } catch (err) {
    throw new ImportError(
      `Could not read this PDF${err instanceof Error && err.message ? ` (${err.message.slice(0, 80)})` : ''}. It may be password-protected or corrupted.`,
    )
  }

  const blocks: string[] = []
  let chars = 0

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()

    let pageText = ''
    for (const item of content.items) {
      if (!('str' in item)) continue
      pageText += item.str
      pageText += item.hasEOL ? '\n' : ''
    }

    // Heuristic paragraphing: a line that ends a sentence closes a paragraph;
    // otherwise the wrap was almost certainly just the PDF's line layout.
    const lines = pageText.split('\n')
    let para = ''
    const flush = () => {
      const t = para.trim()
      if (t) blocks.push(`<p>${escapeHtml(t)}</p>`)
      para = ''
    }
    for (const line of lines) {
      const t = line.trim()
      if (!t) {
        flush()
        continue
      }
      para += (para ? ' ' : '') + t
      if (/[.!?:）)]["”»']?$/.test(t)) flush()
    }
    flush()

    chars += pageText.length
    if (chars > MAX_CHARS) {
      throw new ImportError(
        `This PDF has more than ${MAX_CHARS.toLocaleString()} characters of text — that's past the limit.`,
      )
    }
  }

  if (blocks.length === 0) {
    throw new ImportError(
      'No selectable text found in this PDF — it may be a scan. OCR support is on the roadmap.',
    )
  }

  return {
    title: file.name.replace(/\.pdf$/i, ''),
    html: blocks.join(''),
    pages: doc.numPages,
  }
}
