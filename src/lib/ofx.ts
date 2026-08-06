export interface OfxEntry {
  date: string // ISO yyyy-mm-dd
  description: string
  amount: number // sempre positivo
  isCredit: boolean
}

export interface OfxParsed {
  entries: OfxEntry[]
  bankLabel: string | null
  dueDate: string | null
  totalAmount: number | null
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp('<' + name + '>([^<\\n]+)', 'i'))
  return m ? m[1].trim() : ''
}

function ofxDateToISO(raw: string): string | null {
  if (raw.length < 8) return null
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

export function parseOFX(content: string): OfxParsed {
  const txBlocks = content.match(/<STMTTRN[\s\S]*?<\/STMTTRN>/gi) ?? []
  const entries: OfxEntry[] = []

  for (const block of txBlocks) {
    const raw = tag(block, 'TRNAMT').replace(',', '.')
    const value = parseFloat(raw)
    if (isNaN(value)) continue

    const dateStr = ofxDateToISO(tag(block, 'DTPOSTED'))
    if (!dateStr) continue

    const description = tag(block, 'MEMO') || tag(block, 'NAME') || 'Sem descrição'
    const trnType = tag(block, 'TRNTYPE').toUpperCase()
    const isCredit = trnType === 'CREDIT' || value > 0

    entries.push({ date: dateStr, description, amount: Math.abs(value), isCredit })
  }

  entries.sort((a, b) => a.date.localeCompare(b.date))

  const ledgerBlock = content.match(/<LEDGERBAL>[\s\S]*?(?:<\/LEDGERBAL>|<AVAILBAL>|$)/i)?.[0] ?? ''
  const totalRaw = tag(ledgerBlock, 'BALAMT').replace(',', '.')
  const totalAmount = totalRaw ? Math.abs(parseFloat(totalRaw)) : null

  const bankId = content.match(/<ORG>([^<\n]+)/i)?.[1]?.trim()
  const acctId = content.match(/<ACCTID>([^<\n]+)/i)?.[1]?.trim()
  const bankLabel = bankId ? `${bankId}${acctId ? ' •• ' + acctId.slice(-4) : ''}` : null

  return { entries, bankLabel, dueDate: null, totalAmount }
}
