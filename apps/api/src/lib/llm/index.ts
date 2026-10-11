import { GeminiProvider } from './geminiProvider.js'
import { MockLlm } from './mockLlm.js'
import type { LlmProvider } from './types.js'

export type { LlmProvider } from './types.js'

let instancia: LlmProvider | undefined

export function criarLlmProvider(env = process.env): LlmProvider {
  if (env.LLM_PROVIDER === 'gemini') {
    return new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      vertexProject: env.GCLOUD_PROJECT,
      model: env.GEMINI_MODEL,
    })
  }
  return new MockLlm()
}

/** Instância única (lazy) para uso pelas rotas da API. */
export function getLlmProvider(): LlmProvider {
  instancia ??= criarLlmProvider()
  return instancia
}
