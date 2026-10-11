import { describe, expect, it, vi } from 'vitest'
import type { GeminiClient } from '../geminiProvider.js'
import { GeminiProvider } from '../geminiProvider.js'

describe('GeminiProvider', () => {
  it('usa o modelo e devolve o texto da resposta', async () => {
    const generateContent = vi.fn(async () => ({ text: 'olá', usageMetadata: { totalTokenCount: 42 } }))
    const client: GeminiClient = { models: { generateContent } }

    const provider = new GeminiProvider({ model: 'gemini-2.0-flash', client })
    const texto = await provider.gerarTexto('oi')

    expect(texto).toBe('olá')
    expect(generateContent).toHaveBeenCalledWith({ model: 'gemini-2.0-flash', contents: 'oi' })
  })

  it('devolve string vazia quando a resposta não tem texto', async () => {
    const client: GeminiClient = { models: { generateContent: vi.fn(async () => ({})) } }
    const provider = new GeminiProvider({ client })
    expect(await provider.gerarTexto('oi')).toBe('')
  })
})
