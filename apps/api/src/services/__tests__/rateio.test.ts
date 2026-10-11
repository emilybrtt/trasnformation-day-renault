import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import type { LinhaRateio } from '../rateio.js'
import { garantirDebitoIgualCredito, montarLinhasRateio } from '../rateio.js'

describe('rateio contábil (B8)', () => {
  const escritorioId = 'test-rat-escritorio'
  const uid = 'test-rat-usuario'
  const fornecedorId = 'test-rat-fornecedor'
  const ano = 2033

  beforeAll(async () => {
    await prisma.escritorio.upsert({
      where: { id: escritorioId },
      create: { id: escritorioId, nome: 'Escritório Rateio', cnpj: '44444444000190' },
      update: {},
    })
    await prisma.usuario.upsert({
      where: { firebaseUid: uid },
      create: { firebaseUid: uid, nome: 'Usuário Rateio', email: 'rateio@test-rat.gavve', perfil: 'ESCRITORIO', escritorioId },
      update: {},
    })
    await prisma.fornecedor.upsert({
      where: { id: fornecedorId },
      create: { id: fornecedorId, codigoSap: '90099', nome: 'Fornecedor Rateio (teste)', cnpj: '55555555000181' },
      update: {},
    })
    // Reaproveita os códigos contábeis reais do exemplo do briefing (TRABALHISTA PIF/PDV · CONDENAÇÃO).
    await prisma.deParaContabil.upsert({
      where: { area_motivo_ano: { area: 'TRABALHISTA PIF/PDV', motivo: 'CONDENAÇÃO', ano } },
      create: { area: 'TRABALHISTA PIF/PDV', motivo: 'CONDENAÇÃO', centroCusto: 'GI85031', contaContabil: '681580', ordemInterna: 'ZDOACONPIF24', ano, ativo: true },
      update: {},
    })
  })

  afterAll(async () => {
    await prisma.solicitacao.deleteMany({ where: { escritorioId } })
    await prisma.historico.deleteMany({ where: { usuarioId: uid } })
    await prisma.usuario.delete({ where: { firebaseUid: uid } })
    await prisma.escritorio.delete({ where: { id: escritorioId } })
    await prisma.fornecedor.delete({ where: { id: fornecedorId } })
    await prisma.deParaContabil.deleteMany({ where: { area: 'TRABALHISTA PIF/PDV', motivo: 'CONDENAÇÃO', ano } })
  })

  it('reproduz o exemplo do briefing: 40/Deb principal + 40/Deb juros + 31/Cred com a soma', async () => {
    const sol = await prisma.solicitacao.create({
      data: {
        tipoFluxo: 'RBS_DD_GUIA',
        escritorioId,
        criadoPorId: uid,
        fornecedorId,
        status: 'RASCUNHO',
        formaPagamento: 'BOLETO',
        dataDocumento: new Date(`${ano}-09-22`),
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

    const linhas = await montarLinhasRateio(sol.id)
    expect(linhas).toHaveLength(3)

    expect(linhas[0]).toMatchObject({
      chave: '40',
      debCred: 'Deb',
      conta: '681580',
      referencia: '541047',
      ordemInterna: 'ZDOACONPIF24',
      centroCusto: 'GI85031',
      valor: 557380.92,
      atribuicao: '14945',
      textoMes: 'CONDENAÇÃO',
    })
    expect(linhas[1]).toMatchObject({
      chave: '40',
      debCred: 'Deb',
      conta: '686242',
      ordemInterna: 'ZDOACONPIF24',
      centroCusto: 'GI85030',
      valor: 208582.4,
      textoMes: 'Juros e Correção',
    })
    expect(linhas[2]).toMatchObject({ chave: '31', debCred: 'Cred', conta: '90099', valor: 765963.32 })

    expect(linhas[0].dtDocumento).toBe('22.09.2033')
    expect(() => garantirDebitoIgualCredito(linhas)).not.toThrow()
  })

  it('ANEXO_V_BAIXA credita na conta 108067 com o texto "Baixa de adiantamento <escritório>"', async () => {
    const sol = await prisma.solicitacao.create({
      data: {
        tipoFluxo: 'ANEXO_V_BAIXA',
        escritorioId,
        criadoPorId: uid,
        status: 'RASCUNHO',
        formaPagamento: 'TED',
        dataDocumento: new Date(`${ano}-05-10`),
        valorTotal: 1000,
        observacao: '',
        lancamentos: {
          create: [
            { pastaProjuris: '1', area: 'TRABALHISTA PIF/PDV', motivo: 'CONDENAÇÃO', valorPrincipal: 1000, valorJurosCorrecao: 0, centroCusto: 'GI85031', contaContabil: '681580', ordemInterna: 'ZDOACONPIF24' },
          ],
        },
      },
    })
    const linhas = await montarLinhasRateio(sol.id)
    const credito = linhas.at(-1)!
    expect(credito.conta).toBe('108067')
    expect(credito.textoCabDocumento).toBe('Baixa de adiantamento Escritório Rateio')
  })

  it('lança 422 quando um lançamento não tem de-para resolvido', async () => {
    const sol = await prisma.solicitacao.create({
      data: {
        tipoFluxo: 'RBS_DD_GUIA',
        escritorioId,
        criadoPorId: uid,
        fornecedorId,
        status: 'RASCUNHO',
        formaPagamento: 'BOLETO',
        dataDocumento: new Date(`${ano}-01-01`),
        valorTotal: 10,
        observacao: '',
        lancamentos: { create: [{ pastaProjuris: '2', area: 'SEM', motivo: 'SEM', valorPrincipal: 10, valorJurosCorrecao: 0 }] },
      },
    })
    await expect(montarLinhasRateio(sol.id)).rejects.toThrow(/de-para/)
  })

  it('garantirDebitoIgualCredito: rejeita quando a soma dos débitos não bate com o crédito', () => {
    const linhas: LinhaRateio[] = [
      { chave: '40', debCred: 'Deb', conta: 'C1', referencia: '', elementoPep: '', ordemInterna: '', centroCusto: '', tipoAtividade: '', valor: 100, moeda: 'BRL', textoCabDocumento: '', dtLancamento: '01.01.2033', dtDocumento: '01.01.2033', atribuicao: '', numeroAtivo: '', textoMes: '' },
      { chave: '31', debCred: 'Cred', conta: 'C2', referencia: '', elementoPep: '', ordemInterna: '', centroCusto: '', tipoAtividade: '', valor: 99, moeda: 'BRL', textoCabDocumento: '', dtLancamento: '01.01.2033', dtDocumento: '01.01.2033', atribuicao: '', numeroAtivo: '', textoMes: '' },
    ]
    expect(() => garantirDebitoIgualCredito(linhas)).toThrow(/não bate/)
  })
})
