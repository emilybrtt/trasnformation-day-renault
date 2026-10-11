import { prisma } from './prisma.js'

export interface CriarNotificacaoParams {
  escritorioId: string
  solicitacaoId?: string
  mensagem: string
}

/** Notificação para o escritório (B13) — hoje só disparada ao anexar comprovante
 * de pagamento, mas qualquer card futuro pode reusar isto. */
export async function criarNotificacao(params: CriarNotificacaoParams): Promise<void> {
  await prisma.notificacao.create({ data: params })
}
