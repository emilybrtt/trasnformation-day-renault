import { GoogleGenAI } from '@google/genai'
import type { DadosExtraidos, TipoDocumentoExtracao } from './extracao.js'
import type { LlmProvider } from './types.js'

export type GeminiContents = string | Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>

export interface GeminiClient {
  models: {
    generateContent(args: {
      model: string
      contents: GeminiContents
      config?: { responseMimeType?: string }
    }): Promise<{
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

const INSTRUCAO_EXTRACAO: Record<TipoDocumentoExtracao, string> = {
  GUIA:
    'Extraia os campos desta guia de recolhimento judicial e devolva só um JSON (sem markdown) ' +
    'com as chaves: beneficiarioNome, beneficiarioCnpj, numeroProcesso, nossoNumero, numeroDocumento, ' +
    'dataDocumento, dataVencimento, valor (número, sem "R$"), linhaDigitavel.',
  NF:
    'Extraia os campos desta nota fiscal de serviços e devolva só um JSON (sem markdown) com as ' +
    'chaves: numeroNf, cnpjPrestador, nomePrestador, dataEmissao, valorServico (número), ' +
    'valorLiquido (número), descricao.',
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
    this.logarTokens(res.usageMetadata)
    return res.text ?? ''
  }

  async extrairDocumento(tipo: TipoDocumentoExtracao, pdfBuffer: Buffer): Promise<DadosExtraidos> {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: [
        { inlineData: { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') } },
        { text: INSTRUCAO_EXTRACAO[tipo] },
      ],
      config: { responseMimeType: 'application/json' },
    })
    this.logarTokens(res.usageMetadata)
    try {
      return JSON.parse(res.text ?? '{}') as DadosExtraidos
    } catch {
      return {}
    }
  }

  private logarTokens(usageMetadata?: { totalTokenCount?: number }) {
    if (usageMetadata?.totalTokenCount != null) {
      console.log(`[gemini] tokens usados: ${usageMetadata.totalTokenCount}`)
    }
  }
}
