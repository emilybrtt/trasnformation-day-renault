import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import * as servico from '../solicitacoes.js'
import type { UsuarioAutenticado } from '../../middleware/auth.js'

describe('os 3 fluxos de pagamento (F12)', () => {
  const escritorioId = 'test-f12-escritorio'
  const uid = 'test-f12-usuario'
  const ano = 2036 // ano exclusivo dos testes

  const usuarioAnalista: UsuarioAutenticado = {
    firebaseUid: 'test-f12-analista',
    nome: 'Analista Teste',
    email: 'analista@test-f12.gavve',
    perfil: 'ANALISTA',
    escritorioId: null,
  }

  beforeAll(async () => {
    await prisma.escritorio.upsert({
      where: { id: escritorioId },
      create: { id: escritorioId, nome: 'Escritório F12', cnpj: '30303030000190' },
      update: {},
    })
    await prisma.usuario.upsert({
      where: { firebaseUid: uid },
      create: { firebaseUid: uid, nome: 'Usuário F12', email: 'f12@test-f12.gavve', perfil: 'ESCRITORIO', escritorioId },
      update: {},
    })
    await prisma.usuario.upsert({
      where: { firebaseUid: usuarioAnalista.firebaseUid },
      create: { firebaseUid: usuarioAnalista.firebaseUid, nome: usuarioAnalista.nome, email: usuarioAnalista.email, perfil: 'ANALISTA' },
      update: {},
    })
    await prisma.deParaContabil.upsert({
      where: { area_motivo_ano: { area: 'F12', motivo: 'F12', ano } },
      create: { area: 'F12', motivo: 'F12', centroCusto: 'CC', contaContabil: 'CT', ordemInterna: 'OI', ano, ativo: true },
      update: {},
    })
  })

  afterAll(async () => {
    await prisma.solicitacao.deleteMany({ where: { escritorioId } })
    await prisma.historico.deleteMany({ where: { usuarioId: { in: [uid, usuarioAnalista.firebaseUid] } } })
    await prisma.usuario.deleteMany({ where: { firebaseUid: { in: [uid, usuarioAnalista.firebaseUid] } } })
    await prisma.escritorio.delete({ where: { id: escritorioId } })
    await prisma.deParaContabil.deleteMany({ where: { area: 'F12', motivo: 'F12', ano } })
  })

  async function criarAprovada(tipoFluxo: 'ANEXO_V_BAIXA' | 'RC_HONORARIOS_NF' | 'RBS_DD_GUIA', pasta: string) {
    return prisma.solicitacao.create({
      data: {
        tipoFluxo,
        escritorioId,
        criadoPorId: uid,
        status: 'APROVADO',
        formaPagamento: 'BOLETO',
        dataDocumento: new Date(`${ano}-02-01`),
        valorTotal: 100,
        observacao: '',
        lancamentos: { create: [{ pastaProjuris: pasta, area: 'F12', motivo: 'F12', valorPrincipal: 100, valorJurosCorrecao: 0, centroCusto: 'CC', contaContabil: 'CT', ordemInterna: 'OI' }] },
      },
    })
  }

  it('ANEXO_V: APROVADO → chamado (Portal SSC mock) → PAGO', async () => {
    const sol = await criarAprovada('ANEXO_V_BAIXA', '1')

    const comChamado = await servico.abrirChamadoAnexoV(usuarioAnalista, sol.id)
    expect(comChamado.status).toBe('CHAMADO_ABERTO')
    expect(comChamado.numeroChamado).toMatch(/^BR-\d{6}$/)

    const pago = await servico.registrarPagamento(usuarioAnalista, sol.id, { dataPagamento: new Date(`${ano}-02-10`) })
    expect(pago.status).toBe('PAGO')
  })

  it('RC_HONORARIOS: APROVADO → RC (SAP) → NF (Portal 0800) → pagamento programado (SAP) → PAGO', async () => {
    const sol = await criarAprovada('RC_HONORARIOS_NF', '2')

    const comRc = await servico.criarRc(usuarioAnalista, sol.id)
    expect(comRc.status).toBe('RC_CRIADO')
    expect(comRc.numeroRc).toMatch(/^RC\d+$/)

    const comNf = await servico.lancarNf(usuarioAnalista, sol.id)
    expect(comNf.status).toBe('NF_LANCADA')
    expect(comNf.protocoloNf).toMatch(/^PROT-\d{6}$/)

    const comPagamentoProgramado = await servico.programarPagamento(usuarioAnalista, sol.id)
    expect(comPagamentoProgramado.status).toBe('PAGAMENTO_PROGRAMADO')
    expect(comPagamentoProgramado.numeroDocumentoSap).toMatch(/^DOC\d+$/)

    const pago = await servico.registrarPagamento(usuarioAnalista, sol.id, { dataPagamento: new Date(`${ano}-02-15`) })
    expect(pago.status).toBe('PAGO')
  })

  it('RBS_DD: APROVADO → chamado (B9, já existente) → PAGO — continua funcionando', async () => {
    const sol = await criarAprovada('RBS_DD_GUIA', '3')
    const comChamado = await servico.abrirChamado(usuarioAnalista, sol.id, 'BR-999999')
    expect(comChamado.status).toBe('CHAMADO_ABERTO')
    const pago = await servico.registrarPagamento(usuarioAnalista, sol.id, { dataPagamento: new Date(`${ano}-02-20`) })
    expect(pago.status).toBe('PAGO')
  })

  it('cada ação só se aplica à família certa (422 cruzado)', async () => {
    const anexoV = await criarAprovada('ANEXO_V_BAIXA', '4')
    await expect(servico.criarRc(usuarioAnalista, anexoV.id)).rejects.toMatchObject({ status: 422 })
    await expect(servico.abrirChamado(usuarioAnalista, anexoV.id, 'BR-1')).rejects.toMatchObject({ status: 422 })

    const rc = await criarAprovada('RC_HONORARIOS_NF', '5')
    await expect(servico.abrirChamadoAnexoV(usuarioAnalista, rc.id)).rejects.toMatchObject({ status: 422 })

    const rbsDd = await criarAprovada('RBS_DD_GUIA', '6')
    await expect(servico.criarRc(usuarioAnalista, rbsDd.id)).rejects.toMatchObject({ status: 422 })
  })

  it('transição fora de ordem dá 409 (ex.: lançar NF sem RC criado)', async () => {
    const sol = await criarAprovada('RC_HONORARIOS_NF', '7')
    await expect(servico.lancarNf(usuarioAnalista, sol.id)).rejects.toMatchObject({ status: 409 })
    await expect(servico.programarPagamento(usuarioAnalista, sol.id)).rejects.toMatchObject({ status: 409 })
  })
})
