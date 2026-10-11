import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { obterIdTokenDeTeste } from '../../test-helpers/emulatorAuth.js'

const semEmulador = !process.env.FIREBASE_AUTH_EMULATOR_HOST

describe.skipIf(semEmulador)('GET /me', () => {
  const uid = 'test-me-gestor'

  beforeAll(async () => {
    await prisma.usuario.upsert({
      where: { firebaseUid: uid },
      create: { firebaseUid: uid, nome: 'Gestor de Teste', email: 'gestor@test-me.gavve', perfil: 'GESTOR' },
      update: {},
    })
  })

  afterAll(async () => {
    await prisma.usuario.delete({ where: { firebaseUid: uid } })
  })

  it('devolve os dados do usuário autenticado', async () => {
    const idToken = await obterIdTokenDeTeste(uid)
    const res = await request(createApp()).get('/me').set('Authorization', `Bearer ${idToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      firebaseUid: uid,
      nome: 'Gestor de Teste',
      email: 'gestor@test-me.gavve',
      perfil: 'GESTOR',
      escritorioId: null,
    })
  })

  it('401 sem token', async () => {
    const res = await request(createApp()).get('/me')
    expect(res.status).toBe(401)
  })
})
