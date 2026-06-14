// Pluma content script — brings the engine to any editable field on the web.
//
// It watches the focused text box, runs the shared rules engine on its text,
// shows a small floating badge with the issue count, and opens a panel of
// suggestions you can accept in place. Everything runs locally; no network.

import { check, DIALECT_LABELS, type Alert, type Dialect } from './checker'

const DEBOUNCE_MS = 600
const MIN_CHARS = 8

type Field = HTMLTextAreaElement | HTMLInputElement | HTMLElement

let dialect: Dialect = 'en-US'
let activeField: Field | null = null
let lastText = ''
let alerts: Alert[] = []
let dismissed = new Set<string>()
let debounceTimer: number | undefined
let badge: HTMLDivElement | null = null
let panel: HTMLDivElement | null = null

// ---- settings -------------------------------------------------------------

chrome.storage?.local.get(['dialect'], (r) => {
  if (r?.dialect && r.dialect in DIALECT_LABELS) dialect = r.dialect as Dialect
  if (activeField) scheduleCheck()
})
chrome.storage?.onChanged.addListener((changes) => {
  if (changes.dialect?.newValue) {
    dialect = changes.dialect.newValue as Dialect
    lastText = '' // force a re-check under the new dialect
    if (activeField) scheduleCheck()
  }
})

// ---- field detection ------------------------------------------------------

function isEditable(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLElement)) return false
  if (el.closest('.pluma-x')) return false // our own UI
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement) {
    const t = (el.type || 'text').toLowerCase()
    return ['text', 'search', 'email', 'url'].includes(t) && !el.readOnly && !el.disabled
  }
  return el.isContentEditable
}

document.addEventListener(
  'focusin',
  (e) => {
    if (isEditable(e.target)) attach(e.target)
  },
  true,
)

document.addEventListener(
  'focusout',
  (e) => {
    // If focus is leaving the field for something other than our own UI, detach.
    if (e.target === activeField) {
      window.setTimeout(() => {
        const a = document.activeElement
        if (a && a.closest && a.closest('.pluma-x')) return // interacting with us
        if (document.activeElement !== activeField) detach()
      }, 0)
    }
  },
  true,
)

function attach(field: Field) {
  if (activeField === field) return
  detach()
  activeField = field
  field.addEventListener('input', scheduleCheck)
  window.addEventListener('scroll', reposition, true)
  window.addEventListener('resize', reposition)
  scheduleCheck()
}

function detach() {
  if (activeField) activeField.removeEventListener('input', scheduleCheck)
  window.removeEventListener('scroll', reposition, true)
  window.removeEventListener('resize', reposition)
  activeField = null
  alerts = []
  lastText = ''
  closePanel()
  removeBadge()
}

// ---- reading & checking ---------------------------------------------------

interface Seg { from: number; to: number; node: Text }
const BLOCK = /^(DIV|P|LI|UL|OL|BLOCKQUOTE|H[1-6]|TR|SECTION|ARTICLE|PRE|FIGURE|FIGCAPTION)$/

/** Read a field's text. For contenteditable, also return an offset→DOM map. */
function readField(field: Field): { text: string; segs: Seg[] | null } {
  if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
    return { text: field.value, segs: null }
  }
  const segs: Seg[] = []
  let text = ''
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = (child as Text).nodeValue || ''
        if (t) {
          segs.push({ from: text.length, to: text.length + t.length, node: child as Text })
          text += t
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = (child as HTMLElement).tagName
        if (tag === 'BR') {
          text += '\n'
        } else {
          walk(child)
          if (BLOCK.test(tag) && text.length > 0 && !text.endsWith('\n')) text += '\n'
        }
      }
    })
  }
  walk(field)
  return { text, segs }
}

function scheduleCheck() {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(runCheck, DEBOUNCE_MS)
}

function runCheck() {
  if (!activeField) return
  const { text } = readField(activeField)
  lastText = text
  if (text.trim().length < MIN_CHARS) {
    alerts = []
    renderBadge()
    return
  }
  alerts = check(text, dialect).filter((a) => !dismissed.has(fp(a)))
  renderBadge()
  if (panel) renderPanel()
}

const fp = (a: Alert) => `${a.ruleId}:${a.text}:${a.begin}`

// ---- badge ----------------------------------------------------------------

function fieldRect(): DOMRect | null {
  if (!activeField) return null
  return activeField.getBoundingClientRect()
}

function renderBadge() {
  const r = fieldRect()
  if (!r || r.width === 0 || r.height === 0) return removeBadge()
  if (!badge) {
    badge = document.createElement('div')
    badge.className = 'pluma-x pluma-badge'
    badge.addEventListener('mousedown', (e) => e.preventDefault()) // keep field focus
    badge.addEventListener('click', togglePanel)
    document.body.appendChild(badge)
  }
  const n = alerts.length
  badge.classList.toggle('pluma-badge--clean', n === 0)
  badge.textContent = n === 0 ? '✓' : String(n)
  badge.title = n === 0 ? 'Pluma — looks clean' : `Pluma — ${n} suggestion${n > 1 ? 's' : ''}`
  positionBadge(r)
}

