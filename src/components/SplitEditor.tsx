import { useState } from 'react'
import clsx from 'clsx'
import { Plus, X, Check } from 'lucide-react'
import { AccountSelect } from './AccountSelect'
import { formatBRL, parseBRLInput } from '../lib/format'
import type { Account } from '../lib/types'
import type { SplitInput } from '../hooks/useEntries'

export function distributeEqually(accountIds: string[], total: number): SplitInput[] {
  const n = accountIds.length
  if (n === 0) return []
  const pct = +(100 / n).toFixed(2)
  return accountIds.map((account_id, i) => {
    // último item absorve a sobra de arredondamento pra fechar 100%/total certinho
    const isLast = i === n - 1
    const percent = isLast ? +(100 - pct * (n - 1)).toFixed(2) : pct
    const amount = isLast ? +(total - Math.round(((total * pct) / 100) * (n - 1) * 100) / 100).toFixed(2) : Math.round(((total * pct) / 100) * 100) / 100
    return { account_id, percent, amount }
  })
}

/** Ponto de partida ao abrir um rateio: com 2+ contas cadastradas, já
 *  vem 50%/50% pré-fixado nas duas primeiras (o caso mais comum);
 *  editar % ou R$ de qualquer linha depois continua livre, como sempre. */
export function defaultSplitFor(accounts: Account[], total: number): SplitInput[] {
  const ids = accounts.slice(0, 2).map((a) => a.id)
  if (ids.length === 0) return []
  return distributeEqually(ids, total)
}

export function SplitEditor({
  accounts,
  totalAmount,
  value,
  onChange,
}: {
  accounts: Account[]
  totalAmount: number
  value: SplitInput[]
  onChange: (splits: SplitInput[]) => void
}) {
  const [mode, setMode] = useState<'percent' | 'amount'>('percent')

  function updateLine(index: number, patch: Partial<SplitInput>) {
    const next = value.slice()
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  function onPercentInput(index: number, raw: string) {
    const pct = parseFloat(raw.replace(',', '.').replace('%', '')) || 0
    updateLine(index, { percent: pct, amount: +((totalAmount * pct) / 100).toFixed(2) })
  }

  function onAmountInput(index: number, raw: string) {
    const amt = parseBRLInput(raw)
    updateLine(index, { amount: amt, percent: totalAmount > 0 ? +((amt / totalAmount) * 100).toFixed(2) : 0 })
  }

  function addLine() {
    const usedIds = new Set(value.map((s) => s.account_id))
    const nextAccount = accounts.find((a) => !usedIds.has(a.id))
    const ids = [...value.map((s) => s.account_id), nextAccount?.id ?? accounts[0]?.id ?? '']
    onChange(distributeEqually(ids, totalAmount))
  }

  function removeLine(index: number) {
    const ids = value.filter((_, i) => i !== index).map((s) => s.account_id)
    onChange(distributeEqually(ids, totalAmount))
  }

  const sumPercent = value.reduce((s, v) => s + v.percent, 0)
  const sumAmount = value.reduce((s, v) => s + v.amount, 0)
  const isBalanced = Math.abs(sumPercent - 100) < 0.05 && Math.abs(sumAmount - totalAmount) < 0.02

  return (
    <div className="p-3 border border-dashed border-border-strong rounded-lg bg-surface-2">
      <div className="flex items-center justify-between gap-2.5 mb-2.5 flex-wrap">
        <span className="text-[11.5px] font-bold text-text-muted">
          Divisão de <b className="text-text">{formatBRL(totalAmount)}</b>
        </span>
        <div className="flex border border-border-strong rounded-md overflow-hidden">
          <button type="button" onClick={() => setMode('percent')} className={clsx('text-[10.5px] font-bold px-2.5 py-1', mode === 'percent' ? 'bg-accent text-surface' : 'text-text-faint')}>
            %
          </button>
          <button type="button" onClick={() => setMode('amount')} className={clsx('text-[10.5px] font-bold px-2.5 py-1', mode === 'amount' ? 'bg-accent text-surface' : 'text-text-faint')}>
            R$
          </button>
        </div>
      </div>

      {value.map((split, i) => (
        <div key={i} className="grid grid-cols-[1fr_78px_100px_26px] gap-2 items-center mb-1.5">
          <AccountSelect accounts={accounts} value={split.account_id} onChange={(id) => updateLine(i, { account_id: id })} />
          <input
            className="text-right font-mono text-[13px] bg-surface border border-border-strong rounded-md px-2 py-1.5"
            value={mode === 'percent' ? `${split.percent}%` : `${split.percent.toFixed(1)}%`}
            onChange={(e) => onPercentInput(i, e.target.value)}
            readOnly={mode !== 'percent'}
          />
          <input
            className="text-right font-mono text-[13px] bg-surface border border-border-strong rounded-md px-2 py-1.5"
            value={mode === 'amount' ? formatBRL(split.amount) : formatBRL(split.amount)}
            onChange={(e) => onAmountInput(i, e.target.value)}
            readOnly={mode !== 'amount'}
          />
          <button type="button" onClick={() => removeLine(i)} className="w-[22px] h-[22px] rounded-md text-text-faint hover:text-negative flex items-center justify-center" title="Remover">
            <X size={13} />
          </button>
        </div>
      ))}

      <button type="button" onClick={addLine} className="text-[11px] font-bold text-accent-strong inline-flex items-center gap-1 py-1">
        <Plus size={12} /> Adicionar divisão
      </button>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-[11.5px]">
        <span className="text-text-faint">Editar % recalcula o R$; editar o R$ recalcula o %.</span>
        <span className={clsx('font-bold inline-flex items-center gap-1', isBalanced ? 'text-positive' : 'text-negative')}>
          {isBalanced && <Check size={13} />}
          {sumPercent.toFixed(1)}% · {formatBRL(sumAmount)}
        </span>
      </div>
    </div>
  )
}
