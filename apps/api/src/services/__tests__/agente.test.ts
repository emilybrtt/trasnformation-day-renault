import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import * as agente from '../agente.js'

describe('agente — ferramentas (B11)', () => {
  const escritorioId = 'test-agente-escritorio'
  const uid = 'test-agente-usuario'
  const ano = 2033 // ano exclusivo dos testes, sem interferir com outras fixtures

  beforeAll(async () => {
    await prisma.escritorio.upsert({
      where: { id: escritorioId },
      create: { id: escritorioId, nome: 'Escritório Agente', cnpj: '20202020000100' },
      update: {},
    })
    await prisma.usuario.upsert({
      where: { firebaseUid: uid },
      create: { firebaseUid: uid, nome: 'Usuário Agente', email: 'agente@test-agente.gavve', perfil: 'ESCRITORIO', escritorioId },
      update: {},
    })

    async function criar(opts: {
      status: 'EM_CONFERENCIA' | 'PAGO'
      dataPagamento?: Date
      valorTotal: number
      area: string
      motivo: string
      valorPrincipal: number
      pastaProjuris: string
      ordemInterna?: string
      tipoFluxo?: 'RBS_DD_GUIA' | 'RC_HONORARIOS_NF'
      semaforo?: 'VERDE' | 'AMARELO' | 'VERMELHO'
    }) {
      return prisma.solicitacao.create({
        data: {
          tipoFluxo: opts.tipoFluxo ?? 'RBS_DD_GUIA',
          escritorioId,
          criadoPorId: uid,
          status: opts.status,
          formaPagamento: 'BOLETO',
          dataDocumento: new Date(`${ano}-01-01`),
          dataPagamento: opts.dataPagamento,
          valorTotal: opts.valorTotal,
          observacao: '',
          lancamentos: {
            create: [
              {
                pastaProjuris: opts.pastaProjuris,
                area: opts.area,
                motivo: opts.motivo,
                valorPrincipal: opts.valorPrincipal,
                valorJurosCorrecao: 0,
                ordemInterna: opts.ordemInterna,
                semaforo: opts.semaforo ?? 'VERDE',
              },
            ],
          },
        },
      })
    }

    // Comparativo CONDENAÇÃO: ano (jan) = 1000, ano-1 (jan) = 400
    await criar({ status: 'PAGO', dataPagamento: new Date(`${ano}-01-10`), valorTotal: 1000, area: 'CÍVEL', motivo: 'CONDENAÇÃO', valorPrincipal: 1000, pastaProjuris: 'PASTA-1' })
    await criar({ status: 'PAGO', dataPagamento: new Date(`${ano - 1}-01-10`), valorTotal: 400, area: 'CÍVEL', motivo: 'CONDENAÇÃO', valorPrincipal: 400, pastaProjuris: 'PASTA-1' })
    // Fora do período (dezembro) do ano — não deve contar no comparativo até setembro
    await criar({ status: 'PAGO', dataPagamento: new Date(`${ano}-12-20`), valorTotal: 9999, area: 'CÍVEL', motivo: 'CONDENAÇÃO', valorPrincipal: 9999, pastaProjuris: 'PASTA-1' })

    // Honorários (jul/ano = 3º trimestre), pasta com maior valor
    await criar({ status: 'PAGO', dataPagamento: new Date(`${ano}-07-15`), valorTotal: 800, area: 'CÍVEL', motivo: 'HONORÁRIOS', valorPrincipal: 800, pastaProjuris: 'PASTA-2', tipoFluxo: 'RC_HONORARIOS_NF', ordemInterna: 'OI-1' })
    await criar({ status: 'PAGO', dataPagamento: new Date(`${ano}-08-15`), valorTotal: 400, area: 'CÍVEL', motivo: 'HONORÁRIOS', valorPrincipal: 400, pastaProjuris: 'PASTA-2', tipoFluxo: 'RC_HONORARIOS_NF', ordemInterna: 'OI-1' })
    // Fora do 3º trimestre
    await criar({ status: 'PAGO', dataPagamento: new Date(`${ano}-01-15`), valorTotal: 300, area: 'CÍVEL', motivo: 'HONORÁRIOS', valorPrincipal: 300, pastaProjuris: 'PASTA-2', tipoFluxo: 'RC_HONORARIOS_NF', ordemInterna: 'OI-2' })

    // Pendência (amarelo)
    await criar({ status: 'EM_CONFERENCIA', valorTotal: 700, area: 'REDE', motivo: 'ACORDO', valorPrincipal: 700, pastaProjuris: 'PASTA-3', semaforo: 'AMARELO' })
  })

  afterAll(async () => {
    await prisma.solicitacao.deleteMany({ where: { escritorioId } })
    await prisma.usuario.delete({ where: { firebaseUid: uid } })
    await prisma.escritorio.delete({ where: { id: escritorioId } })
  })

  it('totalPago: soma o realizado filtrado por motivo', async () => {
    const r = await agente.totalPago({ motivo: 'CONDENAÇÃO' })
    expect(r.texto).toContain('R$')
    expect(r.visual?.tipo).toBe('tabela')
  })

  it('comparativoAnual: compara dois anos até um mês-limite, com filtro de motivo', async () => {
    const r = await agente.comparativoAnual({ anoA: ano, anoB: ano - 1, mesFim: 9, motivo: 'CONDENAÇÃO' })
    expect(r.visual?.dados).toEqual([
      { ano, total: 1000 }, // não inclui os 9999 de dezembro
      { ano: ano - 1, total: 400 },
    ])
  })

  it('mediaHonorarios: agrupa honorários por área', async () => {
    const r = await agente.mediaHonorarios({ agruparPor: 'area', ano })
    const civel = (r.visual?.dados as { chave: string; total: number }[]).find((d) => d.chave === 'CÍVEL')
    expect(civel?.total).toBe(1500) // 800 + 400 + 300
  })

  it('realizadoAteMes: agrupa por ordem interna só dentro do intervalo de meses', async () => {
    const r = await agente.realizadoAteMes({ ano, mesInicio: 7, mesFim: 9, agruparPor: 'ordemInterna' })
    const dados = r.visual?.dados as { chave: string; total: number }[]
    expect(dados.find((d) => d.chave === 'OI-1')?.total).toBe(1200) // 800 + 400, em jul/ago
    expect(dados.find((d) => d.chave === 'OI-2')).toBeUndefined() // era em janeiro, fora do intervalo
  })

  it('topPastas: ordena pastas pelo total realizado, decrescente', async () => {
    const r = await agente.topPastas({ ano, limite: 2 })
    const dados = r.visual?.dados as { pastaProjuris: string; total: number }[]
    expect(dados[0]).toEqual({ pastaProjuris: 'PASTA-1', total: 10999 }) // 1000 (jan) + 9999 (dez)
  })

  it('pendencias: lista só o que não está PAGO/CANCELADO e tem semáforo amarelo/vermelho', async () => {
    const r = await agente.pendencias()
    const dados = r.visual?.dados as { pastas: string[]; semaforo: string; escritorio: string }[]
    const nossa = dados.find((d) => d.pastas.includes('PASTA-3'))
    expect(nossa?.semaforo).toBe('AMARELO')
  })
})
