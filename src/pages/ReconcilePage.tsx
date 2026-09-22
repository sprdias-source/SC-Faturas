import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, ChevronRight, Percent } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { Button, Card, Pill } from '../components/ui'
import { AccountSelect } from '../components/AccountSelect'
import { SplitEditor, defaultSplitFor } from '../components/SplitEditor'
import { useAccounts } from '../hooks/useAccounts'
import { useEntries, type EntryWithSplits, type SplitInput } from '../hooks/useEntries'
import { useImports } from '../hooks/useImports'
import { formatBRL, formatDateShort } from '../lib/format'
import { groupEntriesByYearMonth, type MonthGroup } from '../lib/groupEntries'

export function ReconcilePage() {
  const { accounts } = useAccounts()
  const { entries: allEntries, classifyEntry, confirmEntry } = useEntries('importado')
  const { imports } = useImports()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openSplit, setOpenSplit] = useState<Set<string>>(new Set())
  const [draftSplits, setDraftSplits] = useState<Record<string, SplitInput[]>>({})
  const [bulkAccount, setBulkAccount] = useState('')
  const [bulkMode, setBulkMode] = useState<'single' | 'split'>('single')
  const [bulkSplits, setBulkSplits] = useState<SplitInput[]>([])

  const [openYears, setOpenYears] = useState<Set<string>>(new Set())
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  const defaultsSeeded = useRef(false)

  const years = useMemo(() => groupEntriesByYearMonth(allEntries, imports), [allEntries, imports])

  // Ano corrente (o mais recente com lançamentos) abre sozinho, com o mês
  // mais recente que ainda tem pendência já expandido — anos/meses 100%
  // resolvidos começam fechados pra não disputar atenção. Só roda uma vez,
  // pra não fechar de novo algo que o usuário abriu manualmente depois.
  useEffect(() => {
    if (defaultsSeeded.current || years.length === 0) return
    defaultsSeeded.current = true
    const latestYear = years[0]
    setOpenYears(new Set([latestYear.year]))
    const monthToOpen = latestYear.months.find((m) => m.pendingCount > 0) ?? latestYear.months[0]
    if (monthToOpen) setOpenMonths(new Set([monthToOpen.key]))
  }, [years])

  const selectedTotal = useMemo(
    () => years.flatMap((y) => y.months).flatMap((m) => m.entries).filter((e) => selected.has(e.id)).reduce((s, e) => s + e.amount, 0),
    [years, selected]
  )

  function toggleYear(year: string) {
    setOpenYears((prev) => {
      const next = new Set(prev)
      next.has(year) ? next.delete(year) : next.add(year)
      return next
    })
  }

  function toggleMonth(key: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSplitEditor(entry: EntryWithSplits) {
    setOpenSplit((prev) => {
      const next = new Set(prev)
      if (next.has(entry.id)) {
        next.delete(entry.id)
      } else {
        next.add(entry.id)
        if (!draftSplits[entry.id]) {
          const initial = entry.entry_splits.length > 0
            ? entry.entry_splits.map((s) => ({ account_id: s.account_id, percent: s.percent, amount: s.amount }))
            : defaultSplitFor(accounts, entry.amount)
          setDraftSplits((d) => ({ ...d, [entry.id]: initial }))
        }
      }
      return next
    })
  }

  async function quickClassify(entryId: string, accountId: string, amount: number) {
    await classifyEntry(entryId, [{ account_id: accountId, percent: 100, amount }])
  }

  async function saveSplit(entry: EntryWithSplits) {
    const splits = draftSplits[entry.id]
    if (!splits) return
    await classifyEntry(entry.id, splits, entry.description)
    setOpenSplit((prev) => {
      const next = new Set(prev)
      next.delete(entry.id)
      return next
    })
  }

  function openBulkSplit() {
    setBulkMode('split')
    if (bulkSplits.length === 0) setBulkSplits(defaultSplitFor(accounts, selectedTotal))
  }

  async function applyBulk() {
    const targets = years.flatMap((y) => y.months).flatMap((m) => m.entries).filter((e) => selected.has(e.id))
    if (bulkMode === 'single') {
      if (!bulkAccount) return
      for (const entry of targets) await quickClassify(entry.id, bulkAccount, entry.amount)
    } else {
      if (bulkSplits.length === 0) return
      // Mesma % de cada linha aplicada ao valor de CADA lançamento
      // selecionado — não divide o total do lote, divide cada um deles.
      for (const entry of targets) {
        const splits = bulkSplits.map((s) => ({ account_id: s.account_id, percent: s.percent, amount: +((entry.amount * s.percent) / 100).toFixed(2) }))
        await classifyEntry(entry.id, splits)
      }
    }
    setSelected(new Set())
    setBulkAccount('')
    setBulkMode('single')
    setBulkSplits([])
  }

  function renderEntryRow(entry: EntryWithSplits) {
    const isMatched = !!entry.matched_entry_id
    const isConfirmed = entry.status === 'confirmado'
    const isClassified = entry.status !== 'pendente'
    const rowBg = isConfirmed || (isMatched && isClassified) ? 'bg-positive-soft/60' : ''
    const splitOpen = openSplit.has(entry.id)

    return (
      <div key={entry.id} className={clsx('border-b border-dashed border-border last:border-none rounded-lg', rowBg)}>
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
            className={clsx(
              'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
              splitOpen ? 'bg-accent-soft border border-accent text-accent-strong' : 'border border-dashed border-border-strong text-text-faint'
            )}
            title="Ratear entre contas"
          >
            <Percent size={13} />
          </button>
        </div>

        {splitOpen && draftSplits[entry.id] && (
          <div className="pb-3 px-1">
            <SplitEditor accounts={accounts} totalAmount={entry.amount} value={draftSplits[entry.id]} onChange={(s) => setDraftSplits((d) => ({ ...d, [entry.id]: s }))} />
            <Button variant="primary" className="w-full justify-center mt-2" onClick={() => saveSplit(entry)}>
              Salvar rateio
            </Button>
          </div>
        )}
      </div>
    )
  }

  function renderMonth(month: MonthGroup) {
    const isOpen = openMonths.has(month.key)
    const isDone = month.pendingCount === 0

    return (
      <div key={month.key} className="ml-4 border border-border rounded-xl bg-surface overflow-hidden">
        <button onClick={() => toggleMonth(month.key)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
          <ChevronRight size={15} className={clsx('text-text-faint transition-transform flex-shrink-0', isOpen && 'rotate-90 text-accent-strong')} />
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-[13.5px]">{month.monthName}</div>
            <div className="text-[10.5px] text-text-faint truncate">{month.sources.map((s) => `${s.label} · ${s.count}`).join(' + ')}</div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <Pill tone={isDone ? 'positive' : 'warning'}>{isDone ? 'Completo' : `${month.pendingCount} pendentes`}</Pill>
            <span className="font-mono text-[11.5px] font-bold">{formatBRL(month.despesasTotal)}</span>
          </div>
        </button>

        {isOpen && (
          <div className="px-3 pb-3 pt-1 bg-surface-2 border-t border-border">
            {month.sources.length > 1 && (
              <div className="flex gap-1.5 flex-wrap mb-2.5">
                {month.sources.map((s) => (
                  <span key={s.importId ?? 'sem-fatura'} className="text-[10px] font-bold text-text-muted bg-surface border border-border-strong rounded-full px-2.5 py-1">
                    {s.label} · {s.count}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 mb-2.5">
              <div className="rounded-lg p-2.5 bg-surface border border-border">
                <div className="text-[9px] font-bold uppercase tracking-wide text-text-faint">Despesas</div>
                <div className="font-mono font-extrabold text-[14.5px]">{formatBRL(month.despesasTotal)}</div>
              </div>
              <div className="rounded-lg p-2.5 bg-surface border border-border">
                <div className="text-[9px] font-bold uppercase tracking-wide text-text-faint">Pagamentos/créditos</div>
                <div className="font-mono font-extrabold text-[14.5px] text-positive">{formatBRL(month.creditosTotal)}</div>
              </div>
              <div className="rounded-lg p-2.5 bg-surface border border-border">
                <div className="text-[9px] font-bold uppercase tracking-wide text-text-faint">A classificar</div>
                <div className="font-mono font-extrabold text-[14.5px] text-warning">{formatBRL(month.pendingAmount)}</div>
              </div>
              <div className="rounded-lg p-2.5 bg-surface border border-border">
                <div className="text-[9px] font-bold uppercase tracking-wide text-text-faint">Total líquido</div>
                <div className="font-mono font-extrabold text-[14.5px]">{formatBRL(month.despesasTotal - month.creditosTotal)}</div>
              </div>
            </div>

            {month.adjustments.length > 0 && (
              <div className="p-2.5 rounded-lg bg-surface border border-dashed border-border-strong mb-2.5">
                {month.adjustments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-[11px] text-text-muted py-0.5">
                    <span>{a.description} · {formatDateShort(a.date)}</span>
                    <span className="font-mono font-bold text-text flex-shrink-0">{formatBRL(a.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {month.entries.length === 0 ? (
              <p className="text-[12px] text-text-faint text-center py-3">Só ajustes de banco neste mês — nada pra classificar.</p>
            ) : (
              <div className="bg-surface border border-border rounded-lg px-2.5">{month.entries.map(renderEntryRow)}</div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="pb-32">
      <TopBar title="Conciliar lançamentos" subtitle="Organizado por ano e mês — abra o que quiser classificar" />

      <div className="px-4 flex flex-col gap-2.5">
        {years.length === 0 ? (
          <Card className="p-3">
            <p className="text-[12.5px] text-text-faint py-6 text-center">Nada importado ainda — vá em "Importar" pra trazer uma fatura ou extrato.</p>
          </Card>
        ) : (
          years.map((year) => {
            const isOpen = openYears.has(year.year)
            const isDone = year.pendingCount === 0
            return (
              <div key={year.year} className="border border-border-strong rounded-2xl bg-surface-2 overflow-hidden">
                <button onClick={() => toggleYear(year.year)} className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left">
                  <ChevronRight size={18} className={clsx('text-text-faint transition-transform flex-shrink-0', isOpen && 'rotate-90 text-accent-strong')} />
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-[17px]">{year.year}</div>
                    <div className="text-[11px] text-text-faint">{year.months.length} {year.months.length === 1 ? 'mês com lançamentos' : 'meses com lançamentos'}</div>
                  </div>
                  <Pill tone={isDone ? 'positive' : 'warning'}>{isDone ? 'Tudo resolvido' : `${year.pendingCount} pendentes`}</Pill>
                </button>
                {isOpen && <div className="px-2.5 pb-2.5 flex flex-col gap-2">{year.months.map(renderMonth)}</div>}
              </div>
            )
          })
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed left-0 right-0 z-40 px-3" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)' }}>
          <div className="max-w-lg mx-auto bg-surface border-[1.5px] border-accent rounded-xl p-3 shadow-2xl flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between text-[12px]">
              <span>
                <b className="text-accent-strong">{selected.size}</b> selecionados
              </span>
              <span className="font-mono font-bold">{formatBRL(selectedTotal)}</span>
            </div>

            <div className="flex border border-border-strong rounded-md overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => setBulkMode('single')}
                className={clsx('text-[10.5px] font-bold px-2.5 py-1', bulkMode === 'single' ? 'bg-accent text-surface' : 'text-text-faint')}
              >
                Uma conta
              </button>
              <button type="button" onClick={openBulkSplit} className={clsx('text-[10.5px] font-bold px-2.5 py-1', bulkMode === 'split' ? 'bg-accent text-surface' : 'text-text-faint')}>
                Ratear
              </button>
            </div>

            {bulkMode === 'single' ? (
              <div className="flex gap-2">
                <AccountSelect accounts={accounts} value={bulkAccount} onChange={setBulkAccount} className="flex-1" />
                <Button variant="primary" onClick={applyBulk} disabled={!bulkAccount}>
                  Aplicar
                </Button>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-text-faint">A % de cada linha é aplicada ao valor de cada um dos {selected.size} lançamentos, não ao total do lote.</p>
                <SplitEditor accounts={accounts} totalAmount={selectedTotal} value={bulkSplits} onChange={setBulkSplits} />
                <Button variant="primary" className="justify-center" onClick={applyBulk} disabled={bulkSplits.length === 0}>
                  Aplicar rateio aos {selected.size} selecionados
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
