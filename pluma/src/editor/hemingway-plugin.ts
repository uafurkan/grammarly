// Renders Hemingway-style clarity marks (hard/very-hard sentences, adverbs,
// passive voice, weakeners, complex words) as colored backgrounds. Kept aligned
// through edits the same way the suggestions/originality plugins are. Toggled
// on/off by the editor so it never clashes with the grammar underlines.

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { HemingwayMark } from '../engine/analytics'

export interface RangedMark {
  kind: HemingwayMark['kind']
  from: number
  to: number
}

export const hemingwayKey = new PluginKey<DecorationSet>('pluma-hemingway')

interface SetMeta {
  type: 'set'
  items: RangedMark[]
}

const TITLES: Record<HemingwayMark['kind'], string> = {
  'very-hard': 'Very hard to read — consider splitting this sentence',
  hard: 'Hard to read — a shorter sentence would help',
  adverb: 'Adverb — often stronger without it',
  passive: 'Passive voice — active is usually clearer',
  weakener: 'Weakening word — consider removing it',
  'complex-word': 'Complex word — a simpler one may read better',
}

export const Hemingway = Extension.create({
  name: 'plumaHemingway',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: hemingwayKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, decos) {
            const meta = tr.getMeta(hemingwayKey) as SetMeta | undefined
            if (meta?.type === 'set') {
              return DecorationSet.create(
                tr.doc,
                meta.items
                  .filter((i) => i.from < i.to)
                  .map((i) =>
                    Decoration.inline(i.from, i.to, {
                      class: `pl-hem pl-hem--${i.kind}`,
                      title: TITLES[i.kind],
                    }),
                  ),
              )
            }
            return decos.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return hemingwayKey.getState(state)
          },
        },
      }),
    ]
  },
})
