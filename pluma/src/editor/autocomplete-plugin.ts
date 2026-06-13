// In-word ghost-text autocomplete. A widget decoration (position-only, so it
// never enters the document or undo history) shows the predicted rest of the
// word in gray at the cursor. Tab accepts it; any edit clears it. The async
// fetch + debounce lives in the editor component, which dispatches the result
// here via a meta transaction.

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface GhostState {
  pos: number
  suffix: string
}

export const autocompleteKey = new PluginKey<GhostState | null>('pluma-autocomplete')

export const Autocomplete = Extension.create({
  name: 'plumaAutocomplete',

  addProseMirrorPlugins() {
    return [
      new Plugin<GhostState | null>({
        key: autocompleteKey,
        state: {
          init: () => null,
          apply(tr, prev) {
            const meta = tr.getMeta(autocompleteKey) as { ghost: GhostState | null } | undefined
            if (meta) return meta.ghost
            // any document change or selection move invalidates a stale ghost
            if (tr.docChanged || tr.selectionSet) return null
            return prev
          },
        },
        props: {
          decorations(state) {
            const ghost = autocompleteKey.getState(state)
            if (!ghost || !ghost.suffix) return DecorationSet.empty
            const el = document.createElement('span')
            el.className = 'pl-ghost'
            el.textContent = ghost.suffix
            return DecorationSet.create(state.doc, [
              Decoration.widget(ghost.pos, el, { side: 1, ignoreSelection: true, key: 'pl-ghost' }),
            ])
          },
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const ghost = autocompleteKey.getState(this.editor.state)
        if (!ghost || !ghost.suffix) return false // let Tab do its normal thing
        this.editor
          .chain()
          .insertContentAt(ghost.pos, ghost.suffix)
          .setTextSelection(ghost.pos + ghost.suffix.length)
          .run()
        return true
      },
      Escape: () => {
        const ghost = autocompleteKey.getState(this.editor.state)
        if (!ghost) return false
        this.editor.view.dispatch(this.editor.state.tr.setMeta(autocompleteKey, { ghost: null }))
        return true
      },
    }
  },
})
