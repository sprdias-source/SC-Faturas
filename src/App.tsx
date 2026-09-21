import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { HouseholdProvider, useHousehold } from './hooks/useHousehold'
import { ActivityToastProvider } from './hooks/useActivityToasts'
import { ImportQueueProvider } from './hooks/useImportQueue'
import { AuthPage } from './pages/AuthPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { HouseholdSetupPage } from './pages/HouseholdSetupPage'
import { ImportPage } from './pages/ImportPage'
import { ManualEntriesPage } from './pages/ManualEntriesPage'
import { ReconcilePage } from './pages/ReconcilePage'
import { AccountsPage } from './pages/AccountsPage'
import { SummaryPage } from './pages/SummaryPage'
import { BottomNav } from './components/BottomNav'
import { ToastStack } from './components/ToastStack'

function LoadingScreen() {
  return <div className="min-h-screen flex items-center justify-center text-text-faint text-[13px]">Carregando...</div>
}

function ConfigMissingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center">
      <div className="max-w-xs">
        <h1 className="font-display font-bold text-lg mb-2">Falta configurar o Supabase</h1>
        <p className="text-[13px] text-text-muted leading-relaxed">
          Copie <code className="bg-surface-2 px-1 rounded">.env.example</code> para <code className="bg-surface-2 px-1 rounded">.env.local</code>,
          preencha com a URL e a chave anon do seu projeto Supabase, e rode <code className="bg-surface-2 px-1 rounded">npm run dev</code> de novo.
          Veja o passo a passo no README.
        </p>
      </div>
    </div>
  )
}

function AppShell() {
  const { household, loading } = useHousehold()
  if (loading) return <LoadingScreen />
  if (!household) return <HouseholdSetupPage />

  return (
    <ActivityToastProvider>
      <ImportQueueProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/importar" replace />} />
          <Route path="/importar" element={<ImportPage />} />
          <Route path="/manuais" element={<ManualEntriesPage />} />
          <Route path="/conciliar" element={<ReconcilePage />} />
          <Route path="/contas" element={<AccountsPage />} />
          <Route path="/resumo" element={<SummaryPage />} />
          <Route path="*" element={<Navigate to="/importar" replace />} />
        </Routes>
        <ToastStack />
        <BottomNav />
      </ImportQueueProvider>
    </ActivityToastProvider>
  )
}

function Gate() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <AuthPage />
  return (
    <HouseholdProvider>
      <AppShell />
    </HouseholdProvider>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <ConfigMissingScreen />
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Fora do Gate de propósito: o link de e-mail já cria uma sessão
              temporária de recuperação, então o Gate acharia que é um
              login normal e pularia direto pro app — aqui sempre mostra
              a troca de senha, esteja "logado" ou não. */}
          <Route path="/reset-senha" element={<ResetPasswordPage />} />
          <Route path="/*" element={<Gate />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
