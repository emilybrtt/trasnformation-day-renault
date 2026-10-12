import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'

// Defaults são os mesmos valores fictícios do .env.example — só funcionam
// contra o Auth Emulator, não são credenciais reais, então é seguro manter
// aqui. Sem eles, um ambiente sem `.env` (como o job de e2e do CI, que não
// copia `.env.example` nem define VITE_* no workflow) faz `getAuth` lançar
// `auth/invalid-api-key` de forma síncrona, derrubando o app inteiro antes de
// qualquer render — achado vendo o trace do Playwright no CI mostrar uma tela
// em branco com esse erro, depois de descartar lentidão do `vite dev` como
// causa (Fase D).
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-gavve.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-gavve',
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
