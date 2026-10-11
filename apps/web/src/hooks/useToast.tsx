import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type TipoToast = 'ok' | 'erro'

interface Toast {
  id: number
  tipo: TipoToast
  mensagem: string
}

interface ToastContextValue {
  toasts: Toast[]
  notificar: (mensagem: string, tipo?: TipoToast) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

let proximoId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const notificar = useCallback((mensagem: string, tipo: TipoToast = 'ok') => {
    const id = proximoId++
    setToasts((atuais) => [...atuais, { id, tipo, mensagem }])
    setTimeout(() => setToasts((atuais) => atuais.filter((t) => t.id !== id)), 5000)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, notificar }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              'f-mono px-4 py-3 text-sm font-medium shadow-lg ' +
              (toast.tipo === 'ok' ? 'bg-[var(--ok)] text-[var(--on-ok)]' : 'bg-[var(--bad)] text-[var(--on-bad)]')
            }
          >
            {toast.mensagem}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}

/** Extrai uma mensagem de erro amigável de qualquer coisa que uma chamada à API
 * possa lançar (ApiError, erro de rede, etc.). */
export function mensagemDeErro(err: unknown, padrao = 'Algo deu errado. Tente novamente.'): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message) {
    return err.message
  }
  return padrao
}
