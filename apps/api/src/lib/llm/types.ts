import type { DadosExtraidos, TipoDocumentoExtracao } from './extracao.js'

export interface LlmProvider {
  readonly nome: 'mock' | 'gemini'
  /**
   * Geração de texto livre. O card B11 (assistente com function calling) adiciona
   * um método mais específico aqui.
   */
  gerarTexto(prompt: string): Promise<string>
  /** Extração estruturada dos campos de uma guia ou NF a partir do PDF (B10). */
  extrairDocumento(tipo: TipoDocumentoExtracao, pdfBuffer: Buffer): Promise<DadosExtraidos>
}
