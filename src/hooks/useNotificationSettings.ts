import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useHousehold } from './useHousehold'
import type { NotificationSettings } from '../lib/types'

const DEFAULTS: Omit<NotificationSettings, 'user_id' | 'household_id' | 'updated_at'> = {
  notify_visual: true,
  notify_sound: false,
  notify_only_new: true,
}

export function useNotificationSettings() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user || !household) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase.from('notification_settings').select('*').eq('user_id', user.id).maybeSingle()
    if (data) {
      setSettings(data as NotificationSettings)
    } else {
      const { data: created } = await supabase
        .from('notification_settings')
        .insert({ user_id: user.id, household_id: household.id, ...DEFAULTS })
        .select()
        .single()
      setSettings(created as NotificationSettings)
    }
    setLoading(false)
  }, [user, household])

  useEffect(() => {
    load()
  }, [load])

  const update = useCallback(
    async (patch: Partial<Pick<NotificationSettings, 'notify_visual' | 'notify_sound' | 'notify_only_new'>>) => {
      if (!user) return
      setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
      const { error } = await supabase
        .from('notification_settings')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
      if (error) throw error
    },
    [user]
  )

  return { settings, loading, update }
}
