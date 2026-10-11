import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { obterIdTokenDeTeste } from '../../test-helpers/emulatorAuth.js'

process.env.LBS_MOCK_DELAY_MS = '10' // não esperar 1,5s de verdade nos testes

const semEmulador = !process.env.FIREBASE_AUTH_EMULATOR_HOST

describe.skipIf(semEmulador)('chamado + integração LBS (B9)', () => {
  const app = createApp()
  const escritorioId = 'test-rota-cha-escritorio'
  const uidEscritorio = 'test-rota-cha-escritorio-uid'
  const uidAnalista = 'test-rota-cha-analista-uid'
  const fornecedorId = 'test-rota-cha-fornecedor'
  const configId = 'test-rota-cha-config'

  let tokenEscritorio: string
  let tokenAnalista: string

  beforeAll(async () => {
    await prisma.escritorio.upsert({
      where: { id: escritorioId },
      create: { id: escritorioId, nome: 'Escritório Rota Chamado', cnpj: '11122233000199' },
      update: {},
    })
    await prisma.usuario.createMany({
      data: [
        { firebaseUid: uidEscritorio, nome: 'E', email: 'e@test-rota-cha.gavve', perfil: 'ESCRITORIO', escritorioId },
        { firebaseUid: uidAnalista, nome: 'A', email: 'a@test-rota-cha.gavve', perfil: 'ANALISTA' },
      ],
      skipDuplicates: true,
    })
    await prisma.fornecedor.upsert({
      where: { id: fornecedorId },
      create: { id: fornecedorId, codigoSap: '90077', nome: 'Fornecedor Rota Chamado', cnpj: '22233344000180' },
      update: {},
    })
    await prisma.configuracaoChamado.upsert({
      where: { id: configId },
      create: {
        id: configId,
        empresaAprovadora: '0483',
        empresaConsumidora: '0483',
        nomeSolicitante: 'Pagamentos Jurídico',
        naturezaGasto: '0007 - Acts and…',
        classificacao: 'Despesas administrativas (Centro de Custo)',
        alocacao: '0007 - 622700 - CUSTOS DE ATOS E LITÍGIOS',
        ceCuAprovador: 'GI52000',
        ativo: true,
      },
      update: { ativo: true },
    })

    tokenEscritorio = await obterIdTokenDeTeste(uidEscritorio)
    tokenAnalista = await obterIdTokenDeTeste(uidAnalista)
  })

  afterAll(async () => {
    await prisma.solicitacao.deleteMany({ where: { escritorioId } })
    await prisma.historico.deleteMany({ where: { usuarioId: { in: [uidEscritorio, uidAnalista] } } })
    await prisma.usuario.deleteMany({ where: { firebaseUid: { in: [uidEscritorio, uidAnalista] } } })
    await prisma.escritorio.delete({ where: { id: escritorioId } })
    await prisma.fornecedor.delete({ where: { id: fornecedorId } })
    await prisma.configuracaoChamado.delete({ where: { id: configId } })
  })

  async function criarSolicitacaoAprovada() {
    return prisma.solicitacao.create({
      data: {
        tipoFluxo: 'RBS_DD_GUIA',
        escritorioId,
        criadoPorId: uidEscritorio,
        fornecedorId,
        status: 'APROVADO',
        formaPagamento: 'BOLETO',
        dataDocumento: new Date('2026-04-01'),
        valorTotal: 500,
        observacao: '',
        lancamentos: { create: [{ pastaProjuris: '1', area: 'VAL', motivo: 'VAL', valorPrincipal: 500, valorJurosCorrecao: 0, centroCusto: 'CC', contaContabil: 'CT', ordemInterna: 'OI' }] },
      },
    })
  }

  it('GET /solicitacoes/:id/chamado: 403 para ESCRITORIO, 200 para ANALISTA', async () => {
    const sol = await criarSolicitacaoAprovada()

    const negado = await request(app).get(`/solicitacoes/${sol.id}/chamado`).set('Authorization', `Bearer ${tokenEscritorio}`)
    expect(negado.status).toBe(403)

    const res = await request(app).get(`/solicitacoes/${sol.id}/chamado`).set('Authorization', `Bearer ${tokenAnalista}`)
    expect(res.status).toBe(200)
    expect(res.body.empresaAprovadora).toBe('0483')
    expect(res.body.fornecedor).toContain('90077')
  })

  it('POST /integracoes/lbs/enviar/:id: envia, grava o número e muda para CHAMADO_ABERTO', async () => {
    const sol = await criarSolicitacaoAprovada()

    const res = await request(app)
      .post(`/integracoes/lbs/enviar/${sol.id}`)
      .set('Authorization', `Bearer ${tokenAnalista}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CHAMADO_ABERTO')
    expect(res.body.numeroChamado).toMatch(/^BR-\d{6}$/)
  })

  it('POST /integracoes/lbs/enviar/:id: 409 se a solicitação não está APROVADA', async () => {
    const sol = await prisma.solicitacao.create({
      data: {
        tipoFluxo: 'RBS_DD_GUIA',
        escritorioId,
        criadoPorId: uidEscritorio,
        fornecedorId,
        status: 'RASCUNHO',
        formaPagamento: 'BOLETO',
        dataDocumento: new Date('2026-04-01'),
        valorTotal: 100,
        observacao: '',
        lancamentos: { create: [{ pastaProjuris: '2', area: 'VAL', motivo: 'VAL', valorPrincipal: 100, valorJurosCorrecao: 0 }] },
      },
    })
    const res = await request(app).post(`/integracoes/lbs/enviar/${sol.id}`).set('Authorization', `Bearer ${tokenAnalista}`)
    expect(res.status).toBe(409)
  })
})
