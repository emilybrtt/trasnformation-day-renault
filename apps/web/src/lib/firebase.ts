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
