import { z } from 'zod'

// Placeholder do pacote compartilhado — os schemas reais (solicitações, lançamentos,
// de-para contábil etc.) entram nos cards B6 em diante, nesta mesma pasta.
export const pingSchema = z.object({
  status: z.literal('ok'),
})

export type Ping = z.infer<typeof pingSchema>
