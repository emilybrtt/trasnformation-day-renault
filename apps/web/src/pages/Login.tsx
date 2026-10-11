import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import { Botao } from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { mensagemDeErro } from '../hooks/useToast'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
  senha: z.string().min(1, 'Senha é obrigatória'),
})
type LoginInput = z.infer<typeof loginSchema>

const CONTAS_DEMO = [
  { perfil: 'Escritório', descricao: 'envia e acompanha solicitações', email: 'escritorio@demo.gavve' },
  { perfil: 'Analista', descricao: 'confere, aprova e paga', email: 'analista@demo.gavve' },
  { perfil: 'Gestor', descricao: 'dashboards e assistente IA', email: 'gestor@demo.gavve' },
] as const
const SENHA_DEMO = 'demo1234'

export function Login() {
  const { usuario, carregando, login } = useAuth()
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)
  const { register, handleSubmit, setValue, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  if (!carregando && usuario) return <Navigate to="/" replace />

  async function entrar(email: string, senha: string) {
    setErro(null)
    setEntrando(true)
    try {
      await login(email, senha)
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível entrar. Confira e-mail e senha.'))
    } finally {
      setEntrando(false)
    }
  }

  function entrarComoDemo(email: string) {
    setValue('email', email)
    setValue('senha', SENHA_DEMO)
    void entrar(email, SENHA_DEMO)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--surface)] px-4">
      <div className="w-full max-w-md bg-[var(--bg)] p-8 shadow-sm">
        <p className="f-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Jurídico · Pagamentos</p>
        <h1 className="f-display mt-2 text-3xl font-bold">GAVVE</h1>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit((dados) => entrar(dados.email, dados.senha))}>
          <label className="flex flex-col gap-1 text-sm">
            E-mail
            <input {...register('email')} type="email" className="border border-[var(--line-2)] px-3 py-2" autoComplete="email" />
            {formState.errors.email && <span className="text-xs text-[var(--bad-ink)]">{formState.errors.email.message}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Senha
            <input {...register('senha')} type="password" className="border border-[var(--line-2)] px-3 py-2" autoComplete="current-password" />
            {formState.errors.senha && <span className="text-xs text-[var(--bad-ink)]">{formState.errors.senha.message}</span>}
          </label>

          {erro && <p className="text-sm text-[var(--bad-ink)]">{erro}</p>}

          <Botao type="submit" variante="primaria" carregando={entrando}>
            Entrar
          </Botao>
        </form>

        <p className="f-mono mt-8 text-xs uppercase tracking-wide text-[var(--muted)]">Entrar como (demo)</p>
        <div className="mt-3 flex flex-col gap-2">
          {CONTAS_DEMO.map((conta) => (
            <button
              key={conta.email}
              type="button"
              onClick={() => entrarComoDemo(conta.email)}
              disabled={entrando}
              className="border border-[var(--line)] px-4 py-3 text-left transition hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="f-display block font-semibold">{conta.perfil}</span>
              <span className="block text-xs text-[var(--muted)]">{conta.descricao}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
