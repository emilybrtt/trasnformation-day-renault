import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { EstadoCarregando } from './components/ui/Estado'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './hooks/useToast'
import { AppLayout } from './layouts/AppLayout'
import { DetalheSolicitacao } from './pages/escritorio/DetalheSolicitacao'
import { Inicio } from './pages/escritorio/Inicio'
import { NovaSolicitacao } from './pages/escritorio/NovaSolicitacao'
import { EmConstrucao } from './pages/EmConstrucao'
import { Login } from './pages/Login'

const queryClient = new QueryClient()

function RotasProtegidas() {
  const { usuario, carregando, erro } = useAuth()

  if (carregando) return <EstadoCarregando rotulo="Carregando sessão…" />
  if (erro || !usuario) return <Navigate to="/login" replace />

  return (
    <AppLayout usuario={usuario}>
      <Routes>
        {usuario.perfil === 'ESCRITORIO' ? (
          <>
            <Route path="/" element={<Inicio />} />
            <Route path="/solicitacoes/nova" element={<NovaSolicitacao />} />
            <Route path="/solicitacoes/:id" element={<DetalheSolicitacao />} />
          </>
        ) : (
          <Route path="*" element={<EmConstrucao perfil={usuario.perfil} />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={<RotasProtegidas />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
