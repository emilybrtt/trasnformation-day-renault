export interface LlmProvider {
  readonly nome: 'mock' | 'gemini'
  /**
   * Geração de texto livre. Os cards B10 (extração estruturada de PDFs) e B11
   * (assistente com function calling) adicionam métodos mais específicos aqui.
   */
  gerarTexto(prompt: string): Promise<string>
}
