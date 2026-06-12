import type { Dialect } from '../engine/types'

export interface DocMeta {
  id: string
  title: string
  dialect: Dialect
  updatedAt: number
  words: number
}

export interface StoredDoc extends DocMeta {
  /** TipTap JSON document */
  content: unknown
}

const KEY = 'pluma.docs.v1'

type Table = Record<string, StoredDoc>

function load(): Table {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Table
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

export function getDoc(id: string): StoredDoc | null {
  return load()[id] ?? null
}

export function createDoc(partial?: Partial<Pick<StoredDoc, 'title' | 'dialect' | 'content'>>): StoredDoc {
  const doc: StoredDoc = {
    id: crypto.randomUUID(),
    title: partial?.title ?? 'Untitled document',
    dialect: partial?.dialect ?? 'en-US',
    content: partial?.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    updatedAt: Date.now(),
    words: 0,
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

export function removeDoc(id: string) {
  const table = load()
  delete table[id]
  save(table)
}
