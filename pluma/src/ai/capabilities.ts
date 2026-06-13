// Detects whether this device can run a local LLM (WebGPU), how much it can
// handle, and which model/quantization to recommend. All free + on-device.

export type ModelId = 'qwen2.5-1.5b' | 'qwen2.5-0.5b'

export interface AiCapabilities {
  webgpu: boolean
  shaderF16: boolean
  ios: boolean
  /** rough device-memory hint in GB (navigator.deviceMemory, capped/approximate) */
  estDeviceMemGB: number
  recommendedModel: ModelId
  reason: string
}

/** Cheap synchronous probe — is the WebGPU API even present? */
export function isAiAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

const isIOS = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS 13+ reports as Mac, but has touch
  (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1)

export async function detectAi(): Promise<AiCapabilities> {
  const ios = typeof navigator !== 'undefined' ? isIOS() : false
  const estDeviceMemGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? (ios ? 4 : 8)

  if (!isAiAvailable()) {
    return { webgpu: false, shaderF16: false, ios, estDeviceMemGB, recommendedModel: 'qwen2.5-0.5b', reason: 'no-webgpu' }
  }

  let shaderF16 = false
  try {
    const gpu = (navigator as unknown as { gpu: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu
    const adapter = await gpu.requestAdapter()
    if (!adapter) {
      return { webgpu: false, shaderF16: false, ios, estDeviceMemGB, recommendedModel: 'qwen2.5-0.5b', reason: 'no-adapter' }
    }
    shaderF16 = adapter.features.has('shader-f16')
  } catch {
    return { webgpu: false, shaderF16: false, ios, estDeviceMemGB, recommendedModel: 'qwen2.5-0.5b', reason: 'adapter-error' }
  }

  // 1.5B is noticeably better but needs RAM headroom; iPhones and low-memory
  // devices get the 0.5B model so they don't run out of memory.
  const recommendedModel: ModelId = !ios && estDeviceMemGB >= 8 ? 'qwen2.5-1.5b' : 'qwen2.5-0.5b'
  return { webgpu: true, shaderF16, ios, estDeviceMemGB, recommendedModel, reason: 'ok' }
}

export const MODEL_INFO: Record<ModelId, { label: string; sizeMB: number }> = {
  'qwen2.5-1.5b': { label: 'Standard (Qwen2.5 1.5B)', sizeMB: 1000 },
  'qwen2.5-0.5b': { label: 'Light (Qwen2.5 0.5B)', sizeMB: 350 },
}
