import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useHousehold } from './useHousehold'
import type { Account, AccountType } from '../lib/types'

export interface AccountNode extends Account {
  children: AccountNode[]
}

export function buildAccountTree(accounts: Account[]): AccountNode[] {
  const byId = new Map<string, AccountNode>(accounts.map((a) => [a.id, { ...a, children: [] }]))
  const roots: AccountNode[] = []
  for (const acc of byId.values()) {
    if (acc.parent_id && byId.has(acc.parent_id)) {
      byId.get(acc.parent_id)!.children.push(acc)
    } else {
      roots.push(acc)
    }
  }
  return roots
}

export function useAccounts() {
  const { household } = useHousehold()
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!household) {
      setAccounts([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('household_id', household.id)
      .order('name')
    setAccounts((data ?? []) as Account[])
    setLoading(false)
  }, [household])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!household) return
    const channel = supabase
      .channel(`accounts-${household.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts', filter: `household_id=eq.${household.id}` },
        () => load()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [household, load])

  const createAccount = useCallback(
    async (name: string, type: AccountType, parentId: string | null, color: string) => {
      if (!household || !user) return
      const { error } = await supabase
        .from('accounts')
        .insert({ household_id: household.id, name, type, parent_id: parentId, color })
      if (error) throw error

      let detail = `cadastrou a conta "${name}"`
      if (parentId) {
        const parent = accounts.find((a) => a.id === parentId)
        detail = `cadastrou a subconta "${name}"${parent ? ` dentro de ${parent.name}` : ''}`
      }
      await supabase.from('activity_log').insert({ household_id: household.id, user_id: user.id, action: 'created_account', detail })
    },
    [household, user, accounts]
  )

  const updateAccount = useCallback(async (id: string, patch: Partial<Pick<Account, 'name' | 'type' | 'color' | 'parent_id'>>) => {
    const { error } = await supabase.from('accounts').update(patch).eq('id', id)
    if (error) throw error
  }, [])

  const deleteAccount = useCallback(async (id: string) => {
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) throw error
  }, [])

  return { accounts, tree: buildAccountTree(accounts), loading, createAccount, updateAccount, deleteAccount, refresh: load }
}
