#!/usr/bin/env tsx
/**
 * Cria (ou atualiza) os usuários de demonstração no Firebase Auth Emulator, com
 * custom claims de perfil e escritório.
 *
 * Uso: tsx scripts/create-users.ts
 * Precisa de FIREBASE_AUTH_EMULATOR_HOST definido — roda só contra o emulador.
 */
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

export const SENHA_DEMO = 'demo1234'

export interface UsuarioDemo {
  uid: string
  email: string
  perfil: 'ESCRITORIO' | 'ANALISTA' | 'GESTOR'
  escritorioId?: string
}

export const USUARIOS_DEMO: UsuarioDemo[] = [
  { uid: 'demo-escritorio', email: 'escritorio@demo.gavve', perfil: 'ESCRITORIO', escritorioId: 'escritorio-alfa' },
  { uid: 'demo-analista', email: 'analista@demo.gavve', perfil: 'ANALISTA' },
  { uid: 'demo-gestor', email: 'gestor@demo.gavve', perfil: 'GESTOR' },
]

export async function criarUsuariosDemo(usuarios: UsuarioDemo[] = USUARIOS_DEMO, env = process.env) {
  if (!env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      'FIREBASE_AUTH_EMULATOR_HOST não definido — este script só roda contra o Auth Emulator.',
    )
  }
  if (getApps().length === 0) {
    initializeApp({ projectId: env.GCLOUD_PROJECT ?? 'demo-gavve' })
  }
  const auth = getAuth()

  for (const usuario of usuarios) {
    await auth.createUser({ uid: usuario.uid, email: usuario.email, password: SENHA_DEMO }).catch((err) => {
      if (err?.code !== 'auth/uid-already-exists') throw err
      return auth.updateUser(usuario.uid, { email: usuario.email, password: SENHA_DEMO })
    })
    await auth.setCustomUserClaims(usuario.uid, {
      perfil: usuario.perfil,
      escritorioId: usuario.escritorioId,
    })
    console.log(`✔ ${usuario.email} (${usuario.perfil})`)
  }
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`
if (isDirectRun) {
  criarUsuariosDemo().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
