/// <reference types="office-js" />
import '../polyfills'
import React from 'react'
import ReactDOM from 'react-dom/client'
import OfficeApp from './OfficeApp'
import '../styles/index.css'
import './office.css'

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
