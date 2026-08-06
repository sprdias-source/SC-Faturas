import { useState } from 'react'
import { Wallet, Plus, Pencil, Trash2 } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { useAccounts, type AccountNode } from '../hooks/useAccounts'
import { useAccountTotals } from '../hooks/useAccountTotals'
import { Button, Card, CardTitle, Field, Input, Pill, Select } from '../components/ui'
import { formatBRL, todayLocalISO } from '../lib/format'
import type { Account, AccountType } from '../lib/types'

const COLORS = ['#2d3f6b', '#2f7d4f', '#a8721c', '#ad3b3b', '#8b9788']

export function AccountsPage() {
  const { accounts, tree, createAccount, updateAccount, deleteAccount } = useAccounts()
  const monthPrefix = todayLocalISO().slice(0, 7)
  const { totals } = useAccountTotals(monthPrefix)

  const [editing, setEditing] = useState<Account | null>(null)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<AccountType>('despesa')
  const [formParent, setFormParent] = useState('')
  const [formColor, setFormColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)

  function startNew(parentId?: string) {
    setEditing({ id: '', household_id: '', name: '', type: 'despesa', parent_id: parentId ?? null, color: COLORS[0], created_at: '' })
    setFormName('')
    setFormType('despesa')
    setFormParent(parentId ?? '')
    setFormColor(COLORS[0])
  }

  function startEdit(acc: Account) {
    setEditing(acc)
    setFormName(acc.name)
    setFormType(acc.type)
    setFormParent(acc.parent_id ?? '')
    setFormColor(acc.color)
  }

  async function handleSave() {
    if (!formName.trim()) return
    setSaving(true)
    try {
      if (editing?.id) {
        await updateAccount(editing.id, { name: formName, type: formType, color: formColor, parent_id: formParent || null })
      } else {
        await createAccount(formName, formType, formParent || null, formColor)
      }
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(acc: Account) {
    if (!confirm(`Excluir "${acc.name}"? Isso não apaga os lançamentos já classificados nela.`)) return
    await deleteAccount(acc.id)
  }

  function renderNode(node: AccountNode, isChild = false) {
    return (
      <div key={node.id}>
        <div className="flex items-center justify-between gap-2 py-2.5 border-b border-dashed border-border last:border-none">
          <div className={`flex items-center gap-2 min-w-0 ${isChild ? 'pl-5' : ''}`}>
            {!isChild && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: node.color }} />}
            <span className={`text-[13px] truncate ${isChild ? 'text-text-muted' : 'font-bold'}`}>{node.name}</span>
            <Pill tone={node.type === 'receita' ? 'positive' : 'neutral'}>{node.type === 'receita' ? 'Receita' : 'Despesa'}</Pill>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono text-[12.5px] tabular-nums">{formatBRL(totals[node.id] ?? 0)}</span>
            {!isChild && (
              <button onClick={() => startNew(node.id)} className="text-[10px] font-bold text-accent-strong">
                + sub
              </button>
            )}
            <button onClick={() => startEdit(node)} className="w-6 h-6 flex items-center justify-center text-text-faint hover:text-text">
              <Pencil size={13} />
            </button>
            <button onClick={() => handleDelete(node)} className="w-6 h-6 flex items-center justify-center text-text-faint hover:text-negative">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        {node.children.map((child) => renderNode(child, true))}
      </div>
    )
  }

  return (
    <div className="pb-24">
      <TopBar title="Contas e subcontas" subtitle="Sua árvore de categorias, compartilhada com a Ana" action={<Button variant="primary" onClick={() => startNew()}><Plus size={14} /> Nova</Button>} />

      <div className="px-4">
        <Card className="p-4 mb-4">
          <CardTitle>Suas contas</CardTitle>
          {tree.length === 0 ? (
            <p className="text-[12.5px] text-text-faint py-4 text-center">Nenhuma conta ainda. Toque em "Nova" pra criar a primeira.</p>
          ) : (
            tree.map((node) => renderNode(node))
          )}
        </Card>

        {editing && (
          <Card className="p-4 border-accent border-[1.5px]">
            <CardTitle>{editing.id ? 'Editar conta' : formParent ? 'Nova subconta' : 'Nova conta'}</CardTitle>
            <div className="flex flex-col gap-3">
              <Field label="Nome">
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex.: Lazer, Água · Bloco A..." autoFocus />
              </Field>
              <Field label="Tipo">
                <Select value={formType} onChange={(e) => setFormType(e.target.value as AccountType)}>
                  <option value="despesa">Despesa</option>
                  <option value="receita">Receita</option>
                </Select>
              </Field>
              <Field label="Conta pai (opcional)">
                <Select value={formParent} onChange={(e) => setFormParent(e.target.value)}>
                  <option value="">— Nenhuma (categoria principal) —</option>
                  {accounts
                    .filter((a) => !a.parent_id && a.id !== editing.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Cor">
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setFormColor(c)} className="w-7 h-7 rounded-lg flex-shrink-0" style={{ background: c, outline: formColor === c ? '2px solid var(--color-text)' : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
              </Field>
              <div className="flex gap-2 mt-1">
                <Button variant="primary" className="flex-1 justify-center" onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </Card>
        )}

        {tree.length === 0 && !editing && (
          <div className="flex flex-col items-center text-center py-10 text-text-faint">
            <Wallet size={28} className="mb-2" />
            <p className="text-[12.5px]">Comece cadastrando contas como "Alimentação", "Moradia" ou "Transporte".</p>
          </div>
        )}
      </div>
    </div>
  )
}
