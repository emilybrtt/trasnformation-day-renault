import ExcelJS from 'exceljs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import * as dashboards from '../dashboards.js'

describe('dashboards (B12)', () => {
  const escritorioId = 'test-dash-escritorio'
  const uid = 'test-dash-usuario'
  const ano = 2035 // ano exclusivo dos testes

  beforeAll(async () => {
    await prisma.escritorio.upsert({
      where: { id: escritorioId },
      create: { id: escritorioId, nome: 'Escritório Dashboard', cnpj: '10101010000100' },
      update: {},
    })
    await prisma.usuario.upsert({
      where: { firebaseUid: uid },
      create: { firebaseUid: uid, nome: 'Usuário Dashboard', email: 'dash@test-dash.gavve', perfil: 'ESCRITORIO', escritorioId },
      update: {},
    })

    async function criar(opts: {
      tipoFluxo: 'RBS_DD_GUIA' | 'RC_HONORARIOS_NF' | 'ANEXO_V_BAIXA'
      status: 'RASCUNHO' | 'EM_CONFERENCIA' | 'PAGO' | 'CANCELADO'
      dataPagamento?: Date
      valorTotal: number
      area: string
      motivo: string
      valorPrincipal: number
      ordemInterna?: string
    }) {
      await prisma.solicitacao.create({
        data: {
          tipoFluxo: opts.tipoFluxo,
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
                pastaProjuris: '1',
                area: opts.area,
                motivo: opts.motivo,
                valorPrincipal: opts.valorPrincipal,
                valorJurosCorrecao: 0,
                ordemInterna: opts.ordemInterna,
              },
            ],
          },
        },
      })
    }

    // PAGO: jan/ano, CÍVEL/CONDENAÇÃO, 1000
    await criar({ tipoFluxo: 'RBS_DD_GUIA', status: 'PAGO', dataPagamento: new Date(`${ano}-01-15`), valorTotal: 1000, area: 'CÍVEL', motivo: 'CONDENAÇÃO', valorPrincipal: 1000, ordemInterna: 'OI-1' })
    // PAGO: mar/ano, REDE/CONDENAÇÃO, 500
    await criar({ tipoFluxo: 'RBS_DD_GUIA', status: 'PAGO', dataPagamento: new Date(`${ano}-03-10`), valorTotal: 500, area: 'REDE', motivo: 'CONDENAÇÃO', valorPrincipal: 500, ordemInterna: 'OI-2' })
    // PAGO: jan/ano, honorários, 200
    await criar({ tipoFluxo: 'RC_HONORARIOS_NF', status: 'PAGO', dataPagamento: new Date(`${ano}-01-20`), valorTotal: 200, area: 'CÍVEL', motivo: 'HONORÁRIOS', valorPrincipal: 200 })
    // PAGO: jan/ano, honorários, 400 (média esperada CÍVEL = (200+400)/2=300)
    await criar({ tipoFluxo: 'RC_HONORARIOS_NF', status: 'PAGO', dataPagamento: new Date(`${ano}-01-25`), valorTotal: 400, area: 'CÍVEL', motivo: 'HONORÁRIOS', valorPrincipal: 400 })
    // não realizado: não deve contar em nenhum dashboard "realizado"
    await criar({ tipoFluxo: 'RBS_DD_GUIA', status: 'EM_CONFERENCIA', valorTotal: 99999, area: 'CÍVEL', motivo: 'CONDENAÇÃO', valorPrincipal: 99999 })
    await criar({ tipoFluxo: 'RBS_DD_GUIA', status: 'CANCELADO', valorTotal: 99999, area: 'CÍVEL', motivo: 'CONDENAÇÃO', valorPrincipal: 99999 })
    await criar({ tipoFluxo: 'ANEXO_V_BAIXA', status: 'RASCUNHO', valorTotal: 99999, area: 'CÍVEL', motivo: 'ACORDO', valorPrincipal: 99999 })
  })

  afterAll(async () => {
    await prisma.solicitacao.deleteMany({ where: { escritorioId } })
    await prisma.usuario.delete({ where: { firebaseUid: uid } })
    await prisma.escritorio.delete({ where: { id: escritorioId } })
  })

  it('kpis: soma só o realizado (PAGO)', async () => {
    const r = await dashboards.kpis({ escritorioId })
    expect(r.totalPago).toBe(2100) // 1000+500+200+400
    expect(r.quantidadeSolicitacoesPagas).toBe(4)
    expect(r.valorMedioPorSolicitacao).toBe(525)
    expect(r.emConferencia).toBeGreaterThanOrEqual(1)
  })

  it('realizadoMensal: agrupa por mês, ignora o que não é PAGO', async () => {
    const r = await dashboards.realizadoMensal(ano, { escritorioId })
    const jan = r.find((m) => m.mes === 1)!
    const mar = r.find((m) => m.mes === 3)!
    expect(jan.total).toBe(1600) // 1000 + 200 + 400
    expect(mar.total).toBe(500)
    expect(r.filter((m) => m.mes !== 1 && m.mes !== 3).every((m) => m.total === 0)).toBe(true)
  })

  it('porArea e porMotivo: agrupam só o realizado', async () => {
    const porArea = await dashboards.porArea({ escritorioId })
    const civel = porArea.find((a) => a.chave === 'CÍVEL')!
    const rede = porArea.find((a) => a.chave === 'REDE')!
    expect(civel.total).toBe(1600) // 1000 (condenação) + 200 + 400 (honorários)
    expect(rede.total).toBe(500)

    const porMotivo = await dashboards.porMotivo({ escritorioId })
    expect(porMotivo.find((m) => m.chave === 'CONDENAÇÃO')?.total).toBe(1500)
    expect(porMotivo.find((m) => m.chave === 'HONORÁRIOS')?.total).toBe(600)
  })

  it('porOrdemInterna: agrupa pela ordem interna do lançamento', async () => {
    const r = await dashboards.porOrdemInterna({ escritorioId })
    expect(r.find((o) => o.chave === 'OI-1')?.total).toBe(1000)
    expect(r.find((o) => o.chave === 'OI-2')?.total).toBe(500)
  })

  it('mediaHonorarios: só RC_HONORARIOS_NF, agrupado por área ou por ano', async () => {
    const porArea = await dashboards.mediaHonorarios('area', { escritorioId })
    const civel = porArea.find((a) => a.chave === 'CÍVEL')!
    expect(civel.total).toBe(600)
    expect(civel.media).toBe(300)
    expect(civel.quantidade).toBe(2)

    const porAno = await dashboards.mediaHonorarios('ano', { escritorioId })
    expect(porAno.find((a) => a.chave === String(ano))?.total).toBe(600)
  })

  it('funil: conta por status, incluindo os que não são PAGO', async () => {
    const r = await dashboards.funil({ escritorioId })
    expect(r.find((f) => f.status === 'PAGO')?.quantidade).toBe(4)
    expect(r.find((f) => f.status === 'CANCELADO')?.quantidade).toBe(1)
    expect(r.find((f) => f.status === 'RASCUNHO')?.quantidade).toBe(1)
    expect(r.find((f) => f.status === 'EM_CONFERENCIA')?.quantidade).toBeGreaterThanOrEqual(1)
  })

  it('filtro por área/motivo restringe os resultados', async () => {
    const r = await dashboards.realizadoMensal(ano, { escritorioId, area: 'REDE' })
    expect(r.find((m) => m.mes === 3)?.total).toBe(500)
    expect(r.find((m) => m.mes === 1)?.total).toBe(0)
  })

  it('exportarRealizadoXlsx: gera um .xlsx válido com o total do ano', async () => {
    const buffer = await dashboards.exportarRealizadoXlsx(ano, { escritorioId })
    const workbook = new ExcelJS.Workbook()
    // @ts-expect-error exceljs tipa o parâmetro como Buffer sem o genérico que esta
    // versão do TypeScript exige — mesmo tipo em runtime, só uma divergência de typing.
    await workbook.xlsx.load(buffer)
    const planilha = workbook.worksheets[0]
    expect(planilha.rowCount).toBe(14) // cabeçalho + 12 meses + total
    const ultimaLinha = planilha.getRow(14).values as unknown[]
    expect(ultimaLinha[1]).toBe('Total do ano')
    expect(ultimaLinha[2]).toBe(2100)
  })
})
