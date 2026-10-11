import type { DadosExtraidos, TipoDocumentoExtracao } from './extracao.js'
import type { DeclaracaoFerramenta, EscolhaFerramenta, MensagemAgente } from './ferramentas.js'

export interface LlmProvider {
  readonly nome: 'mock' | 'gemini'
  /**
   * Geração de texto livre.
   */
  gerarTexto(prompt: string): Promise<string>
  /** Extração estruturada dos campos de uma guia ou NF a partir do PDF (B10). */
  extrairDocumento(tipo: TipoDocumentoExtracao, pdfBuffer: Buffer): Promise<DadosExtraidos>
  /** Assistente de relatórios (B11): escolhe qual ferramenta parametrizada chamar
   * (e com quais parâmetros) para responder a mensagem — nunca SQL livre, nunca
   * executa a consulta aqui mesmo (isso é `services/agente.ts`). `null` quando
   * nenhuma ferramenta se aplica. */
  escolherFerramenta(
    mensagem: string,
    historico: MensagemAgente[],
    ferramentas: DeclaracaoFerramenta[],
  ): Promise<EscolhaFerramenta | null>
}
