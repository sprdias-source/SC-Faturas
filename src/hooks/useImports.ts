import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useHousehold } from './useHousehold'
import type { Import } from '../lib/types'

export function useImports() {
  const { household } = useHousehold()
  const { user } = useAuth()
  const [imports, setImports] = useState<Import[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!household) {
      setImports([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('imports')
      .select('*')
      .eq('household_id', household.id)
      .order('due_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    setImports((data ?? []) as Import[])
    setLoading(false)
  }, [household])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!household) return
    const channel = supabase
      .channel(`imports-${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'imports', filter: `household_id=eq.${household.id}` }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [household, load])

  const viewImport = useCallback(async (imp: Import) => {
    if (!imp.storage_path) throw new Error('Esse arquivo não foi guardado (foi importado antes dessa função existir, ou a página recarregou no meio da importação).')
    const { data, error } = await supabase.storage.from('imports').createSignedUrl(imp.storage_path, 60)
    if (error) throw error
    window.open(data.signedUrl, '_blank')
  }, [])

  const deleteImport = useCallback(
    async (imp: Import) => {
      if (!household || !user) return
      const { count } = await supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('source_import_id', imp.id)
      await supabase.from('entries').delete().eq('source_import_id', imp.id)
      if (imp.storage_path) await supabase.storage.from('imports').remove([imp.storage_path])
      await supabase.from('imports').delete().eq('id', imp.id)
      await supabase.from('activity_log').insert({
        household_id: household.id,
        user_id: user.id,
        action: 'deleted_import',
        detail: `excluiu a importação "${imp.filename}"${count ? ` e seus ${count} lançamentos` : ''}`,
      })
    },
    [household, user]
  )

  return { imports, loading, viewImport, deleteImport, refresh: load }
}
