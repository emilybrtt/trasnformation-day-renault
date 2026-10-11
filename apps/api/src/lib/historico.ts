import type { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

export interface RegistrarHistoricoParams {
  entidade: string
  entidadeId: string
  acao: string
  usuarioId: string
  diff: Prisma.InputJsonValue
}

/** Toda escrita em entidades de negócio (solicitações, lançamentos, alertas...)
 * deve chamar isto — é a trilha de auditoria do módulo (B6+). */
export async function registrarHistorico(params: RegistrarHistoricoParams): Promise<void> {
  await prisma.historico.create({ data: params })
}
