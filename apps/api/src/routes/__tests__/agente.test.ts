import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { obterIdTokenDeTeste } from '../../test-helpers/emulatorAuth.js'

const semEmulador = !process.env.FIREBASE_AUTH_EMULATOR_HOST

describe.skipIf(semEmulador)('rotas de /agente (B11)', () => {
  const app = createApp()
  const uidEscritorio = 'test-rota-agente-escritorio-uid'
  const uidAnalista = 'test-rota-agente-analista-uid'

  let tokenEscritorio: string
  let tokenAnalista: string

  beforeAll(async () => {
    await prisma.usuario.createMany({
      data: [
        { firebaseUid: uidEscritorio, nome: 'E', email: 'e@test-rota-agente.gavve', perfil: 'ESCRITORIO' },
        { firebaseUid: uidAnalista, nome: 'A', email: 'a@test-rota-agente.gavve', perfil: 'ANALISTA' },
      ],
      skipDuplicates: true,
    })
    tokenEscritorio = await obterIdTokenDeTeste(uidEscritorio)
    tokenAnalista = await obterIdTokenDeTeste(uidAnalista)
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { firebaseUid: { in: [uidEscritorio, uidAnalista] } } })
  })

  it('403 para ESCRITORIO; 200 para ANALISTA', async () => {
    const negado = await request(app)
      .post('/agente/mensagem')
      .set('Authorization', `Bearer ${tokenEscritorio}`)
      .send({ mensagem: 'oi' })
    expect(negado.status).toBe(403)

    const ok = await request(app)
      .post('/agente/mensagem')
      .set('Authorization', `Bearer ${tokenAnalista}`)
      .send({ mensagem: 'Quais solicitações estão em amarelo ou vermelho agora?' })
    expect(ok.status).toBe(200)
    expect(ok.body).toHaveProperty('texto')
  })

  it('400 quando a mensagem está ausente', async () => {
    const res = await request(app).post('/agente/mensagem').set('Authorization', `Bearer ${tokenAnalista}`).send({})
    expect(res.status).toBe(400)
  })

  it('respostas às 4 perguntas que o card B11 exige que funcionem', async () => {
    const perguntas = [
      'Quanto pagamos de condenações em 2026 até setembro, comparado com 2025?',
      'Qual a média de honorários por área este ano?',
      'Quais solicitações estão em amarelo ou vermelho agora?',
      'Gere o realizado por ordem interna do 3º trimestre',
    ]

    for (const mensagem of perguntas) {
      const res = await request(app).post('/agente/mensagem').set('Authorization', `Bearer ${tokenAnalista}`).send({ mensagem })
      expect(res.status).toBe(200)
      expect(typeof res.body.texto).toBe('string')
      expect(res.body.texto.length).toBeGreaterThan(0)
    }
  })

  it('devolve um texto de "não entendi" quando nenhuma ferramenta se aplica', async () => {
    const res = await request(app)
      .post('/agente/mensagem')
      .set('Authorization', `Bearer ${tokenAnalista}`)
      .send({ mensagem: 'Qual é a capital da França?' })
    expect(res.status).toBe(200)
    expect(res.body.texto).toContain('Não entendi')
    expect(res.body.visual).toBeUndefined()
  })

  it('aceita histórico mais longo que 6 mensagens sem quebrar (o servidor só considera as últimas 6)', async () => {
    const historico = Array.from({ length: 10 }, (_, i) => ({
      papel: i % 2 === 0 ? 'usuario' : 'assistente',
      texto: `mensagem ${i}`,
    }))
    const res = await request(app)
      .post('/agente/mensagem')
      .set('Authorization', `Bearer ${tokenAnalista}`)
      .send({ mensagem: 'Quais solicitações estão em amarelo ou vermelho agora?', historico })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('texto')
  })
})
