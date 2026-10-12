import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
})

export const auth = getAuth(app)

// Conecta no Auth Emulator por padrão — é assim que o MVP roda 100% local, sem
// nenhuma credencial real (mesma regra do CLAUDE.md).
if (import.meta.env.VITE_USE_AUTH_EMULATOR !== 'false') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
}

// O Firebase restaura a sessão persistida (IndexedDB) de forma assíncrona —
// logo após um reload/deep-link de verdade (page.goto, F5, link direto),
// `auth.currentUser` ainda é `null` por um instante mesmo com sessão válida.
// `authStateReady()` é a API oficial do SDK pra aguardar essa restauração
// (diferente de só esperar o primeiro `onAuthStateChanged`, que pode disparar
// com `null` antes da sessão ser restaurada). Sem isso, a primeira requisição
// autenticada saía sem o header e recebia 401 (achado testando a Fase D: a
// tela da/o Analista aberta por URL direta mostrava "não encontrada" mesmo
// com a solicitação existindo).
export const authPronto: Promise<void> = auth.authStateReady()
