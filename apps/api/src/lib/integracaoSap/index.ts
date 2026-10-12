import { MockSap } from './mockSap.js'
import type { IntegracaoSAP } from './types.js'

export type { IntegracaoSAP, ResultadoCriarRc, ResultadoProgramarPagamento } from './types.js'

let instancia: IntegracaoSAP | undefined

export function getIntegracaoSap(): IntegracaoSAP {
  instancia ??= new MockSap(process.env.SAP_MOCK_DELAY_MS ? Number(process.env.SAP_MOCK_DELAY_MS) : undefined)
  return instancia
}
