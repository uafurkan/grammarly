import mammoth from 'mammoth'

// Grammarly caps uploads at 100,000 characters / 4 MB (see analysis §2).
// Pluma deliberately goes well past that.
export const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB
export const MAX_CHARS = 400_000

export class ImportError extends Error {}

export interface ImportedDoc {
  title: string
  html: string
  chars: number
}

export async function importDocx(file: File): Promise<ImportedDoc> {
  if (!/\.docx?$/i.test(file.name)) {
    throw new ImportError('Only .docx and .doc files are supported for now. PDF and Excel are on the roadmap.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportError(
      `This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is 25 MB.`,
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  let html: string
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer })
    html = result.value
  } catch {
    throw new ImportError('Could not read this file. Is it a valid Word document?')
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
