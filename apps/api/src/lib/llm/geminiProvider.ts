import { GoogleGenAI } from '@google/genai'
import type { LlmProvider } from './types.js'

export interface GeminiClient {
  models: {
    generateContent(args: { model: string; contents: string }): Promise<{
      text?: string
      usageMetadata?: { totalTokenCount?: number }
    }>
  }
}

export interface GeminiProviderOptions {
  apiKey?: string
  vertexProject?: string
  vertexLocation?: string
  model?: string
  client?: GeminiClient
}

function criarClientePadrao(opts: GeminiProviderOptions): GeminiClient {
  if (opts.apiKey) {
    return new GoogleGenAI({ apiKey: opts.apiKey }) as unknown as GeminiClient
  }
  return new GoogleGenAI({
    vertexai: true,
    project: opts.vertexProject,
    location: opts.vertexLocation ?? 'us-central1',
  }) as unknown as GeminiClient
}

export class GeminiProvider implements LlmProvider {
  readonly nome = 'gemini' as const
  private readonly model: string
  private readonly client: GeminiClient

  constructor(opts: GeminiProviderOptions = {}) {
    this.model = opts.model ?? 'gemini-2.0-flash'
    this.client = opts.client ?? criarClientePadrao(opts)
  }

  async gerarTexto(prompt: string): Promise<string> {
    const res = await this.client.models.generateContent({ model: this.model, contents: prompt })
    if (res.usageMetadata?.totalTokenCount != null) {
      console.log(`[gemini] tokens usados: ${res.usageMetadata.totalTokenCount}`)
    }
    return res.text ?? ''
  }
}
