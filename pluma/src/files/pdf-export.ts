import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import type { FontClass } from './pdf-render'

export interface Correction {
  pageIndex: number
  /** PDF user-space position of the original word */
  pdfX: number
  pdfY: number
  pdfFontSize: number
  /** original word width in PDF points (approx, for the white-out box) */
  pdfWidth: number
  replacement: string
  /** original glyphs' font, so the fix blends in */
  fontClass?: FontClass
  bold?: boolean
  italic?: boolean
}

function standardFontFor(c: Correction): StandardFonts {
  const fc = c.fontClass ?? 'serif'
  if (fc === 'mono') {
    return c.bold && c.italic ? StandardFonts.CourierBoldOblique
      : c.bold ? StandardFonts.CourierBold
      : c.italic ? StandardFonts.CourierOblique
      : StandardFonts.Courier
  }
  if (fc === 'sans') {
    return c.bold && c.italic ? StandardFonts.HelveticaBoldOblique
      : c.bold ? StandardFonts.HelveticaBold
      : c.italic ? StandardFonts.HelveticaOblique
      : StandardFonts.Helvetica
  }
  return c.bold && c.italic ? StandardFonts.TimesRomanBoldItalic
    : c.bold ? StandardFonts.TimesRomanBold
    : c.italic ? StandardFonts.TimesRomanItalic
    : StandardFonts.TimesRoman
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
  const pages = pdf.getPages()
  // embed each needed standard font once
  const fontCache = new Map<StandardFonts, PDFFont>()
  const fontFor = async (sf: StandardFonts): Promise<PDFFont> => {
    let f = fontCache.get(sf)
    if (!f) {
      f = await pdf.embedFont(sf)
      fontCache.set(sf, f)
    }
    return f
  }

  for (const c of corrections) {
    const page = pages[c.pageIndex]
    if (!page) continue
    const size = c.pdfFontSize || 11
    const font = await fontFor(standardFontFor(c))
    const boxW = Math.max(c.pdfWidth, font.widthOfTextAtSize(c.replacement, size)) + 1

    // white-out the original glyphs
    page.drawRectangle({
      x: c.pdfX - 0.5,
      y: c.pdfY - size * 0.22,
      width: boxW,
      height: size * 1.1,
      color: rgb(1, 1, 1),
    })
    // draw the corrected word at the same baseline, in a matching font
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
