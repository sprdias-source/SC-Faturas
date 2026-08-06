import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { OfxParsed } from './ofx'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const MONTHS: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
}
const MONTH_NAMES = Object.keys(MONTHS).join('|')

// "24/dez", "3/jan" — dia + mês abreviado em português (formato comum de
// fatura de cartão brasileira). Não confundir com "01/03" de parcela, que
// é só dígitos — por isso o mês aqui É OBRIGATORIAMENTE uma das siglas.
const DATE_RE = new RegExp(`\\b(\\d{1,2})\\/(${MONTH_NAMES})\\b`, 'i')
const VALUE_RE = /(-?\s?R?\$?\s?\d{1,3}(?:\.\d{3})*,\d{2})\s*-?\s*$/
const FULL_DATE_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/
const DUE_DATE_RE = new RegExp(`Vencimento\\s+(\\d{1,2})\\/(${MONTH_NAMES})`, 'i')
const TOTAL_RE = /Total\s+desta\s+Fatura\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})/i
const CARD_LABEL_RE = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{2,30}final\s+\d{4})/

function parseValue(raw: string): number {
  const isNegative = raw.trim().startsWith('-')
  const cleaned = raw.replace(/[R$\s-]/g, '')
  const n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  return isNegative ? -n : n
}

function parseBRLNumber(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
}

/** Agrupa itens de texto em "linhas" por proximidade vertical (não por Y
 *  idêntico) — em PDFs reais, palavras da mesma linha visual às vezes saem
 *  com Y levemente diferente por causa de kerning/fontes, e um agrupamento
 *  exato perde pedaços da linha (ex.: descrição some, só o valor fica). */
function groupIntoLines(items: Array<{ str: string; transform: number[] }>, tolerance = 3): string[] {
  const sorted = items
    .filter((i) => i.str.trim().length > 0)
    .map((i) => ({ y: i.transform[5], str: i.str }))
    .sort((a, b) => b.y - a.y)

  const lines: { y: number; parts: string[] }[] = []
  for (const item of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - item.y) <= tolerance) {
      last.parts.push(item.str)
    } else {
      lines.push({ y: item.y, parts: [item.str] })
    }
  }
  return lines.map((l) => l.parts.join(' ').replace(/\s+/g, ' ').trim())
}

/**
 * Extração best-effort de fatura de cartão em PDF: procura linhas no
 * padrão "dia/mês-abreviado ... descrição ... valor". Layout varia por
 * banco — sempre revise o resultado na tela de conciliação antes de
 * confiar 100%.
 */
export async function parsePdfEntries(file: File): Promise<OfxParsed> {
  const buf = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buf }).promise

  let fullText = ''
  const allLines: string[] = []
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const lines = groupIntoLines(content.items as Array<{ str: string; transform: number[] }>)
    allLines.push(...lines)
    fullText += lines.join('\n') + '\n'
  }

  // ano de referência: pega a primeira data completa (dd/mm/yyyy) do
  // documento (normalmente o fechamento da próxima fatura) — transações
  // com mês maior que esse mês de referência são do ano anterior (uma
  // fatura fechada em janeiro tem compras de dezembro do ano passado).
  const fullDateMatch = fullText.match(FULL_DATE_RE)
  const refMonth = fullDateMatch ? parseInt(fullDateMatch[2], 10) : new Date().getMonth() + 1
  const refYear = fullDateMatch ? parseInt(fullDateMatch[3], 10) : new Date().getFullYear()

  function toISO(day: string, monthAbbrev: string): string {
    const month = MONTHS[monthAbbrev.toLowerCase()]
    const year = parseInt(month, 10) > refMonth ? refYear - 1 : refYear
    return `${year}-${month}-${day.padStart(2, '0')}`
  }

  const entries: OfxParsed['entries'] = []
  for (const line of allLines) {
    const dateMatch = line.match(DATE_RE)
    const valueMatch = line.match(VALUE_RE)
    if (!dateMatch || !valueMatch) continue

    const signedAmount = parseValue(valueMatch[1])
    if (isNaN(signedAmount) || signedAmount === 0) continue

    const description = line
      .replace(dateMatch[0], '')
      .replace(valueMatch[0], '')
      .replace(/\b\d{1,2}\/\d{2}\b/, '') // marcador de parcela, ex. "01/03"
      .replace(/\d{1,2}:\d{2}/, '') // horário
      .replace(/\s+/g, ' ')
      .trim()
    if (description.length < 2) continue

    entries.push({
      date: toISO(dateMatch[1], dateMatch[2]),
      description,
      amount: Math.abs(signedAmount),
      isCredit: signedAmount < 0,
    })
  }
  entries.sort((a, b) => a.date.localeCompare(b.date))

  const dueMatch = fullText.match(DUE_DATE_RE)
  const dueDate = dueMatch ? toISO(dueMatch[1], dueMatch[2]) : null

  const totalMatch = fullText.match(TOTAL_RE)
  const totalAmount = totalMatch
    ? parseBRLNumber(totalMatch[1])
    : entries.filter((e) => !e.isCredit).reduce((s, e) => s + e.amount, 0)

  const cardMatch = fullText.match(CARD_LABEL_RE)
  const bankLabel = cardMatch ? cardMatch[1].replace(/\s+/g, ' ').trim() : null

  return { entries, bankLabel, dueDate, totalAmount }
}