function positionBadge(r: DOMRect) {
  if (!badge) return
  const size = 22
  badge.style.left = `${Math.min(r.right, window.innerWidth) - size - 6}px`
  badge.style.top = `${Math.min(r.bottom, window.innerHeight) - size - 6}px`
}

function removeBadge() {
  badge?.remove()
  badge = null
}

function reposition() {
  const r = fieldRect()
  if (!r) return
  positionBadge(r)
  if (panel) positionPanel(r)
}

// ---- suggestions panel ----------------------------------------------------

function togglePanel() {
  if (panel) closePanel()
  else openPanel()
}

function openPanel() {
  panel = document.createElement('div')
  panel.className = 'pluma-x pluma-panel'
  panel.addEventListener('mousedown', (e) => e.preventDefault())
  document.body.appendChild(panel)
  renderPanel()
  const r = fieldRect()
  if (r) positionPanel(r)
  document.addEventListener('mousedown', onDocDown, true)
}

function closePanel() {
  panel?.remove()
  panel = null
  document.removeEventListener('mousedown', onDocDown, true)
}

function onDocDown(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (t.closest('.pluma-x')) return
  closePanel()
}

function positionPanel(r: DOMRect) {
  if (!panel) return
  const w = 320
  const h = panel.offsetHeight || 240
  let left = Math.min(r.right, window.innerWidth) - w
  if (left < 8) left = 8
  let top = Math.min(r.bottom, window.innerHeight) + 6
  if (top + h + 8 > window.innerHeight) top = Math.max(8, r.top - h - 6)
  panel.style.left = `${left}px`
  panel.style.top = `${top}px`
  panel.style.width = `${w}px`
}

function renderPanel() {
  if (!panel) return
  panel.innerHTML = ''

  const head = document.createElement('div')
  head.className = 'pluma-head'
  head.innerHTML = `<span class="pluma-logo">Plu<em>ma</em></span>`
  const sel = document.createElement('select')
  sel.className = 'pluma-dialect'
  for (const [v, label] of Object.entries(DIALECT_LABELS)) {
    const o = document.createElement('option')
    o.value = v
    o.textContent = label
    if (v === dialect) o.selected = true
    sel.appendChild(o)
  }
  sel.addEventListener('change', () => {
    dialect = sel.value as Dialect
    chrome.storage?.local.set({ dialect })
    lastText = ''
    runCheck()
  })
  head.appendChild(sel)
  panel.appendChild(head)

  if (alerts.length === 0) {
    const clean = document.createElement('div')
    clean.className = 'pluma-clean'
    clean.textContent = '✓ Nothing to flag.'
    panel.appendChild(clean)
    return
  }

  const list = document.createElement('div')
  list.className = 'pluma-list'
  alerts.forEach((a) => list.appendChild(card(a)))
  panel.appendChild(list)
}

function card(a: Alert): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pluma-card'
  const rep = a.replacements[0]
  el.innerHTML = `
    <div class="pluma-cat"><span class="pluma-dot pluma-dot--${a.category}"></span>${a.category}</div>
    <div class="pluma-change"><span class="pluma-from">${esc(a.text)}</span>${
      rep !== undefined ? ` → <span class="pluma-to">${esc(rep)}</span>` : ''
    }</div>
    <div class="pluma-msg">${esc(a.message)}</div>`

  const row = document.createElement('div')
  row.className = 'pluma-actions'
  if (rep !== undefined) {
    const accept = btn('Accept', 'pluma-accept', () => applyFix(a, 0))
    row.appendChild(accept)
  }
  row.appendChild(
    btn('Dismiss', 'pluma-dismiss', () => {
      dismissed.add(fp(a))
      alerts = alerts.filter((x) => x !== a)
      renderBadge()
      renderPanel()
    }),
  )
  el.appendChild(row)
  return el
}

function btn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.className = `pluma-btn ${cls}`
  b.textContent = label
  b.addEventListener('click', onClick)
  return b
}

// ---- applying a fix -------------------------------------------------------

function applyFix(a: Alert, index: number) {
  const field = activeField
  const replacement = a.replacements[index]
  if (!field || replacement === undefined) return

  const { text, segs } = readField(field)
  // the field must be unchanged since the check, or the offset is stale
  if (text.slice(a.begin, a.end) !== a.text) {
    runCheck()
    return
  }

  if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
    const next = text.slice(0, a.begin) + replacement + text.slice(a.end)
    setNativeValue(field, next)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  } else if (segs) {
    const start = resolveOffset(segs, a.begin)
    const end = resolveOffset(segs, a.end)
    if (!start || !end) return
    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
    range.deleteContents()
    range.insertNode(document.createTextNode(replacement))
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // re-check the now-edited field and refresh the UI
  window.setTimeout(runCheck, 0)
}

function resolveOffset(segs: Seg[], offset: number): { node: Text; offset: number } | null {
  for (const s of segs) {
    if (offset >= s.from && offset <= s.to) return { node: s.node, offset: offset - s.from }
  }
  const last = segs[segs.length - 1]
  return last ? { node: last.node, offset: last.node.length } : null
}

/** Set a value on a React-controlled input so the framework notices the change. */
function setNativeValue(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const proto = Object.getPrototypeOf(el)
  const desc = Object.getOwnPropertyDescriptor(proto, 'value')
  if (desc?.set) desc.set.call(el, value)
  else el.value = value
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
