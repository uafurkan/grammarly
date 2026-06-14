// Popup: pick the dialect, stored in chrome.storage and picked up live by the
// content script on every page.
const LABELS = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'es-ES': 'Español (España)',
  'es-419': 'Español (Latinoamérica)',
}

const sel = document.getElementById('dialect')
for (const [v, label] of Object.entries(LABELS)) {
  const o = document.createElement('option')
  o.value = v
  o.textContent = label
  sel.appendChild(o)
}

chrome.storage.local.get(['dialect'], (r) => {
  sel.value = r && r.dialect && LABELS[r.dialect] ? r.dialect : 'en-US'
})

sel.addEventListener('change', () => {
  chrome.storage.local.set({ dialect: sel.value })
})
