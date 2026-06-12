import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'

// Maps the TipTap JSON document to a .docx. Covers the node types Pluma's
// editor can produce: paragraphs, headings 1-3, bullet/ordered lists,
// blockquotes, with bold/italic/underline runs and text alignment.

interface TTMark {
  type: string
}
interface TTNode {
  type: string
  text?: string
  marks?: TTMark[]
  attrs?: Record<string, unknown>
  content?: TTNode[]
}

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3]

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
}

function runs(node: TTNode): TextRun[] {
  const out: TextRun[] = []
  for (const child of node.content ?? []) {
    if (child.type !== 'text' || !child.text) continue
    const marks = new Set((child.marks ?? []).map((m) => m.type))
    out.push(
      new TextRun({
        text: child.text,
        bold: marks.has('bold'),
        italics: marks.has('italic'),
        underline: marks.has('underline') ? {} : undefined,
        strike: marks.has('strike'),
      }),
    )
  }
  return out
}

function walk(nodes: TTNode[], out: Paragraph[], listPrefix?: (i: number) => string) {
  nodes.forEach((node, i) => {
    switch (node.type) {
      case 'paragraph': {
        const children = runs(node)
        if (listPrefix) children.unshift(new TextRun({ text: listPrefix(i) }))
        out.push(
          new Paragraph({
            children,
            alignment: ALIGN[(node.attrs?.textAlign as string) ?? ''] ?? undefined,
          }),
        )
        break
      }
      case 'heading': {
        const level = Math.min(Math.max((node.attrs?.level as number) ?? 1, 1), 3)
        out.push(new Paragraph({ children: runs(node), heading: HEADINGS[level - 1] }))
        break
      }
      case 'bulletList':
        (node.content ?? []).forEach((item) => walk(item.content ?? [], out, () => '•  '))
        break
      case 'orderedList':
        (node.content ?? []).forEach((item, n) => walk(item.content ?? [], out, () => `${n + 1}.  `))
        break
      case 'blockquote':
        walk(node.content ?? [], out)
        break
      default:
        if (node.content) walk(node.content, out)
    }
  })
}

export async function exportDocx(tiptapJson: unknown, title: string): Promise<void> {
  const paragraphs: Paragraph[] = []
  walk(((tiptapJson as TTNode).content ?? []) as TTNode[], paragraphs)
  if (paragraphs.length === 0) paragraphs.push(new Paragraph(''))

  const doc = new Document({ sections: [{ children: paragraphs }] })
  const blob = await Packer.toBlob(doc)

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title || 'document'}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
