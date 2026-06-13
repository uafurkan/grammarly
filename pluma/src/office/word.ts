/// <reference types="office-js" />
// Thin bridge over the Office.js Word API. The engine stays host-agnostic;
// this file is the only place that knows it's running inside Word.

/** Reads the whole document body as plain text. */
export async function readDocText(): Promise<string> {
  return Word.run(async (ctx) => {
    const body = ctx.document.body
    body.load('text')
    await ctx.sync()
    return body.text
  })
}

/**
 * Replaces a specific occurrence of `flagged` with `replacement`. The engine
 * gives us a char offset; we translate that to "the Nth match" so we change the
 * right one even when the same word appears many times.
 */
export async function applyReplacement(
  flagged: string,
  replacement: string,
  occurrenceIndex: number,
): Promise<boolean> {
  return Word.run(async (ctx) => {
    const search = ctx.document.body.search(flagged, { matchCase: true })
    search.load('items')
    await ctx.sync()
    const target = search.items[occurrenceIndex] ?? search.items[0]
    if (!target) return false
    target.insertText(replacement, Word.InsertLocation.replace)
    target.select()
    await ctx.sync()
    return true
  })
}

/** Scrolls to and selects an occurrence so the user can see what's flagged. */
export async function selectOccurrence(flagged: string, occurrenceIndex: number): Promise<void> {
  return Word.run(async (ctx) => {
    const search = ctx.document.body.search(flagged, { matchCase: true })
    search.load('items')
    await ctx.sync()
    const target = search.items[occurrenceIndex] ?? search.items[0]
    if (target) {
      target.select()
      await ctx.sync()
    }
  })
}

/** Appends text (e.g. a formatted bibliography) to the end of the document. */
export async function appendText(text: string): Promise<void> {
  return Word.run(async (ctx) => {
    const body = ctx.document.body
    body.insertParagraph(text, Word.InsertLocation.end)
    await ctx.sync()
  })
}

/** Inserts text at the current selection (e.g. an in-text citation). */
export async function insertAtSelection(text: string): Promise<void> {
  return Word.run(async (ctx) => {
    ctx.document.getSelection().insertText(text, Word.InsertLocation.replace)
    await ctx.sync()
  })
}

/** How many times `needle` occurs in `hay` before character index `before`. */
export function occurrenceBefore(hay: string, needle: string, before: number): number {
  if (!needle) return 0
  let count = 0
  let i = hay.indexOf(needle)
  while (i !== -1 && i < before) {
    count++
    i = hay.indexOf(needle, i + 1)
  }
  return count
}
