import { useState, type FormEvent } from 'react'
import { Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card, Field, Input } from '../components/ui'

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = mode === 'login' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent text-surface flex items-center justify-center">
            <Wallet size={19} />
          </div>
          <div className="font-display font-bold text-xl">Confere</div>
        </div>

        <Card className="p-5">
          <div className="flex border border-border-strong rounded-lg overflow-hidden mb-4">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 text-[12.5px] font-bold py-2 ${mode === 'login' ? 'bg-accent text-surface' : 'text-text-muted'}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 text-[12.5px] font-bold py-2 ${mode === 'signup' ? 'bg-accent text-surface' : 'text-text-muted'}`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Field label="E-mail">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Senha">
              <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </Field>
            {error && <p className="text-[12px] text-negative">{error}</p>}
            <Button type="submit" variant="primary" disabled={loading} className="justify-center mt-1">
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-[11.5px] text-text-faint mt-4">
          {mode === 'signup' ? 'Depois de criar a conta, você cria a fatura compartilhada ou entra numa existente com o código da Ana.' : 'Use o mesmo e-mail e senha que você cadastrou.'}
        </p>
      </div>
    </div>
  )
}
