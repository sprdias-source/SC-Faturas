import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card, Field, PasswordInput } from '../components/ui'

type Status = 'checking' | 'ready' | 'invalid' | 'success'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // O link do e-mail cria uma sessão temporária de recuperação ao carregar
  // a página — o Supabase processa isso de forma assíncrona, por isso
  // ouvimos o evento em vez de só checar getSession() uma vez.
  useEffect(() => {
    let settled = false
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        settled = true
        setStatus('ready')
      }
    })
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        setStatus('invalid')
      }
    }, 3000)
    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não são iguais.')
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) setError(error.message)
    else setStatus('success')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent-soft border border-border-strong flex items-center justify-center">
            <KeyRound size={18} className="text-accent-strong" />
          </div>
          <div className="font-display font-bold text-xl">Redefinir senha</div>
        </div>

        <Card className="p-5">
          {status === 'checking' && <p className="text-[13px] text-text-muted text-center py-4">Verificando o link...</p>}

          {status === 'invalid' && (
            <div className="flex flex-col gap-3 text-center py-2">
              <p className="text-[13px] text-text leading-relaxed">
                Esse link não é mais válido — pode ter expirado ou já ter sido usado. Peça um novo em "Esqueci minha senha" na tela de login.
              </p>
              <Button variant="primary" onClick={() => navigate('/')} className="justify-center">
                Voltar pro login
              </Button>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Field label="Nova senha">
                <PasswordInput required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
              </Field>
              <Field label="Confirmar nova senha">
                <PasswordInput required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </Field>
              {error && <p className="text-[12px] text-negative">{error}</p>}
              <Button type="submit" variant="primary" disabled={saving} className="justify-center mt-1">
                {saving ? 'Salvando...' : 'Salvar nova senha'}
              </Button>
            </form>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-3 text-center py-2">
              <div className="w-10 h-10 rounded-full bg-positive-soft border border-positive/40 flex items-center justify-center">
                <Check size={18} className="text-positive" />
              </div>
              <p className="text-[13px] text-text">Senha alterada! Já pode continuar.</p>
              <Button variant="primary" onClick={() => navigate('/')} className="justify-center w-full">
                Continuar
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
