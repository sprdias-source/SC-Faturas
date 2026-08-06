import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useHousehold } from './useHousehold'
import type { AccountType, Entry, EntryKind, EntrySplit } from '../lib/types'
import type { OfxParsed } from '../lib/ofx'

export interface SplitInput {
  account_id: string
  percent: number
  amount: number
}

export interface EntryWithSplits extends Entry {
  entry_splits: EntrySplit[]
}

async function logActivity(householdId: string, userId: string, action: string, detail: string) {
  await supabase.from('activity_log').insert({ household_id: householdId, user_id: userId, action, detail })
}

async function saveSplits(entryId: string, splits: SplitInput[]) {
  await supabase.from('entry_splits').delete().eq('entry_id', entryId)
  if (splits.length === 0) return
  const { error } = await supabase.from('entry_splits').insert(
    splits.map((s) => ({ entry_id: entryId, account_id: s.account_id, percent: s.percent, amount: s.amount }))
  )
  if (error) throw error
}

export function useEntries(kind: EntryKind | 'todos' = 'todos') {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [entries, setEntries] = useState<EntryWithSplits[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!household) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase
      .from('entries')
      .select('*, entry_splits(*)')
      .eq('household_id', household.id)
      .order('date', { ascending: false })
    if (kind !== 'todos') query = query.eq('kind', kind)
    const { data } = await query
    setEntries((data ?? []) as EntryWithSplits[])
    setLoading(false)
  }, [household, kind])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!household) return
    const channel = supabase
      .channel(`entries-${household.id}-${kind}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries', filter: `household_id=eq.${household.id}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entry_splits' },
        () => load()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [household, kind, load])

  const createManualEntry = useCallback(
    async (input: { date: string; description: string; amount: number; type: AccountType; splits: SplitInput[] }) => {
      if (!household || !user) return
      const { data: entry, error } = await supabase
        .from('entries')
        .insert({
          household_id: household.id,
          kind: 'previsto',
          date: input.date,
          description: input.description,
          amount: input.amount,
          type: input.type,
          status: input.splits.length > 0 ? 'classificado' : 'pendente',
          created_by: user.id,
        })
        .select()
        .single()
      if (error) throw error
      if (input.splits.length > 0) await saveSplits(entry.id, input.splits)

      const label = input.splits.length > 1 ? `, rateado em ${input.splits.length} contas` : ''
      await logActivity(household.id, user.id, 'created_planned', `cadastrou o lançamento previsto "${input.description}"${label}`)
    },
    [household, user]
  )

  const importFile = useCallback(
    async (meta: { filename: string; fileType: 'pdf' | 'ofx'; cardOrBankLabel: string | null; dueDate: string | null }, parsed: OfxParsed) => {
      if (!household || !user) return { importedCount: 0, matchedCount: 0, skippedCount: 0 }
      const { data: importRow, error: impErr } = await supabase
        .from('imports')
        .insert({
          household_id: household.id,
          filename: meta.filename,
          file_type: meta.fileType,
          card_or_bank_label: meta.cardOrBankLabel ?? parsed.bankLabel,
          due_date: meta.dueDate,
          total_amount: parsed.totalAmount,
          entries_count: parsed.entries.length,
          imported_by: user.id,
        })
        .select()
        .single()
      if (impErr) throw impErr

      // Dedup: mesma data + valor + descrição já importado antes (ex.: o
      // mesmo arquivo enviado de novo) não gera lançamento duplicado.
      const dates = parsed.entries.map((e) => e.date).sort()
      const { data: existing } = await supabase
        .from('entries')
        .select('date, amount, description')
        .eq('household_id', household.id)
        .eq('kind', 'importado')
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1])
      const seenKeys = new Set((existing ?? []).map((e) => `${e.date}|${e.amount}|${e.description}`))

      let matchedCount = 0
      let skippedCount = 0
      for (const e of parsed.entries) {
        const key = `${e.date}|${e.amount}|${e.description}`
        if (seenKeys.has(key)) {
          skippedCount++
          continue
        }
        seenKeys.add(key)

        const { data: candidate } = await supabase
          .from('entries')
          .select('*, entry_splits(*)')
          .eq('household_id', household.id)
          .eq('kind', 'previsto')
          .eq('date', e.date)
          .eq('amount', e.amount)
          .is('matched_entry_id', null)
          .limit(1)
          .maybeSingle()

        const { data: newEntry, error: insErr } = await supabase
          .from('entries')
          .insert({
            household_id: household.id,
            kind: 'importado',
            date: e.date,
            description: e.description,
            amount: e.amount,
            type: e.isCredit ? 'receita' : 'despesa',
            status: candidate ? 'classificado' : 'pendente',
            source_import_id: importRow.id,
            matched_entry_id: candidate?.id ?? null,
            created_by: user.id,
          })
          .select()
          .single()
        if (insErr) throw insErr

        if (candidate) {
          matchedCount++
          const splits = (candidate as EntryWithSplits).entry_splits
          if (splits.length > 0) await saveSplits(newEntry.id, splits.map((s) => ({ account_id: s.account_id, percent: s.percent, amount: s.amount })))
          await supabase.from('entries').update({ matched_entry_id: newEntry.id }).eq('id', candidate.id)
        }
      }

      const importedCount = parsed.entries.length - skippedCount
      await logActivity(
        household.id,
        user.id,
        'imported_file',
        `importou "${meta.filename}" — ${importedCount} lançamentos${matchedCount ? `, ${matchedCount} já casaram com previstos` : ''}${skippedCount ? `, ${skippedCount} ignorados por já existirem` : ''}`
      )

      return { importedCount, matchedCount, skippedCount }
    },
    [household, user]
  )

  const classifyEntry = useCallback(
    async (entryId: string, splits: SplitInput[], description?: string) => {
      if (!household || !user) return
      await saveSplits(entryId, splits)
      await supabase.from('entries').update({ status: 'classificado', updated_at: new Date().toISOString() }).eq('id', entryId)
      const label = splits.length > 1 ? `rateou "${description ?? 'um lançamento'}" em ${splits.length} contas` : `classificou "${description ?? 'um lançamento'}"`
      await logActivity(household.id, user.id, 'classified_entry', label)
    },
    [household, user]
  )

  const confirmEntry = useCallback(
    async (entryId: string, description?: string) => {
      if (!household || !user) return
      const { data: entry } = await supabase.from('entries').select('matched_entry_id').eq('id', entryId).single()
      await supabase.from('entries').update({ status: 'confirmado', updated_at: new Date().toISOString() }).eq('id', entryId)
      if (entry?.matched_entry_id) {
        await supabase.from('entries').update({ status: 'confirmado' }).eq('id', entry.matched_entry_id)
      }
      await logActivity(household.id, user.id, 'confirmed_entry', `confirmou "${description ?? 'um lançamento'}"`)
    },
    [household, user]
  )

  const deleteEntry = useCallback(async (entryId: string) => {
    await supabase.from('entries').delete().eq('id', entryId)
  }, [])

  return { entries, loading, createManualEntry, importFile, classifyEntry, confirmEntry, deleteEntry, refresh: load }
}
