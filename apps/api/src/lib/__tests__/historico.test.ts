import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { registrarHistorico } from '../historico.js'
import { prisma } from '../prisma.js'

describe('registrarHistorico', () => {
  const uid = 'test-historico-usuario'

  beforeAll(async () => {
    await prisma.usuario.upsert({
      where: { firebaseUid: uid },
      create: { firebaseUid: uid, nome: 'Usuário de Teste', email: 'historico@test.gavve', perfil: 'ANALISTA' },
      update: {},
    })
  })

  afterAll(async () => {
    await prisma.historico.deleteMany({ where: { usuarioId: uid } })
    await prisma.usuario.delete({ where: { firebaseUid: uid } })
  })

  it('grava uma linha de histórico com o diff', async () => {
    await registrarHistorico({
      entidade: 'Solicitacao',
      entidadeId: 'sol-123',
      acao: 'aprovar',
      usuarioId: uid,
      diff: { status: { de: 'EM_CONFERENCIA', para: 'APROVADO' } },
    })

    const linhas = await prisma.historico.findMany({ where: { entidadeId: 'sol-123', usuarioId: uid } })
    expect(linhas).toHaveLength(1)
    expect(linhas[0].acao).toBe('aprovar')
    expect(linhas[0].diff).toEqual({ status: { de: 'EM_CONFERENCIA', para: 'APROVADO' } })
  })
})
