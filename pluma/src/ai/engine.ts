// Lazy owner of the web-llm engine. The big library is only imported when the
// user opts in, so it never lands in the main bundle. The model weights are
// fetched from web-llm's CDN on first load and cached by web-llm in the Cache
// API (download once). Everything runs on-device — no server, no API cost.

import type { MLCEngineInterface, InitProgressReport } from '@mlc-ai/web-llm'
import { detectAi, type ModelId } from './capabilities'

const MODELS: Record<ModelId, { f16: string; f32: string }> = {
  'qwen2.5-1.5b': {
    f16: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    f32: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
  },
  'qwen2.5-0.5b': {
    f16: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    f32: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
  },
}

export interface LoadProgress {
  loaded: number // 0..1
  text: string
}

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

let engine: MLCEngineInterface | null = null
let loadedModelId: ModelId | null = null
let loadingPromise: Promise<void> | null = null

export function isModelLoaded(): boolean {
  return engine !== null
}

export function currentModel(): ModelId | null {
  return loadedModelId
}

export async function loadModel(id: ModelId, onProgress: (p: LoadProgress) => void): Promise<void> {
  if (engine && loadedModelId === id) return
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const caps = await detectAi()
    if (!caps.webgpu) throw new Error('WebGPU is not available on this device.')
    const variant = MODELS[id]
    const modelName = caps.shaderF16 ? variant.f16 : variant.f32

    const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm')
    const worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })

    engine = await CreateWebWorkerMLCEngine(worker, modelName, {
      initProgressCallback: (r: InitProgressReport) => {
        onProgress({ loaded: r.progress ?? 0, text: r.text ?? 'Preparing…' })
      },
    })
    loadedModelId = id
  })()

  try {
    await loadingPromise
  } finally {
    loadingPromise = null
  }
}

export async function unloadModel(): Promise<void> {
  if (engine) {
    try { await engine.unload() } catch { /* ignore */ }
  }
  engine = null
  loadedModelId = null
}

/**
 * Streams a completion token-by-token. The caller gets each token via onToken
 * and the full text as the return value. Abortable mid-stream.
 */
export async function* generate(
  messages: ChatTurn[],
  opts: { temperature?: number; signal?: AbortSignal } = {},
): AsyncGenerator<string> {
  if (!engine) throw new Error('The AI model is not loaded yet.')
  const stream = await engine.chat.completions.create({
    messages,
    stream: true,
    temperature: opts.temperature ?? 0.6,
  })
  for await (const chunk of stream) {
    if (opts.signal?.aborted) break
    const delta = chunk.choices[0]?.delta?.content
    if (delta) yield delta
  }
}
