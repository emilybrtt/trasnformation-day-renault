import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { obterIdTokenDeTeste } from '../../test-helpers/emulatorAuth.js'

const semEmulador = !process.env.FIREBASE_AUTH_EMULATOR_HOST

describe.skipIf(semEmulador)('rotas de /solicitacoes', () => {
  const app = createApp()
  const ano = 2031 // ano exclusivo dos testes, não colide com o de-para real (2025/2026)

  const escritorioAId = 'test-sol-escritorio-a'
  const escritorioBId = 'test-sol-escritorio-b'
  const uidEscritorioA = 'test-sol-uid-escritorio-a'
  const uidEscritorioB = 'test-sol-uid-escritorio-b'
  const uidAnalista = 'test-sol-uid-analista'

  let tokenEscritorioA: string
  let tokenEscritorioB: string
  let tokenAnalista: string

  beforeAll(async () => {
    await prisma.escritorio.createMany({
      data: [
        { id: escritorioAId, nome: 'Escritório Teste A', cnpj: '11111111000191' },
        { id: escritorioBId, nome: 'Escritório Teste B', cnpj: '22222222000199' },
      ],
      skipDuplicates: true,
    })
    await prisma.usuario.createMany({
      data: [
        { firebaseUid: uidEscritorioA, nome: 'Escritório A', email: 'a@test-sol.gavve', perfil: 'ESCRITORIO', escritorioId: escritorioAId },
        { firebaseUid: uidEscritorioB, nome: 'Escritório B', email: 'b@test-sol.gavve', perfil: 'ESCRITORIO', escritorioId: escritorioBId },
        { firebaseUid: uidAnalista, nome: 'Analista Teste', email: 'an@test-sol.gavve', perfil: 'ANALISTA' },
      ],
      skipDuplicates: true,
    })
    await prisma.deParaContabil.upsert({
      where: { area_motivo_ano: { area: 'TESTE', motivo: 'TESTE', ano } },
      create: { area: 'TESTE', motivo: 'TESTE', centroCusto: 'CC-TESTE', contaContabil: 'CT-TESTE', ordemInterna: 'OI-TESTE', ano, ativo: true },
      update: {},
    })

    tokenEscritorioA = await obterIdTokenDeTeste(uidEscritorioA)
    tokenEscritorioB = await obterIdTokenDeTeste(uidEscritorioB)
    tokenAnalista = await obterIdTokenDeTeste(uidAnalista)
  })

  afterAll(async () => {
    await prisma.solicitacao.deleteMany({ where: { escritorioId: { in: [escritorioAId, escritorioBId] } } })
    await prisma.historico.deleteMany({ where: { usuarioId: { in: [uidEscritorioA, uidEscritorioB, uidAnalista] } } })
    await prisma.usuario.deleteMany({ where: { firebaseUid: { in: [uidEscritorioA, uidEscritorioB, uidAnalista] } } })
    await prisma.escritorio.deleteMany({ where: { id: { in: [escritorioAId, escritorioBId] } } })
    await prisma.deParaContabil.deleteMany({ where: { area: 'TESTE' } })
  })

  function payload(overrides: Record<string, unknown> = {}) {
    return {
      tipoFluxo: 'RBS_DD_GUIA',
      formaPagamento: 'BOLETO',
      dataDocumento: `${ano}-06-15`,
      linhas: [{ pastaProjuris: '99999', area: 'TESTE', motivo: 'TESTE', valorPrincipal: 1000, valorJurosCorrecao: 100 }],
      ...overrides,
    }
  }

  it('ESCRITORIO cria uma solicitação com de-para resolvido pelo servidor', async () => {
    const res = await request(app)
      .post('/solicitacoes')
      .set('Authorization', `Bearer ${tokenEscritorioA}`)
      .send(payload())
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('RASCUNHO')
    expect(res.body.escritorioId).toBe(escritorioAId)
    expect(Number(res.body.valorTotal)).toBe(1100)
    expect(res.body.lancamentos[0].centroCusto).toBe('CC-TESTE')
    expect(res.body.lancamentos[0].semaforo).toBe('VERDE')
  })

  it('ignora escritorioId do body e usa o do usuário autenticado', async () => {
    const res = await request(app)
      .post('/solicitacoes')
      .set('Authorization', `Bearer ${tokenEscritorioA}`)
      .send(payload({ escritorioId: escritorioBId }))
    expect(res.status).toBe(201)
    expect(res.body.escritorioId).toBe(escritorioAId)
  })

  it('400 quando falta linha ou campo obrigatório', async () => {
    const res = await request(app)
      .post('/solicitacoes')
      .set('Authorization', `Bearer ${tokenEscritorioA}`)
      .send(payload({ linhas: [] }))
    expect(res.status).toBe(400)
  })

  it('lançamento sem de-para cadastrado fica VERMELHO, sem bloquear a criação', async () => {
    const res = await request(app)
      .post('/solicitacoes')
      .set('Authorization', `Bearer ${tokenEscritorioA}`)
      .send(payload({ linhas: [{ pastaProjuris: '1', area: 'SEM-DE-PARA', motivo: 'SEM-DE-PARA', valorPrincipal: 10 }] }))
    expect(res.status).toBe(201)
    expect(res.body.lancamentos[0].centroCusto).toBeNull()
    expect(res.body.lancamentos[0].semaforo).toBe('VERMELHO')
  })

  it('escopo por escritório: B não vê nem edita o recurso de A (404)', async () => {
    const criado = await request(app).post('/solicitacoes').set('Authorization', `Bearer ${tokenEscritorioA}`).send(payload())
    const id = criado.body.id

    const getComoB = await request(app).get(`/solicitacoes/${id}`).set('Authorization', `Bearer ${tokenEscritorioB}`)
    expect(getComoB.status).toBe(404)

    const patchComoB = await request(app)
      .patch(`/solicitacoes/${id}`)
      .set('Authorization', `Bearer ${tokenEscritorioB}`)
      .send({ observacao: 'tentativa' })
    expect(patchComoB.status).toBe(404)

    const getComoA = await request(app).get(`/solicitacoes/${id}`).set('Authorization', `Bearer ${tokenEscritorioA}`)
    expect(getComoA.status).toBe(200)

    const getComoAnalista = await request(app).get(`/solicitacoes/${id}`).set('Authorization', `Bearer ${tokenAnalista}`)
    expect(getComoAnalista.status).toBe(200)
  })

  it('GET /solicitacoes: ESCRITORIO só lista as próprias; ANALISTA lista todas', async () => {
    await request(app).post('/solicitacoes').set('Authorization', `Bearer ${tokenEscritorioA}`).send(payload())
    await request(app).post('/solicitacoes').set('Authorization', `Bearer ${tokenEscritorioB}`).send(payload())

    const comoA = await request(app).get('/solicitacoes').set('Authorization', `Bearer ${tokenEscritorioA}`)
    expect(comoA.body.items.every((s: { escritorioId: string }) => s.escritorioId === escritorioAId)).toBe(true)

    const comoAnalista = await request(app).get('/solicitacoes').set('Authorization', `Bearer ${tokenAnalista}`)
    const escritoriosNaLista = new Set(comoAnalista.body.items.map((s: { escritorioId: string }) => s.escritorioId))
    expect(escritoriosNaLista.has(escritorioAId)).toBe(true)
    expect(escritoriosNaLista.has(escritorioBId)).toBe(true)
  })

  it('fluxo completo: enviar → aprovar → devolver bloqueado → chamado → pagamento', async () => {
    const criado = await request(app).post('/solicitacoes').set('Authorization', `Bearer ${tokenEscritorioA}`).send(payload())
    const id = criado.body.id
    // RBS_DD_GUIA exige o anexo da guia (CAMPO_OBRIGATORIO) — sem ele, o B7 bloqueia a aprovação.
    await prisma.anexo.create({ data: { solicitacaoId: id, tipo: 'GUIA', caminho: 'teste.pdf', nomeArquivo: 'teste.pdf' } })

    const enviado = await request(app).post(`/solicitacoes/${id}/enviar`).set('Authorization', `Bearer ${tokenEscritorioA}`)
    expect(enviado.status).toBe(200)
    expect(enviado.body.status).toBe('EM_CONFERENCIA')

    const enviarDeNovo = await request(app).post(`/solicitacoes/${id}/enviar`).set('Authorization', `Bearer ${tokenEscritorioA}`)
    expect(enviarDeNovo.status).toBe(409)

    const aprovarComoEscritorio = await request(app).post(`/solicitacoes/${id}/aprovar`).set('Authorization', `Bearer ${tokenEscritorioA}`)
    expect(aprovarComoEscritorio.status).toBe(403)

    const aprovado = await request(app).post(`/solicitacoes/${id}/aprovar`).set('Authorization', `Bearer ${tokenAnalista}`)
    expect(aprovado.status).toBe(200)
    expect(aprovado.body.status).toBe('APROVADO')

    const devolverDepoisDeAprovado = await request(app)
      .post(`/solicitacoes/${id}/devolver`)
      .set('Authorization', `Bearer ${tokenAnalista}`)
      .send({ comentario: 'tarde demais' })
    expect(devolverDepoisDeAprovado.status).toBe(409)

    const chamado = await request(app)
      .post(`/solicitacoes/${id}/chamado`)
      .set('Authorization', `Bearer ${tokenAnalista}`)
      .send({ numeroChamado: 'BR-000001' })
    expect(chamado.status).toBe(200)
    expect(chamado.body.status).toBe('CHAMADO_ABERTO')

    const pagamento = await request(app)
      .post(`/solicitacoes/${id}/pagamento`)
      .set('Authorization', `Bearer ${tokenAnalista}`)
      .send({ dataPagamento: `${ano}-07-01` })
    expect(pagamento.status).toBe(200)
    expect(pagamento.body.status).toBe('PAGO')
    expect(pagamento.body.dataPagamento).not.toBeNull()
  })

  it('aprovar bloqueia (422) quando há lançamento VERMELHO; devolver exige comentário', async () => {
    const criado = await request(app)
      .post('/solicitacoes')
      .set('Authorization', `Bearer ${tokenEscritorioA}`)
      .send(payload({ linhas: [{ pastaProjuris: '2', area: 'SEM-DE-PARA', motivo: 'SEM-DE-PARA', valorPrincipal: 10 }] }))
    const id = criado.body.id
    await request(app).post(`/solicitacoes/${id}/enviar`).set('Authorization', `Bearer ${tokenEscritorioA}`)

    const aprovar = await request(app).post(`/solicitacoes/${id}/aprovar`).set('Authorization', `Bearer ${tokenAnalista}`)
    expect(aprovar.status).toBe(422)

    const devolverSemComentario = await request(app)
      .post(`/solicitacoes/${id}/devolver`)
      .set('Authorization', `Bearer ${tokenAnalista}`)
      .send({})
    expect(devolverSemComentario.status).toBe(400)

    const devolver = await request(app)
      .post(`/solicitacoes/${id}/devolver`)
      .set('Authorization', `Bearer ${tokenAnalista}`)
      .send({ comentario: 'Falta de-para, favor corrigir a área/motivo' })
    expect(devolver.status).toBe(200)
    expect(devolver.body.status).toBe('DEVOLVIDO')

    const detalhe = await request(app).get(`/solicitacoes/${id}`).set('Authorization', `Bearer ${tokenAnalista}`)
    expect(detalhe.body.comentarios).toHaveLength(1)
  })

  it('resolver alerta exige justificativa e recalcula o semáforo do lançamento', async () => {
    const criado = await request(app).post('/solicitacoes').set('Authorization', `Bearer ${tokenEscritorioA}`).send(payload())
    const lancamentoId = criado.body.lancamentos[0].id

    const alerta = await prisma.alerta.create({
      data: {
        solicitacaoId: criado.body.id,
        lancamentoId,
        codigo: 'TESTE',
        severidade: 'VERMELHO',
        mensagem: 'alerta de teste',
      },
    })
    await prisma.lancamento.update({ where: { id: lancamentoId }, data: { semaforo: 'VERMELHO' } })

    const semJustificativa = await request(app)
      .post(`/alertas/${alerta.id}/resolver`)
      .set('Authorization', `Bearer ${tokenAnalista}`)
      .send({})
    expect(semJustificativa.status).toBe(400)

    const resolvido = await request(app)
      .post(`/alertas/${alerta.id}/resolver`)
      .set('Authorization', `Bearer ${tokenAnalista}`)
      .send({ justificativa: 'confirmado com o escritório' })
    expect(resolvido.status).toBe(200)
    expect(resolvido.body.resolvidoEm).not.toBeNull()

    const lancamento = await prisma.lancamento.findUnique({ where: { id: lancamentoId } })
    expect(lancamento?.semaforo).toBe('VERDE')
  })
})
