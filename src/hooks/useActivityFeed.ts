import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from './useHousehold'
import type { ActivityLogRow } from '../lib/types'

export function useActivityFeed(limit = 12) {
  const { household } = useHousehold()
  const [items, setItems] = useState<ActivityLogRow[]>([])

  const load = useCallback(async () => {
    if (!household) return
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false })
      .limit(limit)
    setItems((data ?? []) as ActivityLogRow[])
  }, [household, limit])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!household) return
    const channel = supabase
      .channel(`activity-feed-${household.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `household_id=eq.${household.id}` }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [household, load])

  return items
}
