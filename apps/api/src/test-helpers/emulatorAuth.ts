import { firebaseAuth } from '../lib/firebaseAdmin.js'

/**
 * Troca um custom token (criado pelo Admin SDK) por um ID token de verdade,
 * usando o endpoint REST do Auth Emulator — é assim que se testa um middleware
 * que espera um ID token (o Admin SDK não gera ID tokens diretamente).
 */
export async function obterIdTokenDeTeste(uid: string): Promise<string> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST
  if (!host) throw new Error('FIREBASE_AUTH_EMULATOR_HOST não definido')

  const customToken = await firebaseAuth().createCustomToken(uid)
  const res = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  )
  if (!res.ok) throw new Error(`Falha ao trocar custom token por ID token: ${res.status}`)
  const data = (await res.json()) as { idToken: string }
  return data.idToken
}
