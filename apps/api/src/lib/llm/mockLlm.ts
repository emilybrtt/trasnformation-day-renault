import type { LlmProvider } from './types.js'

/** Provider determinístico, usado quando GEMINI_API_KEY não está configurada. */
export class MockLlm implements LlmProvider {
  readonly nome = 'mock' as const

  async gerarTexto(prompt: string): Promise<string> {
    return `[mock] resposta determinística para: ${prompt.slice(0, 120)}`
  }
}
