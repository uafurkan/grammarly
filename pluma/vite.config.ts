import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Pluma — write clearly, in your own voice',
        short_name: 'Pluma',
        description: 'A free, private writing desk for university work. Grammar, clarity, originality, citations — all in your browser.',
        theme_color: '#2f5d3a',
        background_color: '#f4f2ec',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // app shell (incl. the large main bundle) is precached; big static
        // assets and the model/CDN traffic are handled at runtime instead.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // pdf.js worker (.mjs) + Hunspell dictionaries — cache on first use
            urlPattern: /\.(?:mjs|dic|aff|wasm)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pluma-heavy-assets', expiration: { maxEntries: 40 } },
          },
          {
            // free research / word APIs — work online, fall back to cache offline
            urlPattern: /^https:\/\/(?:api\.datamuse\.com|api\.crossref\.org|api\.openalex\.org|api\.semanticscholar\.org|export\.arxiv\.org|www\.ebi\.ac\.uk|doaj\.org)\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'pluma-api', networkTimeoutSeconds: 8, expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
        ],
      },
    }),
  ],
})
