import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from './useHousehold'

/** Soma dos rateios (entry_splits) por conta, dentro de um mês (prefixo "yyyy-mm"), só de lançamentos importados já classificados/confirmados. */
export function useAccountTotals(monthPrefix: string) {
  const { household } = useHousehold()
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!household) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('entries')
      .select('amount, type, entry_splits(account_id, amount)')
      .eq('household_id', household.id)
      .eq('kind', 'importado')
      .in('status', ['classificado', 'confirmado'])
      .gte('date', `${monthPrefix}-01`)
      .lt('date', `${monthPrefix}-32`)
      .then(({ data }) => {
        if (cancelled) return
        const acc: Record<string, number> = {}
        for (const entry of data ?? []) {
          for (const split of entry.entry_splits ?? []) {
            acc[split.account_id] = (acc[split.account_id] ?? 0) + split.amount
          }
        }
        setTotals(acc)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [household, monthPrefix])

  return { totals, loading }
}
