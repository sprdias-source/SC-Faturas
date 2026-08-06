import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { HouseholdMember } from '../lib/types'

interface HouseholdInfo {
  id: string
  name: string
  invite_code: string
}

interface HouseholdContextValue {
  loading: boolean
  household: HouseholdInfo | null
  members: HouseholdMember[]
  me: HouseholdMember | null
  createHousehold: (name: string, displayName: string, color: string) => Promise<void>
  joinHousehold: (code: string, displayName: string, color: string) => Promise<void>
  refresh: () => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [household, setHousehold] = useState<HouseholdInfo | null>(null)
  const [members, setMembers] = useState<HouseholdMember[]>([])

  const load = useCallback(async () => {
    if (!user) {
      setHousehold(null)
      setMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data: myMembership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!myMembership) {
      setHousehold(null)
      setMembers([])
      setLoading(false)
      return
    }

    const [{ data: h }, { data: mem }] = await Promise.all([
      supabase.from('households').select('id, name, invite_code').eq('id', myMembership.household_id).single(),
      supabase.from('household_members').select('*').eq('household_id', myMembership.household_id),
    ])

    setHousehold(h as HouseholdInfo)
    setMembers((mem ?? []) as HouseholdMember[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!household) return
    const channel = supabase
      .channel(`household-members-${household.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${household.id}` },
        () => load()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [household, load])

  const createHousehold = useCallback(
    async (name: string, displayName: string, color: string) => {
      if (!user) return
      const { data: h, error } = await supabase.from('households').insert({ name }).select().single()
      if (error) throw error
      const { error: memErr } = await supabase
        .from('household_members')
        .insert({ household_id: h.id, user_id: user.id, display_name: displayName, avatar_color: color })
      if (memErr) throw memErr
      await load()
    },
    [user, load]
  )

  const joinHousehold = useCallback(
    async (code: string, displayName: string, color: string) => {
      const { error } = await supabase.rpc('join_household', {
        p_code: code.trim().toLowerCase(),
        p_display_name: displayName,
        p_avatar_color: color,
      })
      if (error) throw error
      await load()
    },
    [load]
  )

  const me = members.find((m) => m.user_id === user?.id) ?? null

  return (
    <HouseholdContext.Provider value={{ loading, household, members, me, createHousehold, joinHousehold, refresh: load }}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold precisa estar dentro de <HouseholdProvider>')
  return ctx
}
