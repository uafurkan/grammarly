import mammoth from 'mammoth'

// Grammarly caps uploads at 100,000 characters / 4 MB (see analysis §2).
// Pluma deliberately goes far past that.
export const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100 MB
export const MAX_CHARS = 2_000_000

export const sizeError = (file: File) =>
  `This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is 100 MB.`

export class ImportError extends Error {}

export interface ImportedDoc {
  title: string
  html: string
  chars: number
}

export async function importDocx(file: File): Promise<ImportedDoc> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportError(sizeError(file))
  }

  const arrayBuffer = await file.arrayBuffer()
  let html: string
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer })
    html = result.value
  } catch (err) {
    // Old binary .doc files are not supported by mammoth — say so clearly.
    if (/\.doc$/i.test(file.name)) {
      throw new ImportError(
        'This is an old binary .doc file. Please re-save it as .docx in Word and upload again.',
      )
    }
    throw new ImportError(
      `Could not read this Word document${err instanceof Error && err.message ? ` (${err.message.slice(0, 80)})` : ''}.`,
    )
  }

  const probe = document.createElement('div')
  probe.innerHTML = html
  const chars = (probe.textContent ?? '').length
  if (chars > MAX_CHARS) {
    throw new ImportError(
      `This document has ${chars.toLocaleString()} characters — the limit is ${MAX_CHARS.toLocaleString()}.`,
    )
  }

  return {
    title: file.name.replace(/\.docx?$/i, ''),
    html: html || '<p></p>',
    chars,
  }
}
