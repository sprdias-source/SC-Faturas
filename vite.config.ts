import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Confere — fatura & extrato',
        short_name: 'Confere',
        description: 'Conferência pessoal de fatura de cartão e extrato bancário',
        theme_color: '#2d3f6b',
        background_color: '#eef1ea',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // rota "de verdade" agora (não mais #hash) — sem isso, o service
        // worker não sabe servir index.html pra um caminho como /conciliar
        navigateFallback: '/index.html',
      },
    }),
  ],
})
