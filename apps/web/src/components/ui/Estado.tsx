export function EstadoCarregando({ rotulo = 'Carregando…' }: { rotulo?: string }) {
  return <p className="f-mono py-10 text-center text-sm uppercase tracking-wide text-[var(--muted)]">{rotulo}</p>
}

export function EstadoErro({ mensagem = 'Não foi possível carregar os dados.' }: { mensagem?: string }) {
  return (
    <div className="border border-[var(--bad)] bg-[var(--bad-soft)] px-4 py-6 text-center text-sm text-[var(--bad-ink)]">
      {mensagem}
    </div>
  )
}

export function EstadoVazio({ mensagem = 'Nada por aqui ainda.' }: { mensagem?: string }) {
  return (
    <div className="border border-dashed border-[var(--line-2)] px-4 py-10 text-center text-sm text-[var(--muted)]">
      {mensagem}
    </div>
  )
}
