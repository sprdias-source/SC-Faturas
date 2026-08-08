import { monthLabel } from './format'
import { isBankAdjustmentDescription } from './entryHelpers'
import type { EntryWithSplits } from '../hooks/useEntries'
import type { Import } from './types'

export interface MonthGroup {
  key: string // "2026-01"
  year: string
  month: string // "01"
  monthName: string
  entries: EntryWithSplits[] // classificáveis (sem os ajustes de banco)
  adjustments: EntryWithSplits[] // pagamento/crédito de anuidade etc.
  sources: { importId: string | null; label: string; count: number }[]
  despesasTotal: number
  creditosTotal: number
  pendingCount: number
  pendingAmount: number
  total: number
}

export interface YearGroup {
  year: string
  months: MonthGroup[]
  // agregados do ano NÃO são guardados à parte — sempre somados a partir
  // dos meses, pra nunca existir uma segunda fonte de verdade a manter
  // sincronizada com os dados reais.
  pendingCount: number
  despesasTotal: number
}

function sourceLabelFor(entry: EntryWithSplits, importsById: Map<string, Import>): { importId: string | null; label: string } {
  if (!entry.source_import_id) return { importId: null, label: 'Sem fatura vinculada' }
  const imp = importsById.get(entry.source_import_id)
  return { importId: entry.source_import_id, label: imp?.card_or_bank_label ?? imp?.filename ?? 'Fatura removida' }
}

export function groupEntriesByYearMonth(entries: EntryWithSplits[], imports: Import[]): YearGroup[] {
  const importsById = new Map(imports.map((i) => [i.id, i]))
  const monthMap = new Map<string, MonthGroup>()

  for (const entry of entries) {
    const year = entry.date.slice(0, 4)
    const month = entry.date.slice(5, 7)
    const key = `${year}-${month}`

    if (!monthMap.has(key)) {
      monthMap.set(key, {
        key, year, month, monthName: monthLabel(month),
        entries: [], adjustments: [], sources: [],
        despesasTotal: 0, creditosTotal: 0, pendingCount: 0, pendingAmount: 0, total: 0,
      })
    }
    const group = monthMap.get(key)!
    const isAdjustment = entry.type === 'receita' && isBankAdjustmentDescription(entry.description)

    if (isAdjustment) {
      group.adjustments.push(entry)
      continue
    }

    group.entries.push(entry)
    group.total++
    if (entry.type === 'despesa') group.despesasTotal += entry.amount
    else group.creditosTotal += entry.amount
    if (entry.status === 'pendente') {
      group.pendingCount++
      group.pendingAmount += entry.amount
    }

    const { importId, label } = sourceLabelFor(entry, importsById)
    const existingSource = group.sources.find((s) => s.importId === importId)
    if (existingSource) existingSource.count++
    else group.sources.push({ importId, label, count: 1 })
  }

  const yearMap = new Map<string, MonthGroup[]>()
  for (const group of monthMap.values()) {
    if (!yearMap.has(group.year)) yearMap.set(group.year, [])
    yearMap.get(group.year)!.push(group)
  }

  const years: YearGroup[] = [...yearMap.entries()].map(([year, months]) => {
    months.sort((a, b) => b.month.localeCompare(a.month))
    return {
      year,
      months,
      pendingCount: months.reduce((s, m) => s + m.pendingCount, 0),
      despesasTotal: months.reduce((s, m) => s + m.despesasTotal, 0),
    }
  })
  years.sort((a, b) => b.year.localeCompare(a.year))

  return years
}
