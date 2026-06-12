import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export interface Correction {
  pageIndex: number
  /** PDF user-space position of the original word */
  pdfX: number
  pdfY: number
  pdfFontSize: number
  /** original word width in PDF points (approx, for the white-out box) */
  pdfWidth: number
  replacement: string
}

/**
 * Writes accepted corrections back onto the *original* PDF bytes: a white box
 * over the original word, the replacement drawn at the same position and size.
 * Every other pixel of the page is the untouched original — no re-layout, no
 * fidelity loss.
 */
export async function exportCorrectedPdf(
  original: ArrayBuffer,
  corrections: Correction[],
  title: string,
): Promise<void> {
  const pdf = await PDFDocument.load(original)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pages = pdf.getPages()

  for (const c of corrections) {
    const page = pages[c.pageIndex]
    if (!page) continue
    const size = c.pdfFontSize || 11
    const boxW = Math.max(c.pdfWidth, font.widthOfTextAtSize(c.replacement, size)) + 1

    // white-out the original glyphs
    page.drawRectangle({
      x: c.pdfX - 0.5,
      y: c.pdfY - size * 0.22,
      width: boxW,
      height: size * 1.1,
      color: rgb(1, 1, 1),
    })
    // draw the corrected word at the same baseline
    page.drawText(c.replacement, {
      x: c.pdfX,
      y: c.pdfY,
      size,
      font,
      color: rgb(0, 0, 0),
    })
  }

  const bytes = await pdf.save()
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title || 'document'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
