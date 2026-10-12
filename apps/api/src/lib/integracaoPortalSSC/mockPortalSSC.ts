import type { IntegracaoPortalSSC, ResultadoChamadoAnexoV } from './types.js'

function numeroChamadoAleatorio(): string {
  return `BR-${String(Math.floor(Math.random() * 900000) + 100000)}`
}

export class MockPortalSSC implements IntegracaoPortalSSC {
  readonly nome = 'mock' as const
  private readonly delayMs: number

  constructor(delayMs = 1000) {
    this.delayMs = delayMs
  }

  async abrirChamadoAnexoV(_solicitacaoId: string): Promise<ResultadoChamadoAnexoV> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs))
    return { numeroChamado: numeroChamadoAleatorio() }
  }
}
