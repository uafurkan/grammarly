import type { Dialect } from '../engine/types'
import type { Source } from '../engine/originality'

export type DocKind = 'text' | 'sheet' | 'pdf'

export interface DocMeta {
  id: string
  title: string
  dialect: Dialect
  updatedAt: number
  words: number
  kind: DocKind
}

/** Where the user left off — restored on reopen so a project continues seamlessly. */
export interface EditorState {
  /** TipTap cursor position */
  selection?: { from: number; to: number }
  /** scroll offset of the editing surface */
  scrollTop?: number
  panelOpen?: boolean
  panelTab?: 'grammar' | 'originality'
  /** dismissed suggestion fingerprints (engine/checker fingerprint()) */
  dismissed?: string[]
  /** spreadsheet: active cell + visible sheet tab */
  activeCell?: { r: number; c: number }
  sheetIdx?: number
  /** PDF: accepted in-place corrections */
  corrections?: { pageIndex: number; itemIndex: number; fullStr: string }[]
}

export interface StoredDoc extends DocMeta {
  /** TipTap JSON document, or SheetContent for spreadsheets */
  content: unknown
  /** reference sources for the originality self-check (text documents) */
  sources?: Source[]
  /** restore-where-you-left-off state */
  editorState?: EditorState
  /** last time the document was opened (for "continue" / recents) */
  lastOpenedAt?: number
}

const KEY = 'pluma.docs.v1'

type Table = Record<string, StoredDoc>

function load(): Table {
  try {
    const table = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Table
    for (const doc of Object.values(table)) doc.kind ??= 'text'
    return table
  } catch {
    return {}
  }
}

function save(table: Table) {
  localStorage.setItem(KEY, JSON.stringify(table))
}

export function listDocs(): DocMeta[] {
  return Object.values(load())
    .map(({ content: _content, ...meta }) => meta)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Full documents (with content + editorState) sorted newest-first — for the history view. */
export function listDocsFull(): StoredDoc[] {
  return Object.values(load()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getDoc(id: string): StoredDoc | null {
  return load()[id] ?? null
}

/** Marks a document as just-opened (updates lastOpenedAt without bumping updatedAt). */
export function touchDoc(id: string) {
  const table = load()
  const doc = table[id]
  if (!doc) return
  doc.lastOpenedAt = Date.now()
  save(table)
}

export function createDoc(
  partial?: Partial<Pick<StoredDoc, 'title' | 'dialect' | 'content' | 'kind'>>,
): StoredDoc {
  const doc: StoredDoc = {
    id: crypto.randomUUID(),
    title: partial?.title ?? 'Untitled document',
    dialect: partial?.dialect ?? 'en-US',
    content: partial?.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    updatedAt: Date.now(),
    words: 0,
    kind: partial?.kind ?? 'text',
  }
  const table = load()
  table[doc.id] = doc
  save(table)
  return doc
}

export function updateDoc(id: string, patch: Partial<Omit<StoredDoc, 'id'>>) {
  const table = load()
  const doc = table[id]
  if (!doc) return
  table[id] = { ...doc, ...patch, updatedAt: Date.now() }
  save(table)
}

/**
 * Persists restore state (cursor/scroll/panel/corrections) WITHOUT bumping
 * updatedAt — so merely navigating a document doesn't reorder the history list.
 */
export function saveEditorState(id: string, editorState: EditorState) {
  const table = load()
  const doc = table[id]
  if (!doc) return
  doc.editorState = { ...doc.editorState, ...editorState }
  save(table)
}

export function removeDoc(id: string) {
  const table = load()
  delete table[id]
  save(table)
}
