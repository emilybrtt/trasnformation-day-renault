import type { ButtonHTMLAttributes } from 'react'

type Variante = 'primaria' | 'secundaria' | 'perigo' | 'link'

const CLASSES_VARIANTE: Record<Variante, string> = {
  primaria: 'bg-[var(--accent)] text-[var(--on-accent)] hover:brightness-95',
  secundaria: 'border border-[var(--ink)] bg-[var(--bg)] text-[var(--ink)] hover:bg-[var(--surface)]',
  perigo: 'border border-[var(--bad)] text-[var(--bad-ink)] hover:bg-[var(--bad-soft)]',
  link: 'underline text-[var(--ink)] hover:text-[var(--muted)] px-0',
}

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  carregando?: boolean
}

export function Botao({ variante = 'secundaria', carregando, disabled, children, className = '', ...props }: BotaoProps) {
  return (
    <button
      {...props}
      disabled={disabled || carregando}
      className={`f-mono inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${CLASSES_VARIANTE[variante]} ${className}`}
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  )
}
