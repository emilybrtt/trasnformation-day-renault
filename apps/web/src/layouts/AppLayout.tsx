import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth, type Usuario } from '../hooks/useAuth'

const ITENS_NAV: Record<Usuario['perfil'], Array<{ rotulo: string; para: string }>> = {
  ESCRITORIO: [
    { rotulo: 'Início', para: '/' },
    { rotulo: 'Nova solicitação', para: '/solicitacoes/nova' },
  ],
  ANALISTA: [
    { rotulo: 'Fila de conferência', para: '/' },
    { rotulo: 'Configurações', para: '/configuracoes' },
  ],
  GESTOR: [
    { rotulo: 'Dashboards', para: '/' },
    { rotulo: 'Assistente IA', para: '/assistente' },
  ],
}

const LABEL_PERFIL: Record<Usuario['perfil'], string> = {
  ESCRITORIO: 'Escritório parceiro',
  ANALISTA: 'Operador · Jurídico',
  GESTOR: 'Dono do fluxo',
}

export function AppLayout({ usuario, children }: { usuario: Usuario; children: ReactNode }) {
  const { logout } = useAuth()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto flex max-w-[1440px] gap-10 px-4 py-4">
        <aside className="flex w-20 flex-none flex-col items-center gap-6 bg-[var(--rail)] py-6 text-[var(--rail-ink)]">
          <span className="f-display text-lg font-bold text-[var(--accent)]">G</span>
          <span className="f-mono bg-[var(--accent)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[var(--on-accent)]">
            {usuario.perfil}
          </span>
          <hr className="w-8 border-[var(--rail-muted)]/40" />
          <nav className="flex w-full flex-col items-center gap-1">
            {ITENS_NAV[usuario.perfil].map((item) => {
              const ativo = location.pathname === item.para
              return (
                <Link
                  key={item.para}
                  to={item.para}
                  className={`f-mono flex w-full flex-col items-center gap-1 px-1 py-4 text-center text-[9px] uppercase tracking-wide ${
                    ativo ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--rail-ink)] hover:text-[var(--accent)]'
                  }`}
                >
                  {item.rotulo}
                </Link>
              )
            })}
          </nav>
          <div className="mt-auto flex flex-col items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-[var(--accent)] text-sm font-bold text-[var(--on-accent)]">
              {usuario.nome.slice(0, 1).toUpperCase()}
            </div>
            <button type="button" onClick={() => void logout()} className="f-mono text-[9px] uppercase tracking-wide text-[var(--rail-muted)] hover:text-[var(--accent)]">
              Saír
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-16">
          <div className="f-mono flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 pt-2 text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <span>{LABEL_PERFIL[usuario.perfil]}</span>
            <span className="bg-[var(--ink)] px-2 py-1 text-[var(--accent)]">{usuario.nome}</span>
          </div>
          <div className="pt-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
