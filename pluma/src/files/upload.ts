import { importDocx, ImportError } from './docx-import'
import { importPdf } from './pdf-import'
import { importXlsx } from './xlsx-import'
import { guessDialect } from '../engine/dialect'
import { createDoc, type StoredDoc } from '../store/documents'

export const ACCEPTED = '.doc,.docx,.pdf,.xlsx,.xls,.csv'

export function routeFor(doc: StoredDoc): string {
  return doc.kind === 'sheet' ? `/sheet/${doc.id}` : `/doc/${doc.id}`
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
  const ext = file.name.toLowerCase().split('.').pop() ?? ''

  if (ext === 'pdf') {
    const { title, html } = await importPdf(file)
    return createDoc({
      title,
      content: html,
      dialect: guessDialect(html.replace(/<[^>]+>/g, ' ')),
    })
  }

  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    const { title, content } = await importXlsx(file)
    const sample = content.sheets
      .flatMap((s) => s.rows.flat())
      .filter((v) => /[A-Za-z]/.test(v))
      .slice(0, 200)
      .join(' ')
    return createDoc({ title, content, kind: 'sheet', dialect: guessDialect(sample) })
  }

  if (ext === 'doc' || ext === 'docx') {
    const imported = await importDocx(file)
    return createDoc({
      title: imported.title,
      content: imported.html,
      dialect: guessDialect(imported.html.replace(/<[^>]+>/g, ' ')),
    })
  }

  throw new ImportError('Supported files: Word (.doc/.docx), PDF, Excel (.xlsx/.xls) and CSV.')
}
