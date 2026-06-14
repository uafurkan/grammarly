// ProseMirror layer that renders alerts as wavy underlines.
//
// Decorations are mapped through every transaction (DecorationSet.map), so
// underlines stay glued to the right words while the user keeps typing —
// the client-side "rebase" pattern described in GRAMMARLY_ANALYSIS.md §3.

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import type { Alert } from '../engine/types'

export interface RangedAlert {
  alert: Alert
  from: number
  to: number
}

export const suggestionsKey = new PluginKey<DecorationSet>('pluma-suggestions')

interface SetMeta {
  type: 'set'
  items: RangedAlert[]
  activeId: string | null
}
interface ActiveMeta {
  type: 'active'
  activeId: string | null
}
type Meta = SetMeta | ActiveMeta

function deco(from: number, to: number, alert: Alert, active: boolean): Decoration {
  const cls = [
    'pl-alert',
    `pl-alert--${alert.category}`,
    active ? 'pl-alert--active' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return Decoration.inline(from, to, { class: cls, 'data-alert-id': alert.id }, { id: alert.id, alert })
}

export const Suggestions = Extension.create<{ onAlertClick?: (id: string) => void }>({
  name: 'plumaSuggestions',

  addOptions() {
    return { onAlertClick: undefined }
  },

  addProseMirrorPlugins() {
    const onAlertClick = this.options.onAlertClick
    return [
      new Plugin<DecorationSet>({
        key: suggestionsKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, decos) {
            const meta = tr.getMeta(suggestionsKey) as Meta | undefined
            if (meta?.type === 'set') {
              return DecorationSet.create(
                tr.doc,
                meta.items
                  .filter((i) => i.from < i.to)
                  .map((i) => deco(i.from, i.to, i.alert, i.alert.id === meta.activeId)),
              )
            }
            if (meta?.type === 'active') {
              const rebuilt = decos.find().map((d) => {
                const { alert } = d.spec as { alert: Alert }
                return deco(d.from, d.to, alert, alert.id === meta.activeId)
              })
              return DecorationSet.create(tr.doc, rebuilt)
            }
            return decos.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return suggestionsKey.getState(state)
          },
          handleClick(view, pos) {
            const decos = suggestionsKey.getState(view.state)
            const hit = decos?.find(pos, pos)[0]
            if (hit && onAlertClick) {
              onAlertClick((hit.spec as { id: string }).id)
              return false
            }
            return false
          },
        },
      }),
    ]
  },
})

/** Current (post-edit) document range of an alert, if it still exists. */
export function alertRange(state: EditorState, id: string): { from: number; to: number } | null {
  const decos = suggestionsKey.getState(state)
  const hit = decos?.find(undefined, undefined, (spec) => (spec as { id: string }).id === id)[0]
  return hit ? { from: hit.from, to: hit.to } : null
}

/** The alert object plus its current range, looked up from the decoration spec. */
export function alertAt(state: EditorState, id: string): RangedAlert | null {
  const decos = suggestionsKey.getState(state)
  const hit = decos?.find(undefined, undefined, (spec) => (spec as { id: string }).id === id)[0]
  return hit ? { alert: (hit.spec as { alert: Alert }).alert, from: hit.from, to: hit.to } : null
}

/**
 * Flattens the document to plain text and returns a mapper from text offsets
 * back to ProseMirror positions. Alerts spanning block boundaries are dropped
 * by the caller (toPm returns null for separator offsets).
 */
export function docText(doc: PMNode): {
  text: string
  toPm: (offset: number) => number | null
} {
  let text = ''
  const segs: { from: number; to: number; pmStart: number }[] = []

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      segs.push({ from: text.length, to: text.length + node.text.length, pmStart: pos })
      text += node.text
    } else if (node.isBlock && text.length > 0 && !text.endsWith('\n')) {
      text += '\n'
    }
    return true
  })

  const toPm = (offset: number): number | null => {
    let lo = 0
    let hi = segs.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const s = segs[mid]
      if (offset < s.from) hi = mid - 1
      else if (offset > s.to) lo = mid + 1
      else return s.pmStart + (offset - s.from)
    }
    return null
  }

  return { text, toPm }
}
