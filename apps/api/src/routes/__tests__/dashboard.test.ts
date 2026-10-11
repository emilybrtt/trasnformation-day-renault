import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { obterIdTokenDeTeste } from '../../test-helpers/emulatorAuth.js'

const semEmulador = !process.env.FIREBASE_AUTH_EMULATOR_HOST

describe.skipIf(semEmulador)('rotas de /dashboard (B12)', () => {
  const app = createApp()
  const uidEscritorio = 'test-rota-dash-escritorio-uid'
  const uidAnalista = 'test-rota-dash-analista-uid'
  const uidGestor = 'test-rota-dash-gestor-uid'

  let tokenEscritorio: string
  let tokenAnalista: string
  let tokenGestor: string

  beforeAll(async () => {
    await prisma.usuario.createMany({
      data: [
        { firebaseUid: uidEscritorio, nome: 'E', email: 'e@test-rota-dash.gavve', perfil: 'ESCRITORIO' },
        { firebaseUid: uidAnalista, nome: 'A', email: 'a@test-rota-dash.gavve', perfil: 'ANALISTA' },
        { firebaseUid: uidGestor, nome: 'G', email: 'g@test-rota-dash.gavve', perfil: 'GESTOR' },
      ],
      skipDuplicates: true,
    })
    tokenEscritorio = await obterIdTokenDeTeste(uidEscritorio)
    tokenAnalista = await obterIdTokenDeTeste(uidAnalista)
    tokenGestor = await obterIdTokenDeTeste(uidGestor)
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { firebaseUid: { in: [uidEscritorio, uidAnalista, uidGestor] } } })
  })

  it('403 para ESCRITORIO; 200 para ANALISTA e GESTOR', async () => {
    const negado = await request(app).get('/dashboard/kpis').set('Authorization', `Bearer ${tokenEscritorio}`)
    expect(negado.status).toBe(403)

    const comoAnalista = await request(app).get('/dashboard/kpis').set('Authorization', `Bearer ${tokenAnalista}`)
    expect(comoAnalista.status).toBe(200)

    const comoGestor = await request(app).get('/dashboard/kpis').set('Authorization', `Bearer ${tokenGestor}`)
    expect(comoGestor.status).toBe(200)
  })

  it('GET /dashboard/export.xlsx devolve um arquivo .xlsx', async () => {
    const res = await request(app)
      .get('/dashboard/export.xlsx?ano=2026')
      .set('Authorization', `Bearer ${tokenGestor}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('spreadsheetml')
  })

  it('GET /dashboard/funil e /dashboard/honorarios-anual respondem 200', async () => {
    const funil = await request(app).get('/dashboard/funil').set('Authorization', `Bearer ${tokenAnalista}`)
    expect(funil.status).toBe(200)
    expect(Array.isArray(funil.body)).toBe(true)

    const honorarios = await request(app).get('/dashboard/honorarios-anual').set('Authorization', `Bearer ${tokenAnalista}`)
    expect(honorarios.status).toBe(200)
  })
})
