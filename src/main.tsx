import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Sem isso, o app instalado no celular registrava o service worker mas
// nunca pegava versões novas sozinho: o SW atualizava em segundo plano,
// mas a aba já aberta continuava rodando o bundle JS antigo até o usuário
// limpar o cache manualmente — foi por isso que uma correção de bug já
// publicada parecia não ter feito efeito nenhum.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
