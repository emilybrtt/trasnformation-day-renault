import { MockLbs } from './mockLbs.js'
import type { IntegracaoLbs } from './types.js'

export type { IntegracaoLbs, ResultadoEnvioLbs } from './types.js'

let instancia: IntegracaoLbs | undefined

/** Instância única (lazy) — hoje é sempre o mock; ver mockLbs.ts sobre o porquê.
 * `LBS_MOCK_DELAY_MS` existe só para os testes não esperarem 1,5s de verdade. */
export function getIntegracaoLbs(): IntegracaoLbs {
  instancia ??= new MockLbs(process.env.LBS_MOCK_DELAY_MS ? Number(process.env.LBS_MOCK_DELAY_MS) : undefined)
  return instancia
}
