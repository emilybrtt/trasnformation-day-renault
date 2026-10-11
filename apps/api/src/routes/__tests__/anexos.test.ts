import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { obterIdTokenDeTeste } from '../../test-helpers/emulatorAuth.js'

const semEmulador = !process.env.FIREBASE_AUTH_EMULATOR_HOST

describe.skipIf(semEmulador)('rotas de anexos/arquivos/notificações (B13)', () => {
  const app = createApp()

  const escritorioAId = 'test-anx-escritorio-a'
  const escritorioBId = 'test-anx-escritorio-b'
  const uidEscritorioA = 'test-anx-uid-escritorio-a'
  const uidEscritorioB = 'test-anx-uid-escritorio-b'
  const uidAnalista = 'test-anx-uid-analista'

  let tokenEscritorioA: string
  let tokenEscritorioB: string
  let tokenAnalista: string
  let solicitacaoId: string

  beforeAll(async () => {
    await prisma.escritorio.createMany({
      data: [
        { id: escritorioAId, nome: 'Escritório Anexos A', cnpj: '33333333000177' },
        { id: escritorioBId, nome: 'Escritório Anexos B', cnpj: '44444444000166' },
      ],
      skipDuplicates: true,
    })
    await prisma.usuario.createMany({
      data: [
        { firebaseUid: uidEscritorioA, nome: 'Escritório A', email: 'a@test-anx.gavve', perfil: 'ESCRITORIO', escritorioId: escritorioAId },
        { firebaseUid: uidEscritorioB, nome: 'Escritório B', email: 'b@test-anx.gavve', perfil: 'ESCRITORIO', escritorioId: escritorioBId },
        { firebaseUid: uidAnalista, nome: 'Analista Teste', email: 'an@test-anx.gavve', perfil: 'ANALISTA' },
      ],
      skipDuplicates: true,
    })
    tokenEscritorioA = await obterIdTokenDeTeste(uidEscritorioA)
    tokenEscritorioB = await obterIdTokenDeTeste(uidEscritorioB)
    tokenAnalista = await obterIdTokenDeTeste(uidAnalista)

    const solicitacao = await prisma.solicitacao.create({
      data: {
        tipoFluxo: 'RBS_DD_GUIA',
        escritorioId: escritorioAId,
        criadoPorId: uidEscritorioA,
        status: 'RASCUNHO',
        formaPagamento: 'BOLETO',
        dataDocumento: new Date('2031-06-15'),
        valorTotal: 1000,
        observacao: '',
        lancamentos: { create: [{ pastaProjuris: '1', area: 'TESTE', motivo: 'TESTE', valorPrincipal: 1000, valorJurosCorrecao: 0 }] },
      },
    })
    solicitacaoId = solicitacao.id
  })

  afterAll(async () => {
    await prisma.historico.deleteMany({ where: { usuarioId: { in: [uidEscritorioA, uidEscritorioB, uidAnalista] } } })
    await prisma.solicitacao.deleteMany({ where: { escritorioId: { in: [escritorioAId, escritorioBId] } } })
    await prisma.usuario.deleteMany({ where: { firebaseUid: { in: [uidEscritorioA, uidEscritorioB, uidAnalista] } } })
    await prisma.escritorio.deleteMany({ where: { id: { in: [escritorioAId, escritorioBId] } } })
  })

  it('400 quando falta o arquivo ou o tipo é inválido', async () => {
    const semArquivo = await request(app)
      .post(`/solicitacoes/${solicitacaoId}/anexos`)
      .set('Authorization', `Bearer ${tokenEscritorioA}`)
      .field('tipo', 'GUIA')
    expect(semArquivo.status).toBe(400)

    const tipoInvalido = await request(app)
      .post(`/solicitacoes/${solicitacaoId}/anexos`)
      .set('Authorization', `Bearer ${tokenEscritorioA}`)
      .field('tipo', 'RATEIO_XLSX')
      .attach('arquivo', Buffer.from('%PDF-1.4 conteúdo de teste'), { filename: 'guia.pdf', contentType: 'application/pdf' })
    expect(tipoInvalido.status).toBe(400)
  })

  it('upload/listagem/download: ESCRITORIO dono acessa, outro escritório recebe 404', async () => {
    const upload = await request(app)
      .post(`/solicitacoes/${solicitacaoId}/anexos`)
      .set('Authorization', `Bearer ${tokenEscritorioA}`)
      .field('tipo', 'GUIA')
      .attach('arquivo', Buffer.from('%PDF-1.4 conteúdo de teste'), { filename: 'guia.pdf', contentType: 'application/pdf' })
    expect(upload.status).toBe(201)
    expect(upload.body.tipo).toBe('GUIA')
    const anexoId = upload.body.id

    const listaComoB = await request(app)
      .get(`/solicitacoes/${solicitacaoId}/anexos`)
      .set('Authorization', `Bearer ${tokenEscritorioB}`)
    expect(listaComoB.status).toBe(404)

    const listaComoA = await request(app)
      .get(`/solicitacoes/${solicitacaoId}/anexos`)
      .set('Authorization', `Bearer ${tokenEscritorioA}`)
    expect(listaComoA.status).toBe(200)
    expect(listaComoA.body).toHaveLength(1)

    const downloadComoB = await request(app).get(`/anexos/${anexoId}/download`).set('Authorization', `Bearer ${tokenEscritorioB}`)
    expect(downloadComoB.status).toBe(404)

    const downloadComoA = await request(app)
      .get(`/anexos/${anexoId}/download`)
      .set('Authorization', `Bearer ${tokenEscritorioA}`)
      .redirects(0)
    expect(downloadComoA.status).toBe(302)
    expect(downloadComoA.headers.location).toMatch(/^\/arquivos\/anexos\//)

    const arquivo = await request(app).get(downloadComoA.headers.location).set('Authorization', `Bearer ${tokenEscritorioA}`)
    expect(arquivo.status).toBe(200)
    expect(arquivo.headers['content-type']).toContain('application/pdf')
    expect(Buffer.from(arquivo.body as Buffer).toString('utf-8')).toContain('conteúdo de teste')
  })

  it('/arquivos/<chave inexistente> devolve 404', async () => {
    const res = await request(app).get('/arquivos/anexos/nao-existe.pdf').set('Authorization', `Bearer ${tokenEscritorioA}`)
    expect(res.status).toBe(404)
  })

  it('registrar pagamento com comprovante: cria Anexo COMPROVANTE e notifica o escritório', async () => {
    await prisma.solicitacao.update({ where: { id: solicitacaoId }, data: { status: 'CHAMADO_ABERTO' } })

    const pagamento = await request(app)
      .post(`/solicitacoes/${solicitacaoId}/pagamento`)
      .set('Authorization', `Bearer ${tokenAnalista}`)
      .field('dataPagamento', '2031-07-01')
      .attach('comprovante', Buffer.from('%PDF-1.4 comprovante'), { filename: 'comprovante.pdf', contentType: 'application/pdf' })
    expect(pagamento.status).toBe(200)
    expect(pagamento.body.status).toBe('PAGO')

    const anexos = await prisma.anexo.findMany({ where: { solicitacaoId, tipo: 'COMPROVANTE' } })
    expect(anexos).toHaveLength(1)

    const notificacoesComoA = await request(app).get('/notificacoes').set('Authorization', `Bearer ${tokenEscritorioA}`)
    expect(notificacoesComoA.status).toBe(200)
    expect(notificacoesComoA.body.some((n: { solicitacaoId: string }) => n.solicitacaoId === solicitacaoId)).toBe(true)

    const notificacoesComoB = await request(app).get('/notificacoes').set('Authorization', `Bearer ${tokenEscritorioB}`)
    expect(notificacoesComoB.body.some((n: { solicitacaoId: string }) => n.solicitacaoId === solicitacaoId)).toBe(false)

    const notificacoesComoAnalista = await request(app).get('/notificacoes').set('Authorization', `Bearer ${tokenAnalista}`)
    expect(notificacoesComoAnalista.body.some((n: { solicitacaoId: string }) => n.solicitacaoId === solicitacaoId)).toBe(true)
  })

  it('registrar pagamento sem comprovante não cria notificação (continua funcionando, B9)', async () => {
    const outra = await prisma.solicitacao.create({
      data: {
        tipoFluxo: 'RBS_DD_GUIA',
        escritorioId: escritorioAId,
        criadoPorId: uidEscritorioA,
        status: 'CHAMADO_ABERTO',
        formaPagamento: 'BOLETO',
        dataDocumento: new Date('2031-06-15'),
        valorTotal: 1000,
        observacao: '',
        lancamentos: { create: [{ pastaProjuris: '2', area: 'TESTE', motivo: 'TESTE', valorPrincipal: 1000, valorJurosCorrecao: 0 }] },
      },
    })

    const pagamento = await request(app)
      .post(`/solicitacoes/${outra.id}/pagamento`)
      .set('Authorization', `Bearer ${tokenAnalista}`)
      .send({ dataPagamento: '2031-07-02' })
    expect(pagamento.status).toBe(200)

    const notificacoes = await prisma.notificacao.findMany({ where: { solicitacaoId: outra.id } })
    expect(notificacoes).toHaveLength(0)
  })
})
