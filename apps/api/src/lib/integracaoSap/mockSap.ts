import type { IntegracaoSAP, ResultadoCriarRc, ResultadoProgramarPagamento } from './types.js'

function numeroAleatorio(prefixo: string): string {
  return `${prefixo}${String(Math.floor(Math.random() * 90000000) + 10000000)}`
}

export class MockSap implements IntegracaoSAP {
  readonly nome = 'mock' as const
  private readonly delayMs: number

  constructor(delayMs = 1000) {
    this.delayMs = delayMs
  }

  async criarRc(_solicitacaoId: string): Promise<ResultadoCriarRc> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs))
    return { numeroRc: numeroAleatorio('RC') }
  }

  async programarPagamento(_solicitacaoId: string): Promise<ResultadoProgramarPagamento> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs))
    return { numeroDocumentoSap: numeroAleatorio('DOC') }
  }
}
