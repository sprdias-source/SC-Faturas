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

function emptyMonthGroup(key: string): MonthGroup {
  const [year, month] = key.split('-')
  return {
    key, year, month, monthName: monthLabel(month),
    entries: [], adjustments: [], sources: [],
    despesasTotal: 0, creditosTotal: 0, pendingCount: 0, pendingAmount: 0, total: 0,
  }
}

function addEntryToGroup(group: MonthGroup, entry: EntryWithSplits) {
  const isAdjustment = entry.type === 'receita' && isBankAdjustmentDescription(entry.description)
  if (isAdjustment) {
    group.adjustments.push(entry)
    return
  }
  group.entries.push(entry)
  group.total++
  if (entry.type === 'despesa') group.despesasTotal += entry.amount
  else group.creditosTotal += entry.amount
  if (entry.status === 'pendente') {
    group.pendingCount++
    group.pendingAmount += entry.amount
  }
}

/** A fatura inteira pertence a UMA competência (o mês do vencimento) — uma
 *  fatura fechada em janeiro tem compras de dezembro, mas continua sendo
 *  uma fatura só, e não pode se espalhar por dois meses na tela. Extrato
 *  bancário (sem vencimento) usa o mês de quando foi importado. */
function competenceKeyFor(importRow: Import | undefined, fallbackEntries: EntryWithSplits[]): string {
  if (importRow?.due_date) return importRow.due_date.slice(0, 7)
  if (importRow?.created_at) return importRow.created_at.slice(0, 7)
  const latest = fallbackEntries.reduce((max, e) => (e.date > max ? e.date : max), fallbackEntries[0]?.date ?? '')
  return latest.slice(0, 7) || 'sem-data'
}

export function groupEntriesByYearMonth(entries: EntryWithSplits[], imports: Import[]): YearGroup[] {
  const importsById = new Map(imports.map((i) => [i.id, i]))
  const monthMap = new Map<string, MonthGroup>()

  const entriesByImport = new Map<string, EntryWithSplits[]>()
  const entriesWithoutImport: EntryWithSplits[] = []
  for (const entry of entries) {
    if (entry.source_import_id) {
      if (!entriesByImport.has(entry.source_import_id)) entriesByImport.set(entry.source_import_id, [])
      entriesByImport.get(entry.source_import_id)!.push(entry)
    } else {
      entriesWithoutImport.push(entry)
    }
  }

  // cada fatura inteira cai numa competência só
  for (const [importId, importEntries] of entriesByImport) {
    const importRow = importsById.get(importId)
    const key = competenceKeyFor(importRow, importEntries)
    if (!monthMap.has(key)) monthMap.set(key, emptyMonthGroup(key))
    const group = monthMap.get(key)!

    group.sources.push({
      importId,
      label: importRow?.card_or_bank_label ?? importRow?.filename ?? 'Fatura removida',
      count: importEntries.length,
    })
    for (const entry of importEntries) addEntryToGroup(group, entry)
  }

  // lançamentos sem fatura vinculada (ex.: previsto confirmado direto, ou
  // a fatura de origem foi excluída) — só o que sobra pra agrupar pela
  // própria data, já que não existe uma competência pra seguir.
  for (const entry of entriesWithoutImport) {
    const key = entry.date.slice(0, 7)
    if (!monthMap.has(key)) monthMap.set(key, emptyMonthGroup(key))
    const group = monthMap.get(key)!
    if (!group.sources.some((s) => s.importId === null)) {
      group.sources.push({ importId: null, label: 'Sem fatura vinculada', count: 0 })
    }
    const noImportSource = group.sources.find((s) => s.importId === null)!
    noImportSource.count++
    addEntryToGroup(group, entry)
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
