import * as XLSX from 'xlsx'
import { ImportError, MAX_FILE_BYTES, sizeError } from './docx-import'

export interface SheetData {
  name: string
  rows: string[][]
}

export interface SheetContent {
  kind: 'sheet'
  sheets: SheetData[]
}

export interface ImportedSheet {
  title: string
  content: SheetContent
}

const MAX_CELLS = 1_000_000

export async function importXlsx(file: File): Promise<ImportedSheet> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportError(sizeError(file))
  }

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  } catch {
    throw new ImportError('Could not read this spreadsheet. Is it a valid Excel or CSV file?')
  }

  let cells = 0
  const sheets: SheetData[] = wb.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], {
      header: 1,
      raw: false,
      defval: '',
    }).map((row) => row.map((v) => String(v ?? '')))
    cells += rows.reduce((n, r) => n + r.length, 0)
    return { name, rows }
  })

  if (cells > MAX_CELLS) {
    throw new ImportError(
      `This workbook has over ${MAX_CELLS.toLocaleString()} cells — that's past the limit.`,
    )
  }
  if (sheets.length === 0) sheets.push({ name: 'Sheet1', rows: [] })

  return {
    title: file.name.replace(/\.(xlsx|xls|csv)$/i, ''),
    content: { kind: 'sheet', sheets },
  }
}

export function newSheetContent(): SheetContent {
  return { kind: 'sheet', sheets: [{ name: 'Sheet1', rows: [] }] }
}

export function exportXlsx(content: SheetContent, title: string) {
  const wb = XLSX.utils.book_new()
  for (const sheet of content.sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows.length ? sheet.rows : [['']])
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31) || 'Sheet')
  }
  XLSX.writeFile(wb, `${title || 'spreadsheet'}.xlsx`)
}
