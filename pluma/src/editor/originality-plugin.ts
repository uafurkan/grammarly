// Renders originality overlaps as highlighted spans, kept aligned through edits
// (same mapping approach as the grammar suggestions plugin).

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorState } from '@tiptap/pm/state'
import type { OverlapMatch } from '../engine/originality'

export interface RangedOverlap {
  match: OverlapMatch
  from: number
  to: number
}

export const originalityKey = new PluginKey<DecorationSet>('pluma-originality')

interface SetMeta {
  type: 'set'
  items: RangedOverlap[]
  activeId: string | null
}

function deco(from: number, to: number, m: OverlapMatch, active: boolean): Decoration {
  const cls = ['pl-overlap', `pl-overlap--${m.kind}`, active ? 'pl-overlap--active' : '']
    .filter(Boolean)
    .join(' ')
  return Decoration.inline(from, to, { class: cls, 'data-overlap-id': m.id }, { id: m.id, match: m })
}

export const Originality = Extension.create<{ onClick?: (id: string) => void }>({
  name: 'plumaOriginality',

  addOptions() {
    return { onClick: undefined }
  },

  addProseMirrorPlugins() {
    const onClick = this.options.onClick
    return [
      new Plugin<DecorationSet>({
        key: originalityKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, decos) {
            const meta = tr.getMeta(originalityKey) as SetMeta | undefined
            if (meta?.type === 'set') {
              return DecorationSet.create(
                tr.doc,
                meta.items
                  .filter((i) => i.from < i.to)
                  .map((i) => deco(i.from, i.to, i.match, i.match.id === meta.activeId)),
              )
            }
            return decos.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return originalityKey.getState(state)
          },
          handleClick(view, pos) {
            const hit = originalityKey.getState(view.state)?.find(pos, pos)[0]
            if (hit && onClick) {
              onClick((hit.spec as { id: string }).id)
              return false
            }
            return false
          },
        },
      }),
    ]
  },
})

export function overlapRange(state: EditorState, id: string): { from: number; to: number } | null {
  const hit = originalityKey
    .getState(state)
    ?.find(undefined, undefined, (spec) => (spec as { id: string }).id === id)[0]
  return hit ? { from: hit.from, to: hit.to } : null
}
