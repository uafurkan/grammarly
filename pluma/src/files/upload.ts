import { importDocx, ImportError } from './docx-import'
import { importPdf } from './pdf-import'
import { importXlsx } from './xlsx-import'
import { guessDialect } from '../engine/dialect'
import { createDoc, type StoredDoc } from '../store/documents'

export const ACCEPTED = '.doc,.docx,.pdf,.xlsx,.xls,.csv,.txt,.rtf,.odt'

export function routeFor(doc: StoredDoc): string {
  return doc.kind === 'sheet' ? `/sheet/${doc.id}` : `/doc/${doc.id}`
}

type Kind = 'pdf' | 'sheet' | 'word'

// Resolve the file kind from extension first, then MIME type (iOS sometimes
// drops the extension when sharing from other apps).
function detectKind(file: File): Kind | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'sheet'
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'word'

  const mime = file.type
  if (mime === 'application/pdf') return 'pdf'
  if (/spreadsheet|excel|csv/i.test(mime)) return 'sheet'
  if (/word|opendocument|text\/plain|rtf/i.test(mime)) return 'word'
  return null
}

/** Opens a file picker, imports Word/PDF/Excel, and stores it as a new document. */
export function pickAndImport(
  onDone: (doc: StoredDoc) => void,
  onError: (message: string) => void,
) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = ACCEPTED
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      onDone(await importFile(file))
    } catch (err) {
      onError(err instanceof ImportError ? err.message : 'Could not import this file.')
    }
  }
  input.click()
}

async function importFile(file: File): Promise<StoredDoc> {
  const kind = detectKind(file)

  if (kind === 'pdf') {
    const { title, html } = await importPdf(file)
    return createDoc({
      title,
      content: html,
      dialect: guessDialect(html.replace(/<[^>]+>/g, ' ')),
    })
  }

  if (kind === 'sheet') {
    const { title, content } = await importXlsx(file)
    const sample = content.sheets
      .flatMap((s) => s.rows.flat())
      .filter((v) => /[A-Za-z]/.test(v))
      .slice(0, 200)
      .join(' ')
    return createDoc({ title, content, kind: 'sheet', dialect: guessDialect(sample) })
  }

  if (kind === 'word') {
    const imported = await importDocx(file)
    return createDoc({
      title: imported.title,
      content: imported.html,
      dialect: guessDialect(imported.html.replace(/<[^>]+>/g, ' ')),
    })
  }

  throw new ImportError(
    `“${file.name || 'this file'}” isn't a supported type. Upload Word (.docx), PDF, Excel (.xlsx/.xls) or CSV.`,
  )
}
