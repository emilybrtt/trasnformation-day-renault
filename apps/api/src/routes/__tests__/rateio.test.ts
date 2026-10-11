import ExcelJS from 'exceljs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { getStorage } from '../../lib/storage/index.js'
import { CABECALHO_RATEIO } from '../../services/rateio.js'
import { obterIdTokenDeTeste } from '../../test-helpers/emulatorAuth.js'

const semEmulador = !process.env.FIREBASE_AUTH_EMULATOR_HOST

describe.skipIf(semEmulador)('GET /solicitacoes/:id/rateio.xlsx', () => {
  const app = createApp()
  const escritorioId = 'test-rota-rat-escritorio'
  const uidEscritorio = 'test-rota-rat-escritorio-uid'
  const uidAnalista = 'test-rota-rat-analista-uid'
  const fornecedorId = 'test-rota-rat-fornecedor'
  const ano = 2034

  let tokenEscritorio: string
  let tokenAnalista: string
  let solicitacaoId: string

  beforeAll(async () => {
    await prisma.escritorio.upsert({
      where: { id: escritorioId },
      create: { id: escritorioId, nome: 'Escritório Rota Rateio', cnpj: '66666666000172' },
      update: {},
    })
    await prisma.usuario.createMany({
      data: [
        { firebaseUid: uidEscritorio, nome: 'E', email: 'e@test-rota-rat.gavve', perfil: 'ESCRITORIO', escritorioId },
        { firebaseUid: uidAnalista, nome: 'A', email: 'a@test-rota-rat.gavve', perfil: 'ANALISTA' },
      ],
      skipDuplicates: true,
    })
    await prisma.fornecedor.upsert({
      where: { id: fornecedorId },
      create: { id: fornecedorId, codigoSap: '90088', nome: 'Fornecedor Rota Rateio', cnpj: '77777777000163' },
      update: {},
    })
    await prisma.deParaContabil.upsert({
      where: { area_motivo_ano: { area: 'VAL', motivo: 'VAL', ano } },
      create: { area: 'VAL', motivo: 'VAL', centroCusto: 'CC', contaContabil: 'CT', ordemInterna: 'OI', ano, ativo: true },
      update: {},
    })

    const sol = await prisma.solicitacao.create({
      data: {
        tipoFluxo: 'RBS_DD_GUIA',
        escritorioId,
        criadoPorId: uidEscritorio,
        fornecedorId,
        status: 'APROVADO',
        formaPagamento: 'BOLETO',
        dataDocumento: new Date(`${ano}-02-10`),
        valorTotal: 100,
        observacao: '',
        lancamentos: { create: [{ pastaProjuris: '1', area: 'VAL', motivo: 'VAL', valorPrincipal: 100, valorJurosCorrecao: 0, centroCusto: 'CC', contaContabil: 'CT', ordemInterna: 'OI' }] },
      },
    })
    solicitacaoId = sol.id

    tokenEscritorio = await obterIdTokenDeTeste(uidEscritorio)
    tokenAnalista = await obterIdTokenDeTeste(uidAnalista)
  })

  afterAll(async () => {
    await prisma.solicitacao.deleteMany({ where: { escritorioId } })
    await prisma.usuario.deleteMany({ where: { firebaseUid: { in: [uidEscritorio, uidAnalista] } } })
    await prisma.escritorio.delete({ where: { id: escritorioId } })
    await prisma.fornecedor.delete({ where: { id: fornecedorId } })
    await prisma.deParaContabil.deleteMany({ where: { area: 'VAL', motivo: 'VAL', ano } })
  })

  it('403 para ESCRITORIO', async () => {
    const res = await request(app)
      .get(`/solicitacoes/${solicitacaoId}/rateio.xlsx`)
      .set('Authorization', `Bearer ${tokenEscritorio}`)
    expect(res.status).toBe(403)
  })

  it('ANALISTA baixa o .xlsx com o cabeçalho correto e salva o anexo RATEIO_XLSX', async () => {
    const res = await request(app)
      .get(`/solicitacoes/${solicitacaoId}/rateio.xlsx`)
      .set('Authorization', `Bearer ${tokenAnalista}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('spreadsheetml')

    const anexo = await prisma.anexo.findFirst({ where: { solicitacaoId, tipo: 'RATEIO_XLSX' } })
    expect(anexo).not.toBeNull()
    expect(anexo?.nomeArquivo).toBe('rateio.xlsx')

    const conteudo = await getStorage().ler(anexo!.caminho)
    const workbook = new ExcelJS.Workbook()
    // @ts-expect-error exceljs tipa o parâmetro como Buffer sem o genérico que esta
    // versão do TypeScript exige — mesmo tipo em runtime, só uma divergência de typing.
    await workbook.xlsx.load(conteudo)
    const planilha = workbook.getWorksheet('Planilha1')!
    const cabecalho: unknown[] = []
    planilha.getRow(1).eachCell({ includeEmpty: true }, (cell) => cabecalho.push(cell.value))
    expect(cabecalho).toEqual([...CABECALHO_RATEIO])
    expect(planilha.rowCount).toBe(3) // cabeçalho + 1 débito + 1 crédito
  })
})
