import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfLineEntry {
  date: string // ISO
  description: string
  amount: number
}

const DATE_RE = /\b(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\b/
const VALUE_RE = /(-?\s?R?\$?\s?\d{1,3}(?:\.\d{3})*,\d{2})\s*-?\s*$/

function parseValue(raw: string): number {
  const cleaned = raw.replace(/[R$\s]/g, '')
  const isNegative = cleaned.startsWith('-') || raw.trim().endsWith('-')
  const n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.').replace('-', ''))
  return isNegative ? -n : n
}

function guessYear(day: string, month: string, yearRaw: string | undefined, referenceISO: string): string {
  if (yearRaw) {
    const y = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw
    return `${y}-${month}-${day}`
  }
  const refYear = referenceISO.slice(0, 4)
  return `${refYear}-${month}-${day}`
}

/**
 * Extração best-effort: pega o texto de cada página do PDF e procura linhas
 * no padrão "data ... descrição ... valor" (formato comum de fatura de
 * cartão). Faturas variam muito de layout — sempre revise o resultado na
 * tela de conciliação antes de confiar 100%.
 */
export async function parsePdfEntries(file: File): Promise<PdfLineEntry[]> {
  const buf = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buf }).promise
  const today = new Date().toISOString().slice(0, 10)
  const entries: PdfLineEntry[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const lines = new Map<number, string[]>()
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      const y = Math.round(item.transform[5])
      if (!lines.has(y)) lines.set(y, [])
      lines.get(y)!.push(item.str)
    }
    const orderedLines = [...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, parts]) => parts.join(' ').replace(/\s+/g, ' ').trim())

    for (const line of orderedLines) {
      const dateMatch = line.match(DATE_RE)
      const valueMatch = line.match(VALUE_RE)
      if (!dateMatch || !valueMatch) continue

      const [, day, month, yearRaw] = dateMatch
      const iso = guessYear(day, month, yearRaw, today)
      const amount = parseValue(valueMatch[1])
      if (isNaN(amount) || amount === 0) continue

      const description = line
        .replace(dateMatch[0], '')
        .replace(valueMatch[0], '')
        .replace(/\s+/g, ' ')
        .trim()

      if (description.length < 2) continue
      entries.push({ date: iso, description, amount: Math.abs(amount) })
    }
  }

  return entries
}
