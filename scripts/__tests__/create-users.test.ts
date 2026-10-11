import { getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { beforeAll, describe, expect, it } from 'vitest'
import { criarUsuariosDemo, SENHA_DEMO, USUARIOS_DEMO } from '../create-users.js'

const semEmulador = !process.env.FIREBASE_AUTH_EMULATOR_HOST

describe.skipIf(semEmulador)('criarUsuariosDemo (Auth Emulator)', () => {
  beforeAll(async () => {
    await criarUsuariosDemo()
  })

  it('cria os 3 usuários com e-mail e senha corretos', async () => {
    const auth = getAuth(getApps()[0])
    for (const usuario of USUARIOS_DEMO) {
      const user = await auth.getUser(usuario.uid)
      expect(user.email).toBe(usuario.email)
    }
  })

  it('aplica os custom claims de perfil e escritório', async () => {
    const auth = getAuth(getApps()[0])
    const escritorio = await auth.getUser('demo-escritorio')
    expect(escritorio.customClaims).toEqual({ perfil: 'ESCRITORIO', escritorioId: 'escritorio-alfa' })

    const analista = await auth.getUser('demo-analista')
    expect(analista.customClaims?.perfil).toBe('ANALISTA')
  })

  it('é idempotente — rodar de novo não falha e preserva os claims', async () => {
    await expect(criarUsuariosDemo()).resolves.toBeUndefined()
    const auth = getAuth(getApps()[0])
    const gestor = await auth.getUser('demo-gestor')
    expect(gestor.customClaims?.perfil).toBe('GESTOR')
  })

  it('exporta a senha demo padrão', () => {
    expect(SENHA_DEMO).toBe('demo1234')
  })
})

describe('criarUsuariosDemo sem emulador', () => {
  it('recusa rodar sem FIREBASE_AUTH_EMULATOR_HOST', async () => {
    await expect(criarUsuariosDemo(USUARIOS_DEMO, {})).rejects.toThrow(/FIREBASE_AUTH_EMULATOR_HOST/)
  })
})
