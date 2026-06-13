// Small pure helpers for the history view: a plain-text preview snippet and
// recency grouping. No DOM, no storage — just shapes already in the store.

import type { StoredDoc } from './documents'
import type { SheetContent } from '../files/xlsx-import'

/** Walks a TipTap JSON node tree collecting text, stopping past `limit` chars. */
function tiptapText(node: unknown, out: { s: string }, limit: number): void {
  if (out.s.length >= limit || node == null || typeof node !== 'object') return
  const n = node as { type?: string; text?: string; content?: unknown[] }
  if (typeof n.text === 'string') out.s += n.text
  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      if (out.s.length >= limit) break
      // put a space between block-level nodes so words don't run together
      if (out.s && !out.s.endsWith(' ')) out.s += ' '
      tiptapText(child, out, limit)
    }
  }
}

/** A short, human preview of a document's content for the history cards. */
export function textPreview(doc: StoredDoc, limit = 140): string {
  if (doc.kind === 'pdf') {
    const n = doc.editorState?.corrections?.length ?? 0
    return n > 0 ? `PDF · ${n} correction${n === 1 ? '' : 's'} applied` : 'PDF document'
  }
  if (doc.kind === 'sheet') {
    const content = doc.content as SheetContent | undefined
    const cells: string[] = []
    for (const sheet of content?.sheets ?? []) {
      for (const row of sheet.rows) {
        for (const cell of row) {
          if (cell && cell.trim()) cells.push(cell.trim())
          if (cells.length >= 12) break
        }
        if (cells.length >= 12) break
      }
      if (cells.length >= 12) break
    }
    return cells.join(' · ').slice(0, limit) || 'Empty spreadsheet'
  }
  const acc = { s: '' }
  tiptapText(doc.content, acc, limit + 20)
  const text = acc.s.replace(/\s+/g, ' ').trim()
  return text ? (text.length > limit ? text.slice(0, limit) + '…' : text) : 'Empty document'
}

export type RecencyBucket = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older'

/** Buckets a timestamp by how recent it is, relative to now. */
export function recencyBucket(ts: number, now = Date.now()): RecencyBucket {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const dayMs = 86_400_000
  if (ts >= startOfToday.getTime()) return 'Today'
  if (ts >= startOfToday.getTime() - dayMs) return 'Yesterday'
  if (ts >= startOfToday.getTime() - 7 * dayMs) return 'Previous 7 days'
  return 'Older'
}

export const RECENCY_ORDER: RecencyBucket[] = ['Today', 'Yesterday', 'Previous 7 days', 'Older']
