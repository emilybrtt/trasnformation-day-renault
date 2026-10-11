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

  describe('extrairDocumento', () => {
    it('envia o PDF em base64 + instrução e devolve o JSON parseado', async () => {
      type Args = Parameters<GeminiClient['models']['generateContent']>[0]
      let argsRecebidos: Args | undefined
      const generateContent = vi.fn(async (args: Args) => {
        argsRecebidos = args
        return { text: '{"valor": 100, "numeroNf": "1"}' }
      })
      const client: GeminiClient = { models: { generateContent } }
      const provider = new GeminiProvider({ model: 'gemini-2.0-flash', client })

      const resultado = await provider.extrairDocumento('NF', Buffer.from('conteudo-pdf'))

      expect(resultado).toEqual({ valor: 100, numeroNf: '1' })
      expect(argsRecebidos?.model).toBe('gemini-2.0-flash')
      expect(argsRecebidos?.config).toEqual({ responseMimeType: 'application/json' })
      expect(argsRecebidos?.contents).toEqual([
        { inlineData: { mimeType: 'application/pdf', data: Buffer.from('conteudo-pdf').toString('base64') } },
        { text: expect.stringContaining('nota fiscal') },
      ])
    })

    it('devolve objeto vazio quando a resposta não é um JSON válido', async () => {
      const client: GeminiClient = { models: { generateContent: vi.fn(async () => ({ text: 'não é json' })) } }
      const provider = new GeminiProvider({ client })
      expect(await provider.extrairDocumento('GUIA', Buffer.from('x'))).toEqual({})
    })
  })
})
