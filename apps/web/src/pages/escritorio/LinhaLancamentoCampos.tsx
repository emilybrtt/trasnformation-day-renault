import { AREAS, MOTIVOS } from '@gavve/shared'
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import { useDePara } from '../../hooks/useSolicitacoes'
import { formatarMoeda } from '../../lib/formato'
import type { FormValues } from './NovaSolicitacao'

interface Props {
  control: Control<FormValues>
  register: UseFormRegister<FormValues>
  index: number
  errors: FieldErrors<FormValues>['linhas']
  onRemover: () => void
  podeRemover: boolean
}

function PainelContabil({ area, motivo }: { area: string | undefined; motivo: string | undefined }) {
  const { data, isLoading } = useDePara(area || undefined, motivo || undefined)

  if (!area || !motivo) {
    return <p className="f-mono text-xs uppercase tracking-wide text-[var(--muted)]">Escolha área e motivo para ver o de-para.</p>
  }
  if (isLoading) return <p className="f-mono text-xs uppercase tracking-wide text-[var(--muted)]">Calculando…</p>

  const linha = data?.[0]
  if (!linha) {
    return (
      <p className="f-mono text-xs uppercase tracking-wide text-[var(--bad-ink)]">
        Sem de-para cadastrado para essa área/motivo — este lançamento entrará em 🔴 vermelho.
      </p>
    )
  }

  return (
    <dl className="grid grid-cols-3 gap-3 text-sm">
      <div>
        <dt className="f-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">Centro de custo</dt>
        <dd className="f-mono font-semibold">{linha.centroCusto}</dd>
      </div>
      <div>
        <dt className="f-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">Conta contábil</dt>
        <dd className="f-mono font-semibold">{linha.contaContabil}</dd>
      </div>
      <div>
        <dt className="f-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">Ordem interna / ZEDOA</dt>
        <dd className="f-mono font-semibold">{linha.ordemInterna ?? '—'}</dd>
      </div>
    </dl>
  )
}

export function LinhaLancamentoCampos({ control, register, index, errors, onRemover, podeRemover }: Props) {
  const area = useWatch({ control, name: `linhas.${index}.area` })
  const motivo = useWatch({ control, name: `linhas.${index}.motivo` })
  const valorPrincipal = useWatch({ control, name: `linhas.${index}.valorPrincipal` })
  const valorJuros = useWatch({ control, name: `linhas.${index}.valorJurosCorrecao` })
  const erroLinha = errors?.[index]

  return (
    <div className="border border-[var(--line)] p-4">
      <div className="flex items-center justify-between">
        <span className="f-mono text-xs uppercase tracking-wide text-[var(--muted)]">Lançamento {index + 1}</span>
        {podeRemover && (
          <button type="button" onClick={onRemover} className="f-mono text-xs uppercase text-[var(--bad-ink)] underline">
            Remover
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Pasta Projuris
          <input {...register(`linhas.${index}.pastaProjuris`)} className="border border-[var(--line-2)] px-3 py-2" />
          {erroLinha?.pastaProjuris && <span className="text-xs text-[var(--bad-ink)]">{erroLinha.pastaProjuris.message}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Área
          <select {...register(`linhas.${index}.area`)} className="border border-[var(--line-2)] px-3 py-2">
            <option value="">Selecione…</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Motivo
          <select {...register(`linhas.${index}.motivo`)} className="border border-[var(--line-2)] px-3 py-2">
            <option value="">Selecione…</option>
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Valor principal
          <input {...register(`linhas.${index}.valorPrincipal`, { valueAsNumber: true })} type="number" step="0.01" className="border border-[var(--line-2)] px-3 py-2" />
          {erroLinha?.valorPrincipal && <span className="text-xs text-[var(--bad-ink)]">{erroLinha.valorPrincipal.message}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Juros/correção
          <input {...register(`linhas.${index}.valorJurosCorrecao`, { valueAsNumber: true })} type="number" step="0.01" className="border border-[var(--line-2)] px-3 py-2" />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span>Total do lançamento</span>
          <span className="f-display py-2 font-semibold">{formatarMoeda((Number(valorPrincipal) || 0) + (Number(valorJuros) || 0))}</span>
        </div>
      </div>

      <div className="mt-4 bg-[var(--surface)] p-3">
        <p className="f-mono mb-2 text-[11px] uppercase tracking-wide text-[var(--muted)]">Dados contábeis (automático)</p>
        <PainelContabil area={area} motivo={motivo} />
      </div>
    </div>
  )
}
