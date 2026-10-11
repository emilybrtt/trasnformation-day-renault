export function EmConstrucao({ perfil }: { perfil: string }) {
  return (
    <div className="border border-dashed border-[var(--line-2)] px-6 py-16 text-center">
      <p className="f-mono text-xs uppercase tracking-wide text-[var(--muted)]">Em construção</p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        As telas de {perfil} chegam nos próximos cards (F10/F11) da Fase C.
      </p>
    </div>
  )
}
