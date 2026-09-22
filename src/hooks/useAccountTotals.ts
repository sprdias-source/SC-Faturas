import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from './useHousehold'
import { fetchAllRows } from '../lib/fetchAllRows'

interface SplitRow {
  account_id: string
  amount: number
}
interface EntryRow {
  source_import_id: string | null
  date: string
  entry_splits: SplitRow[] | null
}
interface ImportRow {
  id: string
  due_date: string | null
}

/** Soma dos rateios (entry_splits) por conta, dentro de uma competência
 *  (prefixo "yyyy-mm"), só de lançamentos importados já
 *  classificados/confirmados. Competência é a do VENCIMENTO da fatura de
 *  origem — a mesma regra da tela de Conciliar — e não a data de cada
 *  lançamento: uma fatura pode ter compras parceladas com data de até uns
 *  11 meses atrás, então filtrar por entries.date faria o total do mês
 *  ficar incompleto (parcelas antigas somariam no mês errado). */
export function useAccountTotals(monthPrefix: string) {
  const { household } = useHousehold()
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!household) return
    let cancelled = false
    setLoading(true)

    async function run() {
      const [entries, imports] = await Promise.all([
        fetchAllRows<EntryRow>((from, to) =>
          supabase
            .from('entries')
            .select('source_import_id, date, entry_splits(account_id, amount)')
            .eq('household_id', household!.id)
            .eq('kind', 'importado')
            .in('status', ['classificado', 'confirmado'])
            .range(from, to)
        ),
        fetchAllRows<ImportRow>((from, to) =>
          supabase.from('imports').select('id, due_date').eq('household_id', household!.id).range(from, to)
        ),
      ])
      if (cancelled) return

      const importsById = new Map(imports.map((i) => [i.id, i]))
      const acc: Record<string, number> = {}
      for (const entry of entries) {
        const importRow = entry.source_import_id ? importsById.get(entry.source_import_id) : undefined
        const competence = importRow?.due_date ? importRow.due_date.slice(0, 7) : entry.date.slice(0, 7)
        if (competence !== monthPrefix) continue
        for (const split of entry.entry_splits ?? []) {
          acc[split.account_id] = (acc[split.account_id] ?? 0) + split.amount
        }
      }
      setTotals(acc)
      setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [household, monthPrefix])

  return { totals, loading }
}
