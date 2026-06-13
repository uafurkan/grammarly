/// <reference lib="webworker" />
// Hosts the web-llm engine off the main thread so token generation never
// blocks typing. The handler does all the WebGPU work here.

import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

const handler = new WebWorkerMLCEngineHandler()
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg)
}
