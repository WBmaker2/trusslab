import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg'],
      manifest: {
        id: './',
        name: 'TrussLab — 트러스 구조 실험실',
        short_name: 'TrussLab',
        description:
          '격자 위에 트러스를 짓고 하중을 걸어 인장·압축·좌굴을 확인하는 수업용 구조 실험실.',
        lang: 'ko',
        dir: 'ltr',
        theme_color: '#12211f',
        background_color: '#f2efe7',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
  },
})
