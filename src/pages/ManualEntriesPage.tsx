import { useState } from 'react'
import { Plus } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { Button, Card, CardTitle, Field, Input, Pill, Select, Stamp, Switch } from '../components/ui'
import { AccountSelect } from '../components/AccountSelect'
import { SplitEditor, defaultSplitFor } from '../components/SplitEditor'
import { useAccounts } from '../hooks/useAccounts'
import { useEntries, type SplitInput } from '../hooks/useEntries'
import { formatBRL, formatDateShort, parseBRLInput, todayLocalISO } from '../lib/format'
import type { AccountType } from '../lib/types'

export function ManualEntriesPage() {
  const { accounts } = useAccounts()
  const { entries, createManualEntry } = useEntries('previsto')

  const [date, setDate] = useState(todayLocalISO())
  const [description, setDescription] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [type, setType] = useState<AccountType>('despesa')
  const [rateio, setRateio] = useState(false)
  const [singleAccount, setSingleAccount] = useState('')
  const [splits, setSplits] = useState<SplitInput[]>([])
  const [saving, setSaving] = useState(false)

  const amount = parseBRLInput(amountRaw)

  function toggleRateio(on: boolean) {
    setRateio(on)
    if (on && splits.length === 0 && accounts.length > 0) {
      setSplits(defaultSplitFor(accounts, amount))
    }
  }

  async function handleSubmit() {
    if (!description.trim() || amount <= 0) return
    setSaving(true)
    try {
      const finalSplits: SplitInput[] = rateio ? splits : singleAccount ? [{ account_id: singleAccount, percent: 100, amount }] : []
      await createManualEntry({ date, description, amount, type, splits: finalSplits })
      setDescription('')
      setAmountRaw('')
      setSplits([])
      setSingleAccount('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pb-24">
      <TopBar title="Lançamentos manuais" subtitle="Lance o que já sabe que vai cair na fatura, antes de importar" />

      <div className="px-4 flex flex-col gap-4">
        <Card className="p-4">
          <CardTitle>Cadastrar lançamento previsto</CardTitle>
          <div className="flex flex-col gap-3">
            <Field label="Data">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Descrição">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Conta de água — Condomínio ABC" />
            </Field>
            <Field label="Valor">
              <Input inputMode="decimal" value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder="R$ 0,00" />
            </Field>
            <Field label="Tipo">
              <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </Select>
            </Field>

            <label className="flex items-center gap-2.5 text-[12.5px] font-semibold cursor-pointer">
              <Switch checked={rateio} onChange={toggleRateio} />
              Ratear entre contas
            </label>

            {rateio ? (
              <SplitEditor accounts={accounts} totalAmount={amount} value={splits} onChange={setSplits} />
            ) : (
              <Field label="Conta / categoria">
                <AccountSelect accounts={accounts} value={singleAccount} onChange={setSingleAccount} />
              </Field>
            )}

            <Button variant="primary" className="justify-center mt-1" onClick={handleSubmit} disabled={saving}>
              <Plus size={14} /> {saving ? 'Salvando...' : 'Adicionar lançamento previsto'}
            </Button>
          </div>
          <p className="text-[11.5px] text-text-faint leading-relaxed mt-3">
            Quando o arquivo real for importado, um lançamento com a mesma data e valor chega já com a conta (ou o rateio) preenchidos — só confirma.
          </p>
        </Card>

        <Card className="p-4">
          <CardTitle>Previstos aguardando o arquivo real</CardTitle>
          {entries.length === 0 ? (
            <p className="text-[12.5px] text-text-faint py-3 text-center">Nenhum lançamento previsto ainda.</p>
          ) : (
            <div className="flex flex-col">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-dashed border-border last:border-none">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-bold truncate">{e.description}</div>
                    <div className="text-[11px] text-text-faint">
                      {formatDateShort(e.date)} · {formatBRL(e.amount)}
                    </div>
                    {e.entry_splits.length > 0 && (
                      <Stamp color="var(--color-accent)">
                        {e.entry_splits.length > 1 ? `Rateado · ${e.entry_splits.length} contas` : 'classificado'}
                      </Stamp>
                    )}
                  </div>
                  <Pill tone={e.matched_entry_id ? 'positive' : 'neutral'}>{e.matched_entry_id ? 'Casou ✓' : 'Aguardando'}</Pill>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
