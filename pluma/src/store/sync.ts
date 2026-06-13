// Device-to-device transfer without a server. Everything Pluma stores — all
// documents, their PDF originals, and the personal dictionary — is packed into
// one .pluma file (a zip). Import it on another device to merge or replace.
// This keeps the zero-backend, fully-private promise while still letting work
// move between phones and laptops. It also doubles as a backup.

import JSZip from 'jszip'
import { listDocsFull, importDocs, type StoredDoc } from './documents'
import { getBlob, putBlob, allBlobKeys } from './blobs'
import { getPersonalWords, mergePersonalWords } from '../engine/personal'

interface Manifest {
  version: 1
  exportedAt: number
  docs: StoredDoc[]
  personal: string[]
  blobIds: string[]
}

export async function exportBundle(): Promise<Blob> {
  const docs = listDocsFull()
  const blobIds = await allBlobKeys()
  const zip = new JSZip()

  const blobFolder = zip.folder('blobs')!
  for (const bid of blobIds) {
    const buf = await getBlob(bid)
    if (buf) blobFolder.file(`${bid}.bin`, buf)
  }

  const manifest: Manifest = {
    version: 1,
    exportedAt: Date.now(),
    docs,
    personal: getPersonalWords(),
    blobIds,
  }
  zip.file('manifest.json', JSON.stringify(manifest))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

export function suggestedFilename(): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `pluma-backup-${stamp}.pluma`
}

export interface ImportResult {
  added: number
  updated: number
  blobs: number
}

export async function importBundle(file: File, mode: 'merge' | 'replace'): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file)
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('Not a valid Pluma backup (no manifest).')
  const manifest = JSON.parse(await manifestFile.async('string')) as Manifest
  if (manifest.version !== 1 || !Array.isArray(manifest.docs)) {
    throw new Error('Unrecognised backup format.')
  }

  const { added, updated } = importDocs(manifest.docs, mode)
  if (manifest.personal?.length) mergePersonalWords(manifest.personal)

  let blobs = 0
  for (const bid of manifest.blobIds ?? []) {
    const f = zip.file(`blobs/${bid}.bin`)
    if (f) {
      await putBlob(bid, await f.async('arraybuffer'))
      blobs++
    }
  }
  return { added, updated, blobs }
}
