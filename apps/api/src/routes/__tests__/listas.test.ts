import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { obterIdTokenDeTeste } from '../../test-helpers/emulatorAuth.js'

const semEmulador = !process.env.FIREBASE_AUTH_EMULATOR_HOST

describe.skipIf(semEmulador)('rotas de /listas, /de-para e /fornecedores (F9)', () => {
  const app = createApp()
  const uid = 'test-lst-uid-escritorio'
  let token: string

  beforeAll(async () => {
    await prisma.usuario.upsert({
      where: { firebaseUid: uid },
      create: { firebaseUid: uid, nome: 'Escritório Teste', email: 'e@test-lst.gavve', perfil: 'ESCRITORIO' },
      update: {},
    })
    await prisma.fornecedor.upsert({
      where: { cnpj: '55555555000144' },
      create: { codigoSap: 'SAP-TEST-LST', nome: 'Fornecedor Teste Listas (DEMO)', cnpj: '55555555000144' },
      update: {},
    })
    token = await obterIdTokenDeTeste(uid)
  })

  afterAll(async () => {
    await prisma.fornecedor.deleteMany({ where: { cnpj: '55555555000144' } })
    await prisma.usuario.delete({ where: { firebaseUid: uid } })
  })

  it('GET /listas devolve as listas fixas de domínio', async () => {
    const res = await request(app).get('/listas').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.areas).toContain('CÍVEL')
    expect(res.body.motivos).toContain('CONDENAÇÃO')
    expect(res.body.tiposFluxo).toContain('RBS_DD_GUIA')
  })

  it('GET /de-para filtra por área/motivo', async () => {
    const res = await request(app).get('/de-para?area=TRABALHISTA PIF/PDV&motivo=CONDENAÇÃO').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.every((l: { area: string }) => l.area === 'TRABALHISTA PIF/PDV')).toBe(true)
  })

  it('GET /fornecedores lista e filtra por nome (busca case-insensitive)', async () => {
    const todos = await request(app).get('/fornecedores').set('Authorization', `Bearer ${token}`)
    expect(todos.status).toBe(200)
    expect(todos.body.some((f: { cnpj: string }) => f.cnpj === '55555555000144')).toBe(true)

    const filtrado = await request(app).get('/fornecedores?busca=teste listas').set('Authorization', `Bearer ${token}`)
    expect(filtrado.status).toBe(200)
    expect(filtrado.body).toHaveLength(1)

    const semResultado = await request(app).get('/fornecedores?busca=nao-existe-xyz').set('Authorization', `Bearer ${token}`)
    expect(semResultado.body).toHaveLength(0)
  })

  it('401 sem token', async () => {
    const res = await request(app).get('/listas')
    expect(res.status).toBe(401)
  })
})
