import { prisma } from './prisma.js'

export interface DeParaResolvido {
  centroCusto: string
  contaContabil: string
  ordemInterna: string | null
}

/** O preenchimento contábil é sempre calculado no servidor — nunca digitado pelo
 * usuário. Devolve null quando não há de-para cadastrado para Área+Motivo+ano
 * (vira o alerta DE_PARA_INEXISTENTE no B7). */
export async function resolverDePara(area: string, motivo: string, ano: number): Promise<DeParaResolvido | null> {
  const linha = await prisma.deParaContabil.findUnique({
    where: { area_motivo_ano: { area, motivo, ano } },
  })
  if (!linha || !linha.ativo) return null
  return { centroCusto: linha.centroCusto, contaContabil: linha.contaContabil, ordemInterna: linha.ordemInterna }
}
