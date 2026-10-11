import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { obterIdTokenDeTeste } from '../../test-helpers/emulatorAuth.js'
import { auth, exige } from '../auth.js'

const semEmulador = !process.env.FIREBASE_AUTH_EMULATOR_HOST

describe.skipIf(semEmulador)('auth + exige', () => {
  const uidEscritorio = 'test-auth-escritorio'
  const uidAnalista = 'test-auth-analista'

  beforeAll(async () => {
    await prisma.usuario.createMany({
      data: [
        {
          firebaseUid: uidEscritorio,
          nome: 'Escritório de Teste',
          email: 'escritorio@test-auth.gavve',
          perfil: 'ESCRITORIO',
          escritorioId: null,
        },
        {
          firebaseUid: uidAnalista,
          nome: 'Analista de Teste',
          email: 'analista@test-auth.gavve',
          perfil: 'ANALISTA',
        },
      ],
      skipDuplicates: true,
    })
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { firebaseUid: { in: [uidEscritorio, uidAnalista] } } })
  })

  function appDeTeste() {
    const app = express()
    app.get('/privado', auth, (req, res) => res.json({ ok: true, perfil: req.usuario?.perfil }))
    app.get('/so-analista', auth, exige('ANALISTA'), (_req, res) => res.json({ ok: true }))
    return app
  }

  it('401 sem header Authorization', async () => {
    const res = await request(appDeTeste()).get('/privado')
    expect(res.status).toBe(401)
  })

  it('401 com token inválido', async () => {
    const res = await request(appDeTeste()).get('/privado').set('Authorization', 'Bearer token-invalido')
    expect(res.status).toBe(401)
  })

  it('200 com token válido e usuário cadastrado', async () => {
    const idToken = await obterIdTokenDeTeste(uidEscritorio)
    const res = await request(appDeTeste()).get('/privado').set('Authorization', `Bearer ${idToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, perfil: 'ESCRITORIO' })
  })

  it('401 quando o token é válido mas não há Usuario cadastrado', async () => {
    const idToken = await obterIdTokenDeTeste('uid-sem-usuario-no-postgres')
    const res = await request(appDeTeste()).get('/privado').set('Authorization', `Bearer ${idToken}`)
    expect(res.status).toBe(401)
  })

  it('exige(perfil): 403 para perfil não autorizado, 200 para o autorizado', async () => {
    const tokenEscritorio = await obterIdTokenDeTeste(uidEscritorio)
    const resNegado = await request(appDeTeste())
      .get('/so-analista')
      .set('Authorization', `Bearer ${tokenEscritorio}`)
    expect(resNegado.status).toBe(403)

    const tokenAnalista = await obterIdTokenDeTeste(uidAnalista)
    const resPermitido = await request(appDeTeste())
      .get('/so-analista')
      .set('Authorization', `Bearer ${tokenAnalista}`)
    expect(resPermitido.status).toBe(200)
  })
})
