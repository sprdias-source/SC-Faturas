import { useMemo, useState } from 'react'
import { Check, Percent } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { Button, Card, KpiCard, Pill } from '../components/ui'
import { AccountSelect } from '../components/AccountSelect'
import { SplitEditor } from '../components/SplitEditor'
import { useAccounts } from '../hooks/useAccounts'
import { useEntries, type SplitInput } from '../hooks/useEntries'
import { formatBRL, formatDateShort } from '../lib/format'

export function ReconcilePage() {
  const { accounts } = useAccounts()
  const { entries, classifyEntry, confirmEntry } = useEntries('importado')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openSplit, setOpenSplit] = useState<Set<string>>(new Set())
  const [draftSplits, setDraftSplits] = useState<Record<string, SplitInput[]>>({})
  const [bulkAccount, setBulkAccount] = useState('')

  const despesasTotal = entries.filter((e) => e.type === 'despesa').reduce((s, e) => s + e.amount, 0)
  const creditosTotal = entries.filter((e) => e.type === 'receita').reduce((s, e) => s + e.amount, 0)
  const pendingCount = entries.filter((e) => e.status === 'pendente').length
  const pendingAmount = entries.filter((e) => e.status === 'pendente').reduce((s, e) => s + e.amount, 0)

  const selectedTotal = useMemo(() => entries.filter((e) => selected.has(e.id)).reduce((s, e) => s + e.amount, 0), [entries, selected])

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSplitEditor(entry: (typeof entries)[number]) {
    setOpenSplit((prev) => {
      const next = new Set(prev)
      if (next.has(entry.id)) {
        next.delete(entry.id)
      } else {
        next.add(entry.id)
        if (!draftSplits[entry.id]) {
          const initial = entry.entry_splits.length > 0
            ? entry.entry_splits.map((s) => ({ account_id: s.account_id, percent: s.percent, amount: s.amount }))
            : [{ account_id: accounts[0]?.id ?? '', percent: 100, amount: entry.amount }]
          setDraftSplits((d) => ({ ...d, [entry.id]: initial }))
        }
      }
      return next
    })
  }

  async function quickClassify(entryId: string, accountId: string, amount: number) {
    await classifyEntry(entryId, [{ account_id: accountId, percent: 100, amount }])
  }

  async function saveSplit(entry: (typeof entries)[number]) {
    const splits = draftSplits[entry.id]
    if (!splits) return
    await classifyEntry(entry.id, splits, entry.description)
    setOpenSplit((prev) => {
      const next = new Set(prev)
      next.delete(entry.id)
      return next
    })
  }

  async function applyBulk() {
    if (!bulkAccount) return
    for (const entry of entries) {
      if (selected.has(entry.id)) await quickClassify(entry.id, bulkAccount, entry.amount)
    }
    setSelected(new Set())
    setBulkAccount('')
  }

  return (
    <div className="pb-32">
      <TopBar title="Conciliar lançamentos" subtitle="Classifique, confirme os que já casaram, ou rateie entre contas" />

      <div className="px-4">
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <KpiCard label="Despesas" value={formatBRL(despesasTotal)} sub={`${entries.filter((e) => e.type === 'despesa').length} lançamentos`} />
          <KpiCard label="Pagamentos/créditos" value={formatBRL(creditosTotal)} tone="positive" sub={`${entries.filter((e) => e.type === 'receita').length} lançamentos`} />
          <KpiCard label="A classificar" value={formatBRL(pendingAmount)} tone="warning" sub={`${pendingCount} pendentes`} />
          <KpiCard label="Total de lançamentos" value={String(entries.length)} />
        </div>

        <Card className="p-3">
          {entries.length === 0 ? (
            <p className="text-[12.5px] text-text-faint py-6 text-center">Nada importado ainda — vá em "Importar" pra trazer uma fatura ou extrato.</p>
          ) : (
            <div className="flex flex-col">
              {entries.map((entry) => {
                const isMatched = !!entry.matched_entry_id
                const isConfirmed = entry.status === 'confirmado'
                const isClassified = entry.status !== 'pendente'
                const rowBg = isConfirmed ? 'bg-positive-soft/60' : isMatched && isClassified ? 'bg-positive-soft/60' : ''
                const splitOpen = openSplit.has(entry.id)

                return (
                  <div key={entry.id} className={`border-b border-dashed border-border last:border-none ${rowBg} rounded-lg`}>
                    <div className="flex items-center gap-2.5 py-2.5 px-1">
                      <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggleSelected(entry.id)} className="w-4 h-4 accent-accent flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[12.5px] font-bold truncate">{entry.description}</span>
                          <span className="font-mono text-[12.5px] flex-shrink-0">{formatBRL(entry.amount)}</span>
                        </div>
                        <div className="text-[11px] text-text-faint">{formatDateShort(entry.date)}</div>

                        {!isClassified && (
                          <div className="mt-1.5">
                            <AccountSelect accounts={accounts} value="" onChange={(id) => quickClassify(entry.id, id, entry.amount)} />
                          </div>
                        )}

                        {isClassified && (
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            <Pill tone={isConfirmed ? 'positive' : isMatched ? 'positive' : 'accent'}>
                              {entry.entry_splits.length > 1 ? `Rateado · ${entry.entry_splits.length} contas` : accounts.find((a) => a.id === entry.entry_splits[0]?.account_id)?.name ?? 'Classificado'}
                            </Pill>
                            {isMatched && !isConfirmed && <span className="text-[10.5px] text-text-faint">casou com previsto</span>}
                            {!isConfirmed && (
                              <button onClick={() => confirmEntry(entry.id, entry.description)} className="text-[10.5px] font-extrabold uppercase bg-positive-soft text-positive border border-positive/40 rounded-md px-2 py-1 inline-flex items-center gap-1">
                                <Check size={11} /> Confirmar
                              </button>
                            )}
                            {isConfirmed && <Pill tone="positive">Confirmado</Pill>}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleSplitEditor(entry)}
                        className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${splitOpen ? 'bg-accent-soft border border-accent text-accent-strong' : 'border border-dashed border-border-strong text-text-faint'}`}
                        title="Ratear entre contas"
                      >
                        <Percent size={13} />
                      </button>
                    </div>

                    {splitOpen && draftSplits[entry.id] && (
                      <div className="pb-3 px-1">
                        <SplitEditor
                          accounts={accounts}
                          totalAmount={entry.amount}
                          value={draftSplits[entry.id]}
                          onChange={(s) => setDraftSplits((d) => ({ ...d, [entry.id]: s }))}
                        />
                        <Button variant="primary" className="w-full justify-center mt-2" onClick={() => saveSplit(entry)}>
                          Salvar rateio
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {selected.size > 0 && (
        <div className="fixed left-0 right-0 z-40 px-3" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)' }}>
          <div className="max-w-lg mx-auto bg-surface border-[1.5px] border-accent rounded-xl p-3 shadow-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between text-[12px]">
              <span>
                <b className="text-accent-strong">{selected.size}</b> selecionados
              </span>
              <span className="font-mono font-bold">{formatBRL(selectedTotal)}</span>
            </div>
            <div className="flex gap-2">
              <AccountSelect accounts={accounts} value={bulkAccount} onChange={setBulkAccount} className="flex-1" />
              <Button variant="primary" onClick={applyBulk} disabled={!bulkAccount}>
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
