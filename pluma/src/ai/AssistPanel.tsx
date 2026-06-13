import { useEffect, useRef, useState } from 'react'
import { detectAi, MODEL_INFO, type AiCapabilities, type ModelId } from './capabilities'
import { currentModel, isModelLoaded, loadModel, unloadModel, type LoadProgress } from './engine'
import { rewrite, toneShift, type AiContext, type RewriteMode, type ToneTarget } from './tasks'

const MODES: { id: RewriteMode; label: string }[] = [
  { id: 'rewrite', label: 'Rewrite' },
  { id: 'simplify', label: 'Simplify' },
  { id: 'shorten', label: 'Shorten' },
  { id: 'expand', label: 'Expand' },
  { id: 'paraphrase', label: 'Paraphrase' },
  { id: 'summarize', label: 'Summarize' },
]
const TONES: ToneTarget[] = ['formal', 'friendly', 'confident', 'neutral', 'academic']

type Phase = 'detect' | 'unsupported' | 'gate' | 'loading' | 'ready'

/**
 * On-device AI assistant. Runs a small language model in the browser via
 * WebGPU — free, private (text never leaves the device), opt-in download.
 * Falls back to a clear message where WebGPU isn't available.
 */
export default function AssistPanel({
  selectedText,
  context,
  onReplace,
  onInsert,
}: {
  selectedText: string
  context: AiContext
  onReplace: (text: string) => void
  onInsert: (text: string) => void
}) {
  const [phase, setPhase] = useState<Phase>('detect')
  const [caps, setCaps] = useState<AiCapabilities | null>(null)
  const [choice, setChoice] = useState<ModelId>('qwen2.5-0.5b')
  const [progress, setProgress] = useState<LoadProgress>({ loaded: 0, text: '' })
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let alive = true
    detectAi().then((c) => {
      if (!alive) return
      setCaps(c)
      setChoice(c.recommendedModel)
      if (!c.webgpu) setPhase('unsupported')
      else if (isModelLoaded()) setPhase('ready')
      else setPhase('gate')
    })
    return () => { alive = false }
  }, [])

  const download = async () => {
    setPhase('loading')
    try {
      await loadModel(choice, setProgress)
      setPhase('ready')
    } catch {
      setPhase('gate')
      setProgress({ loaded: 0, text: 'Could not load the model. Check your connection and try again.' })
    }
  }

  const run = async (fn: (onToken: (t: string) => void, signal: AbortSignal) => Promise<string>) => {
    if (!selectedText.trim() || running) return
    setRunning(true)
    setOutput('')
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await fn((t) => setOutput((o) => o + t), ctrl.signal)
    } catch {
      setOutput((o) => o || 'Something went wrong. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  const stop = () => abortRef.current?.abort()

  if (phase === 'detect') {
    return (<><h2>Assist</h2><p className="sub">Checking this device…</p></>)
  }

  if (phase === 'unsupported') {
    return (
      <>
        <h2>Assist</h2>
        <p className="sub">
          The on-device AI rewriter needs WebGPU, which this browser doesn't
          support yet. It works in recent Chrome and Edge on a computer, and in
          Safari on iOS 17.4+. Everything else in Pluma — including the thesaurus
          and clarity tools — still works here.
        </p>
      </>
    )
  }

  if (phase === 'gate' || phase === 'loading') {
    const info = MODEL_INFO[choice]
    return (
      <>
        <h2>Assist</h2>
        <p className="sub">
          A small AI model runs entirely on your device — free, and private
          (your text never leaves this browser). It downloads once, then works
          even offline.
        </p>

        {phase === 'gate' ? (
          <>
            <div className="ai-model-choice">
              {(Object.keys(MODEL_INFO) as ModelId[]).map((m) => (
                <button
                  key={m}
                  className={`ai-model-opt${choice === m ? ' on' : ''}`}
                  onClick={() => setChoice(m)}
                >
                  <span className="ai-model-name">{MODEL_INFO[m].label}</span>
                  <span className="ai-model-size">~{MODEL_INFO[m].sizeMB} MB</span>
                </button>
              ))}
            </div>
            {caps?.ios && (
              <p className="find-note">On iPhone/iPad, the Light model is recommended. Use Wi-Fi for the download.</p>
            )}
            {progress.text && <div className="find-msg">{progress.text}</div>}
            <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={download}>
              Download AI (~{info.sizeMB} MB)
            </button>
          </>
        ) : (
          <div className="ai-load">
            <div className="ai-progress-wrap"><div className="ai-progress" style={{ width: `${Math.round(progress.loaded * 100)}%` }} /></div>
            <p className="find-note">{progress.text || 'Preparing the model…'}</p>
          </div>
        )}
      </>
    )
  }

  // ready
  const hasSel = selectedText.trim().length > 0
  return (
    <>
      <h2>Assist</h2>
      <p className="sub">
        Running on your device{currentModel() ? ` · ${MODEL_INFO[currentModel()!].label}` : ''}.
        Select text, then choose an action.
      </p>

      {!hasSel && <div className="clean">Select some text in your document to rewrite, simplify, or shorten it.</div>}

      <div className="ai-actions">
        {MODES.map((m) => (
          <button
            key={m.id}
            className="ai-act"
            disabled={!hasSel || running}
            onClick={() => run((onTok, sig) => rewrite(selectedText, m.id, context, onTok, sig))}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="ai-tone-row">
        <span className="an-label">Tone</span>
        <div className="ai-tones">
          {TONES.map((t) => (
            <button
              key={t}
              className="ai-tone"
              disabled={!hasSel || running}
              onClick={() => run((onTok, sig) => toneShift(selectedText, t, context, onTok, sig))}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {(running || output) && (
        <div className="ai-output">
          <div className="ai-output-text">{output || 'Thinking…'}{running && <span className="ai-caret">▋</span>}</div>
          <div className="ai-output-actions">
            {running ? (
              <button className="btn btn--quiet" onClick={stop}>Stop</button>
            ) : (
              <>
                <button className="btn btn--primary" onClick={() => { onReplace(output); setOutput('') }}>Replace selection</button>
                <button className="btn" onClick={() => { onInsert(output); setOutput('') }}>Insert below</button>
                <button className="btn btn--quiet" onClick={() => void navigator.clipboard?.writeText(output)}>Copy</button>
              </>
            )}
          </div>
        </div>
      )}

      <button className="btn btn--quiet" style={{ marginTop: 14, fontSize: 12 }} onClick={() => { void unloadModel(); setPhase('gate') }}>
        Unload model (free memory)
      </button>
    </>
  )
}
