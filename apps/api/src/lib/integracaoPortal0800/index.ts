import { MockPortal0800 } from './mockPortal0800.js'
import type { IntegracaoPortal0800 } from './types.js'

export type { IntegracaoPortal0800, ResultadoLancarNf } from './types.js'

let instancia: IntegracaoPortal0800 | undefined

export function getIntegracaoPortal0800(): IntegracaoPortal0800 {
  instancia ??= new MockPortal0800(
    process.env.PORTAL0800_MOCK_DELAY_MS ? Number(process.env.PORTAL0800_MOCK_DELAY_MS) : undefined,
  )
  return instancia
}
