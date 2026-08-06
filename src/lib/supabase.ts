import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copie .env.example para .env.local e preencha com os dados do seu projeto Supabase.'
  )
}

// URL de placeholder válida quando não configurado, só pra createClient não
// derrubar o app inteiro antes da tela de aviso conseguir renderizar.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key', {
  realtime: { params: { eventsPerSecond: 5 } },
})
