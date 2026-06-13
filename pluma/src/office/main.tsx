/// <reference types="office-js" />
import '../polyfills'
import React from 'react'
import ReactDOM from 'react-dom/client'
import OfficeApp from './OfficeApp'
import '../styles/index.css'
import './office.css'

// The Word task pane must never be controlled by the web app's service worker —
// otherwise its SPA navigation fallback can serve the site shell (the Pluma
// homepage) inside Word instead of this add-in. Tear down any service worker
// (and its caches) that a previous build may have registered in Word's webview.
//
// Only do this when actually hosted by Office: this page shares an origin with
// the web app, so running it in a normal browser tab would otherwise wipe the
// installed PWA's offline cache and unregister its service worker. Office always
// appends a `_host_Info` query to the task-pane URL, so that's our gate.
const inOffice =
  typeof window !== 'undefined' &&
  (/[?&]_host_Info=/.test(window.location.search) || window.self !== window.top)
if (inOffice && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister())
  }).catch(() => { /* ignore */ })
  // Only Pluma's own caches — never blow away unrelated origin caches.
  if (typeof caches !== 'undefined') {
    caches.keys()
      .then((keys) => keys.filter((k) => /^(pluma|workbox|vite-pwa)/i.test(k)).forEach((k) => caches.delete(k)))
      .catch(() => { /* ignore */ })
  }
}

// Office.onReady fires once the host (Word) and Office.js are ready. If we're
// opened outside Office (e.g. plain browser preview), render anyway so the UI
// is still inspectable.
const mount = () => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <OfficeApp />
    </React.StrictMode>,
  )
}

if (typeof Office !== 'undefined' && Office.onReady) {
  Office.onReady(() => mount())
} else {
  mount()
}
