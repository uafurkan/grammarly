import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // web-llm is large and only loaded on opt-in; keep it out of the main bundle
  optimizeDeps: { exclude: ['@mlc-ai/web-llm'] },
  build: {
    rollupOptions: {
      // two entry points sharing one engine: the web app and the Word add-in
      input: {
        main: 'index.html',
        office: 'office.html',
      },
      output: {
        manualChunks: { 'web-llm': ['@mlc-ai/web-llm'] },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Register the service worker manually (in src/main.tsx) so it is scoped to
      // the web app only. The Word add-in entry (office.html) must NOT be under a
      // service worker — otherwise the SPA navigation fallback can serve the site
      // shell (index.html) inside Word's task pane instead of the add-in.
      injectRegister: null,
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
        // app shell (incl. the main bundle) is precached; the on-device AI
        // chunks are opt-in (loaded only when the user downloads the model) so
        // they must NOT be precached, and big static assets / CDN traffic are
        // handled at runtime instead.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // the Word add-in is loaded by Office, not the PWA; keep it out of precache
        globIgnores: ['**/web-llm-*.js', '**/ai.worker-*.js', 'office.html', '**/office-*.js'],
        maximumFileSizeToCacheInBytes: 3.5 * 1024 * 1024,
        navigateFallback: 'index.html',
        // don't let the SPA fallback swallow the add-in manifest download or the
        // Office task-pane page (Word must receive office.html, not index.html).
        // No `$` anchor: Office appends a `?_host_Info=...` query to the task-pane
        // URL, so the path no longer *ends* with office.html — match anywhere.
        navigateFallbackDenylist: [/\/pluma-word\.xml/, /\/office\.html/],
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
