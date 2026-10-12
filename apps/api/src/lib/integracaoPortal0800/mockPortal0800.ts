import type { IntegracaoPortal0800, ResultadoLancarNf } from './types.js'

function protocoloAleatorio(): string {
  return `PROT-${String(Math.floor(Math.random() * 900000) + 100000)}`
}

export class MockPortal0800 implements IntegracaoPortal0800 {
  readonly nome = 'mock' as const
  private readonly delayMs: number

  constructor(delayMs = 1000) {
    this.delayMs = delayMs
  }

  async lancarNf(_solicitacaoId: string): Promise<ResultadoLancarNf> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs))
    return { protocolo: protocoloAleatorio() }
  }
}
