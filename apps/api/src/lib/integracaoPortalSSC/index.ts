import { MockPortalSSC } from './mockPortalSSC.js'
import type { IntegracaoPortalSSC } from './types.js'

export type { IntegracaoPortalSSC, ResultadoChamadoAnexoV } from './types.js'

let instancia: IntegracaoPortalSSC | undefined

export function getIntegracaoPortalSSC(): IntegracaoPortalSSC {
  instancia ??= new MockPortalSSC(
    process.env.SSC_MOCK_DELAY_MS ? Number(process.env.SSC_MOCK_DELAY_MS) : undefined,
  )
  return instancia
}
