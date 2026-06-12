// Tier-1 checker. Rules run instantly on the main thread; the dictionary
// spell-check (large Hunspell data) runs in a Web Worker via checkAsync so it
// never blocks typing. Both emit the same Alert shape (GRAMMARLY_ANALYSIS.md §6).

import type { Alert, Dialect } from './types'
import { runRules, resolveOverlaps } from './run'

/** Synchronous, rules-only check (no dictionary). Used as instant fallback. */
export function check(text: string, dialect: Dialect): Alert[] {
  return resolveOverlaps(runRules(text, dialect))
}

// --- Worker-backed async check (rules + dictionary spell-check) ------------

interface PendingReq {
  resolve: (alerts: Alert[]) => void
}

let worker: Worker | null = null
let reqSeq = 0
const pending = new Map<number, PendingReq>()

function getWorker(): Worker | null {
  if (worker) return worker
  if (typeof Worker === 'undefined') return null
  try {
    worker = new Worker(new URL('./checker.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent) => {
      const { reqId, alerts } = e.data as { reqId: number; alerts: Alert[] }
      const req = pending.get(reqId)
      if (req) {
        pending.delete(reqId)
        req.resolve(alerts)
      }
    }
    worker.onerror = () => {
      // on a worker failure, drain pending with empty so callers don't hang
      for (const [, req] of pending) req.resolve([])
      pending.clear()
    }
  } catch {
    worker = null
  }
  return worker
}

/**
 * Full check: rules + dictionary spell-check, off the main thread. Falls back
 * to the synchronous rules-only check if a worker isn't available.
 */
export function checkAsync(text: string, dialect: Dialect, personal: string[] = []): Promise<Alert[]> {
  const w = getWorker()
  if (!w) return Promise.resolve(check(text, dialect))
  const reqId = ++reqSeq
  return new Promise<Alert[]>((resolve) => {
    pending.set(reqId, { resolve })
    w.postMessage({ reqId, text, dialect, personal })
  })
}

/** Stable fingerprint so a dismissed alert stays dismissed across re-checks. */
export function fingerprint(a: Alert): string {
  return `${a.ruleId}:${a.text}`
}
