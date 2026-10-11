import type { IntegracaoLbs, ResultadoEnvioLbs } from './types.js'

function numeroChamadoAleatorio(): string {
  return `BR-${String(Math.floor(Math.random() * 900000) + 100000)}`
}

/**
 * A integração com o portal SSC/LBS é sempre simulada neste MVP — nunca automatizar
 * `portalssc.renault.br` de verdade (regra do briefing). Não existe (nem deve
 * existir) uma implementação real desta interface.
 */
export class MockLbs implements IntegracaoLbs {
  readonly nome = 'mock' as const
  private readonly delayMs: number

  constructor(delayMs = 1500) {
    this.delayMs = delayMs
  }

  async enviar(_solicitacaoId: string): Promise<ResultadoEnvioLbs> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs))
    return { numeroChamado: numeroChamadoAleatorio() }
  }
}
