import { importDocx, ImportError } from './docx-import'
import { guessDialect } from '../engine/dialect'
import { createDoc, type StoredDoc } from '../store/documents'

/** Opens a file picker, imports the chosen .docx, and stores it as a new document. */
export function pickAndImport(
  onDone: (doc: StoredDoc) => void,
  onError: (message: string) => void,
) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.doc,.docx'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const imported = await importDocx(file)
      const plain = imported.html.replace(/<[^>]+>/g, ' ')
      const doc = createDoc({
        title: imported.title,
        content: imported.html,
        dialect: guessDialect(plain),
      })
      onDone(doc)
    } catch (err) {
      onError(err instanceof ImportError ? err.message : 'Could not import this file.')
    }
  }
  input.click()
}
