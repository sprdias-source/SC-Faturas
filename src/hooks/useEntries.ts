import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useHousehold } from './useHousehold'
import type { AccountType, Entry, EntryKind, EntrySplit } from '../lib/types'
import type { OfxParsed } from '../lib/ofx'
import { isBankAdjustmentDescription } from '../lib/entryHelpers'

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
    async (
      meta: { filename: string; fileType: 'pdf' | 'ofx'; cardOrBankLabel: string | null; dueDate: string | null },
      parsed: OfxParsed,
      originalFile?: File | null
    ) => {
      if (!household || !user) return { importedCount: 0, matchedCount: 0 }

      // Bloqueia reimportar a MESMA fatura/extrato — nunca deixa passar
      // silenciosamente pra não duplicar o arquivo inteiro. Fatura de
      // cartão identifica pelo vencimento (é o dado mais estável entre
      // dois PDFs do mesmo período); sem vencimento (extrato OFX), usa o
      // nome do arquivo como impressão digital.
      const label = meta.cardOrBankLabel ?? parsed.bankLabel
      let dupQuery = supabase.from('imports').select('id, filename, due_date, card_or_bank_label, entries_count, created_at').eq('household_id', household.id)
      dupQuery = meta.dueDate ? dupQuery.eq('due_date', meta.dueDate) : dupQuery.eq('filename', meta.filename)
      const { data: possibleDupes } = await dupQuery
      const dupe = meta.dueDate
        ? possibleDupes?.find((i) => (i.card_or_bank_label ?? '') === (label ?? '') || i.filename === meta.filename)
        : possibleDupes?.[0]
      if (dupe) {
        const when = new Date(dupe.created_at).toLocaleDateString('pt-BR')
        throw new Error(
          `Essa fatura já foi importada em ${when} ("${dupe.filename}", ${dupe.entries_count} lançamentos${dupe.due_date ? `, vencimento ${new Date(dupe.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}). Exclua a importação antiga em "Importações" antes de importar de novo, se quiser substituir.`
        )
      }

      const { data: importRow, error: impErr } = await supabase
        .from('imports')
        .insert({
          household_id: household.id,
          filename: meta.filename,
          file_type: meta.fileType,
          card_or_bank_label: label,
          due_date: meta.dueDate,
          total_amount: parsed.totalAmount,
          entries_count: parsed.entries.length,
          imported_by: user.id,
        })
        .select()
        .single()
      if (impErr) throw impErr

      // Guarda o arquivo original (se ele ainda estiver disponível — some
      // se a página recarregou entre importar e confirmar) pra dar pra
      // ver/baixar depois na lista de importações.
      if (originalFile) {
        const path = `${household.id}/${importRow.id}-${originalFile.name}`
        const { error: upErr } = await supabase.storage.from('imports').upload(path, originalFile, {
          contentType: originalFile.type || undefined,
        })
        if (!upErr) await supabase.from('imports').update({ storage_path: path }).eq('id', importRow.id)
      }

      // Cada linha do arquivo é única daquela fatura por definição — duas
      // compras reais podem ter data+valor+descrição iguais (dois cafés
      // no mesmo lugar no mesmo dia), então NÃO comparamos lançamento
      // com lançamento aqui. A proteção contra duplicata é só a checagem
      // de fatura já importada, acima.
      let matchedCount = 0
      for (const e of parsed.entries) {
        // "Pagamento ..." = quitação da fatura anterior debitada em conta,
        // não é receita pra categorizar — entra direto como confirmado,
        // sem conta/rateio e sem tentar casar com um previsto.
        if (e.isCredit && isBankAdjustmentDescription(e.description)) {
          const { error: payErr } = await supabase.from('entries').insert({
            household_id: household.id,
            kind: 'importado',
            date: e.date,
            description: e.description,
            amount: e.amount,
            type: 'receita',
            status: 'confirmado',
            source_import_id: importRow.id,
            created_by: user.id,
          })
          if (payErr) throw payErr
          continue
        }

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

      const importedCount = parsed.entries.length
      await logActivity(
        household.id,
        user.id,
        'imported_file',
        `importou "${meta.filename}" — ${importedCount} lançamentos${matchedCount ? `, ${matchedCount} já casaram com previstos` : ''}`
      )

      return { importedCount, matchedCount }
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
