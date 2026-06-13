import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import FontFamily from '@tiptap/extension-font-family'
import { Extension } from '@tiptap/core'
import { Suggestions } from './suggestions-plugin'
import { Originality } from './originality-plugin'
import { Hemingway } from './hemingway-plugin'
import { Autocomplete } from './autocomplete-plugin'

// font-size mark attribute on TextStyle, so DOCX sizes survive round-trips
const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
            renderHTML: (attrs) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
          },
        },
      },
    ]
  },
})

export function buildExtensions(
  onAlertClick: (id: string) => void,
  onOverlapClick: (id: string) => void,
) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
    Image.configure({ inline: true, allowBase64: true }),
    Link.configure({ openOnClick: false }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    FontFamily,
    FontSize,
    Placeholder.configure({ placeholder: 'Start writing…' }),
    Suggestions.configure({ onAlertClick }),
    Originality.configure({ onClick: onOverlapClick }),
    Hemingway,
    Autocomplete,
  ]
}
