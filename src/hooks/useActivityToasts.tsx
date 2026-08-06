import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useHousehold } from './useHousehold'
import { useNotificationSettings } from './useNotificationSettings'
import { playAlertBeep } from '../lib/sound'
import type { ActivityLogRow } from '../lib/types'

interface ToastItem {
  id: string
  authorName: string
  authorColor: string
  detail: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  dismiss: (id: string) => void
  testSound: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const NEW_ACTIONS = new Set(['created_planned', 'imported_file', 'created_account'])

export function ActivityToastProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { household, members } = useHousehold()
  const { settings } = useNotificationSettings()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const membersRef = useRef(members)
  membersRef.current = members

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    if (!household || !user) return
    const channel = supabase
      .channel(`activity-toasts-${household.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `household_id=eq.${household.id}` },
        (payload) => {
          const row = payload.new as ActivityLogRow
          if (row.user_id === user.id) return // não avisa sobre a própria ação

          const s = settingsRef.current
          if (!s || !s.notify_visual) return
          if (s.notify_only_new && !NEW_ACTIONS.has(row.action)) return

          const author = membersRef.current.find((m) => m.user_id === row.user_id)
          const item: ToastItem = {
            id: row.id,
            authorName: author?.display_name ?? 'Alguém',
            authorColor: author?.avatar_color ?? '#2d3f6b',
            detail: row.detail ?? row.action,
          }
          setToasts((prev) => [...prev, item])
          if (s.notify_sound) playAlertBeep()
          window.setTimeout(() => dismiss(item.id), 8000)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [household, user, dismiss])

  return (
    <ToastContext.Provider value={{ toasts, dismiss, testSound: playAlertBeep }}>{children}</ToastContext.Provider>
  )
}

export function useActivityToasts() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useActivityToasts precisa estar dentro de <ActivityToastProvider>')
  return ctx
}
