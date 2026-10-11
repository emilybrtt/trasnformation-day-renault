import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { montarChamado } from '../chamado.js'

describe('montarChamado (B9)', () => {
  const escritorioId = 'test-cha-escritorio'
  const uid = 'test-cha-usuario'
  const fornecedorId = 'test-cha-fornecedor'
  const configId = 'test-cha-config'

  beforeAll(async () => {
    await prisma.escritorio.upsert({
      where: { id: escritorioId },
      create: { id: escritorioId, nome: 'Escritório Chamado', cnpj: '88888888000154' },
      update: {},
    })
    await prisma.usuario.upsert({
      where: { firebaseUid: uid },
      create: { firebaseUid: uid, nome: 'Usuário Chamado', email: 'chamado@test-cha.gavve', perfil: 'ESCRITORIO', escritorioId },
      update: {},
    })
    await prisma.fornecedor.upsert({
      where: { id: fornecedorId },
      create: { id: fornecedorId, codigoSap: '90066', nome: 'TRIBUNAL DE TESTE', cnpj: '99999999000145' },
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
  })

  afterAll(async () => {
    await prisma.solicitacao.deleteMany({ where: { escritorioId } })
    await prisma.historico.deleteMany({ where: { usuarioId: uid } })
    await prisma.usuario.delete({ where: { firebaseUid: uid } })
    await prisma.escritorio.delete({ where: { id: escritorioId } })
    await prisma.fornecedor.delete({ where: { id: fornecedorId } })
    await prisma.configuracaoChamado.delete({ where: { id: configId } })
  })

  it('monta os campos do chamado RBS_DD a partir da solicitação e da configuração', async () => {
    const sol = await prisma.solicitacao.create({
      data: {
        tipoFluxo: 'RBS_DD_GUIA',
        escritorioId,
        criadoPorId: uid,
        fornecedorId,
        status: 'APROVADO',
        formaPagamento: 'BOLETO',
        dataDocumento: new Date('2026-09-22'),
        dataPrevistaPagamento: new Date('2026-10-02'),
        numeroDocumentoLbs: '541047',
        valorTotal: 765963.32,
        observacao: '',
        lancamentos: {
          create: [
            {
              pastaProjuris: '14945',
              area: 'TRABALHISTA PIF/PDV',
              motivo: 'CONDENAÇÃO',
              valorPrincipal: 557380.92,
              valorJurosCorrecao: 208582.4,
              centroCusto: 'GI85031',
              contaContabil: '681580',
              ordemInterna: 'ZDOACONPIF24',
            },
          ],
        },
      },
    })

    const chamado = await montarChamado(sol.id)

    expect(chamado.empresaAprovadora).toBe('0483')
    expect(chamado.fornecedor).toBe('90066 – TRIBUNAL DE TESTE – 99999999000145')
    expect(chamado.identificacaoDocumento).toBe('541047')
    expect(chamado.dataDocumento).toBe('22/09/2026')
    expect(chamado.dataPagamento).toBe('02/10/2026')
    expect(chamado.valorTotal).toBe(765963.32)
    expect(chamado.formaPagamento).toBe('Boleto')
    expect(chamado.motivoDaDemanda).toBe('CONDENAÇÃO')
    expect(chamado.ceCuConsumidor).toBe('GI85031')
    expect(chamado.zedoa).toBe('ZDOACONPIF24')
    expect(chamado.contaContabil).toBe('681580')
    expect(chamado.possuiRateio).toBe('Sim')
    expect(chamado.titulo).toBe('CONDENAÇÃO 02/10')
  })

  it('possuiRateio = "Não" quando não há juros', async () => {
    const sol = await prisma.solicitacao.create({
      data: {
        tipoFluxo: 'RBS_DD_GUIA',
        escritorioId,
        criadoPorId: uid,
        fornecedorId,
        status: 'APROVADO',
        formaPagamento: 'BOLETO',
        dataDocumento: new Date('2026-01-01'),
        valorTotal: 100,
        observacao: '',
        lancamentos: { create: [{ pastaProjuris: '1', area: 'TRABALHISTA PIF/PDV', motivo: 'CONDENAÇÃO', valorPrincipal: 100, valorJurosCorrecao: 0, centroCusto: 'GI85031', contaContabil: '681580', ordemInterna: 'ZDOACONPIF24' }] },
      },
    })
    const chamado = await montarChamado(sol.id)
    expect(chamado.possuiRateio).toBe('Não')
  })
})
