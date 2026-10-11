import { useQuery, useQueryClient } from '@tanstack/react-query'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiGet } from '../lib/api'
import { auth } from '../lib/firebase'

export type Perfil = 'ESCRITORIO' | 'ANALISTA' | 'GESTOR'

export interface Usuario {
  firebaseUid: string
  nome: string
  email: string
  perfil: Perfil
  escritorioId: string | null
}

interface AuthContextValue {
  usuario: Usuario | undefined
  carregando: boolean
  erro: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [carregandoFirebase, setCarregandoFirebase] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      setCarregandoFirebase(false)
    })
  }, [])

  const meQuery = useQuery({
    queryKey: ['me', firebaseUser?.uid],
    queryFn: () => apiGet<Usuario>('/me'),
    enabled: firebaseUser !== null,
    retry: false,
  })

  async function login(email: string, senha: string) {
    await signInWithEmailAndPassword(auth, email, senha)
  }

  async function logout() {
    await signOut(auth)
    queryClient.clear()
  }

  const carregando = carregandoFirebase || (firebaseUser !== null && meQuery.isLoading)

  return (
    <AuthContext.Provider value={{ usuario: meQuery.data, carregando, erro: meQuery.isError, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
