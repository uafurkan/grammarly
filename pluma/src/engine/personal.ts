// User's personal dictionary — words they've marked as correct. Shared across
// all documents, persisted in localStorage. Lowercased for case-insensitive use.

const KEY = 'pluma.personal.v1'

export function getPersonalWords(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function addPersonalWord(word: string): string[] {
  const w = word.trim().toLowerCase()
  if (!w) return getPersonalWords()
  const set = new Set(getPersonalWords())
  set.add(w)
  const list = [...set]
  localStorage.setItem(KEY, JSON.stringify(list))
  return list
}
