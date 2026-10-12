const CORES_SEMAFORO: Record<string, string> = {
  VERDE: 'bg-[var(--ok)] text-[var(--on-ok)]',
  AMARELO: 'bg-[var(--warn)] text-[var(--warn-ink)]',
  VERMELHO: 'bg-[var(--bad)] text-[var(--on-bad)]',
}

const EMOJI_SEMAFORO: Record<string, string> = { VERDE: '🟢', AMARELO: '🟡', VERMELHO: '🔴' }

export function SemaforoBadge({ semaforo }: { semaforo: string }) {
  return (
    <span className={`f-mono inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${CORES_SEMAFORO[semaforo] ?? 'bg-[var(--surface-2)] text-[var(--ink)]'}`}>
      <span aria-hidden>{EMOJI_SEMAFORO[semaforo] ?? '⚪'}</span>
      {semaforo}
    </span>
  )
}

const LABEL_STATUS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADO: 'Enviado',
  EM_CONFERENCIA: 'Em conferência',
  DEVOLVIDO: 'Devolvido',
  APROVADO: 'Aprovado',
  CHAMADO_ABERTO: 'Chamado aberto',
  RC_CRIADO: 'RC criado',
  NF_LANCADA: 'NF lançada',
  PAGAMENTO_PROGRAMADO: 'Pagamento programado',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
}

const COR_STATUS: Record<string, string> = {
  RASCUNHO: 'border border-dashed border-[var(--muted)] text-[var(--muted)]',
  ENVIADO: 'bg-[var(--ink)] text-[var(--accent)]',
  EM_CONFERENCIA: 'bg-[var(--accent)] text-[var(--on-accent)]',
  DEVOLVIDO: 'bg-[var(--bad-soft)] text-[var(--bad-ink)]',
  APROVADO: 'bg-[var(--ok-soft)] text-[var(--ok-ink)]',
  CHAMADO_ABERTO: 'bg-[var(--ink)] text-[var(--accent)]',
  RC_CRIADO: 'bg-[var(--ink)] text-[var(--accent)]',
  NF_LANCADA: 'bg-[var(--ink)] text-[var(--accent)]',
  PAGAMENTO_PROGRAMADO: 'bg-[var(--ink)] text-[var(--accent)]',
  PAGO: 'bg-[var(--ok)] text-[var(--on-ok)]',
  CANCELADO: 'bg-[var(--surface-2)] text-[var(--muted)] line-through',
}

const LABEL_TIPO_FLUXO: Record<string, string> = {
  ANEXO_V_ADIANTAMENTO: 'Anexo V · Adiantamento',
  ANEXO_V_BAIXA: 'Anexo V · Baixa',
  ANEXO_V_REEMBOLSO: 'Anexo V · Reembolso',
  RC_HONORARIOS_NF: 'RC Honorários (NF)',
  RBS_DD_GUIA: 'RBS_DD (guia)',
}

export function TipoFluxoBadge({ tipoFluxo }: { tipoFluxo: string }) {
  return (
    <span className="f-mono inline-flex items-center bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">
      {LABEL_TIPO_FLUXO[tipoFluxo] ?? tipoFluxo}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`f-display inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-wide ${COR_STATUS[status] ?? 'bg-[var(--surface-2)]'}`}>
      {LABEL_STATUS[status] ?? status}
    </span>
  )
}
