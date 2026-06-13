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
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister())
  }).catch(() => { /* ignore */ })
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => { /* ignore */ })
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
