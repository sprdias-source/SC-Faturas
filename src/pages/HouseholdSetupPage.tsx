import { useState, type FormEvent } from 'react'
import { Users } from 'lucide-react'
import { useHousehold } from '../hooks/useHousehold'
import { Button, Card, Field, Input } from '../components/ui'

const COLORS = ['#2d3f6b', '#2f7d4f', '#a8721c', '#ad3b3b', '#8a5fb0']

export function HouseholdSetupPage() {
  const { createHousehold, joinHousehold } = useHousehold()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('Nossa fatura')
  const [displayName, setDisplayName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'create') await createHousehold(name, displayName, color)
      else await joinHousehold(code, displayName, color)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu certo, tenta de novo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent-soft border border-border-strong flex items-center justify-center">
            <Users size={18} className="text-accent-strong" />
          </div>
          <div className="font-display font-bold text-xl">Compartilhar a fatura</div>
        </div>

        <Card className="p-5">
          <div className="flex border border-border-strong rounded-lg overflow-hidden mb-4">
            <button type="button" onClick={() => setMode('create')} className={`flex-1 text-[12.5px] font-bold py-2 ${mode === 'create' ? 'bg-accent text-surface' : 'text-text-muted'}`}>
              Criar nova
            </button>
            <button type="button" onClick={() => setMode('join')} className={`flex-1 text-[12.5px] font-bold py-2 ${mode === 'join' ? 'bg-accent text-surface' : 'text-text-muted'}`}>
              Entrar com código
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'create' && (
              <Field label="Nome da fatura/orçamento">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
            )}
            {mode === 'join' && (
              <Field label="Código de convite">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex.: a1b2c3" required maxLength={6} />
              </Field>
            )}
            <Field label="Seu nome (como a Ana vai te ver)">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </Field>
            <Field label="Sua cor">
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-lg flex-shrink-0"
                    style={{ background: c, outline: color === c ? '2px solid var(--color-text)' : 'none', outlineOffset: 2 }}
                  />
                ))}
              </div>
            </Field>
            {error && <p className="text-[12px] text-negative">{error}</p>}
            <Button type="submit" variant="primary" disabled={loading} className="justify-center mt-1">
              {loading ? 'Aguarde...' : mode === 'create' ? 'Criar fatura compartilhada' : 'Entrar na fatura'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-[11.5px] text-text-faint mt-4">
          {mode === 'create'
            ? 'Depois de criar, você recebe um código de 6 letras/números pra compartilhar com a Ana — ela usa "Entrar com código" pra cair na mesma fatura.'
            : 'Peça o código de convite pra quem já criou a fatura.'}
        </p>
      </div>
    </div>
  )
}
