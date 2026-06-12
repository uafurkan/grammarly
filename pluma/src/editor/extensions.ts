import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { Suggestions } from './suggestions-plugin'
import { Originality } from './originality-plugin'

export function buildExtensions(
  onAlertClick: (id: string) => void,
  onOverlapClick: (id: string) => void,
) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder: 'Start writing…' }),
    Suggestions.configure({ onAlertClick }),
    Originality.configure({ onClick: onOverlapClick }),
  ]
}
