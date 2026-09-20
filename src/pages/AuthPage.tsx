import { useState, type FormEvent } from 'react'
import { Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card, Field, Input, PasswordInput } from '../components/ui'

type Mode = 'login' | 'signup' | 'recover'

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [recoverSent, setRecoverSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'recover') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-senha`,
      })
      setLoading(false)
      if (error) setError(error.message)
      else setRecoverSent(true)
      return
    }

    const { error } = mode === 'login' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setRecoverSent(false)
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
          {mode !== 'recover' && (
            <div className="flex border border-border-strong rounded-lg overflow-hidden mb-4">
              <button type="button" onClick={() => switchMode('login')} className={`flex-1 text-[12.5px] font-bold py-2 ${mode === 'login' ? 'bg-accent text-surface' : 'text-text-muted'}`}>
                Entrar
              </button>
              <button type="button" onClick={() => switchMode('signup')} className={`flex-1 text-[12.5px] font-bold py-2 ${mode === 'signup' ? 'bg-accent text-surface' : 'text-text-muted'}`}>
                Criar conta
              </button>
            </div>
          )}

          {mode === 'recover' && recoverSent ? (
            <div className="flex flex-col gap-3 text-center py-2">
              <p className="text-[13px] text-text leading-relaxed">
                Se <b>{email}</b> tiver uma conta, mandamos um link pra redefinir a senha. Confira sua caixa de entrada (e o spam).
              </p>
              <Button variant="ghost" onClick={() => switchMode('login')} className="justify-center">
                Voltar pro login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Field label="E-mail">
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </Field>

              {mode !== 'recover' && (
                <Field label="Senha">
                  <PasswordInput
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </Field>
              )}

              {mode === 'login' && (
                <button type="button" onClick={() => switchMode('recover')} className="text-[11.5px] font-bold text-accent-strong self-end -mt-1">
                  Esqueci minha senha
                </button>
              )}

              {error && <p className="text-[12px] text-negative">{error}</p>}

              <Button type="submit" variant="primary" disabled={loading} className="justify-center mt-1">
                {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link de redefinição'}
              </Button>

              {mode === 'recover' && (
                <button type="button" onClick={() => switchMode('login')} className="text-[11.5px] font-bold text-text-muted self-center">
                  Voltar pro login
                </button>
              )}
            </form>
          )}
        </Card>

        {mode !== 'recover' && (
          <p className="text-center text-[11.5px] text-text-faint mt-4">
            {mode === 'signup' ? 'Depois de criar a conta, você cria a fatura compartilhada ou entra numa existente com o código da Ana.' : 'Use o mesmo e-mail e senha que você cadastrou.'}
          </p>
        )}
      </div>
    </div>
  )
}
