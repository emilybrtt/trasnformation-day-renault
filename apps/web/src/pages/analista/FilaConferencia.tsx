import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Botao } from '../../components/ui/Button'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../components/ui/Estado'
import { SemaforoBadge, StatusBadge, TipoFluxoBadge } from '../../components/ui/StatusBadge'
import { useAprovarSolicitacao, useListaSolicitacoes } from '../../hooks/useSolicitacoes'
import { mensagemDeErro, useToast } from '../../hooks/useToast'
import { formatarData, formatarMoeda } from '../../lib/formato'

const TIPOS_FLUXO_FILTRO = [
  { valor: '', rotulo: 'Todos os tipos' },
  { valor: 'ANEXO_V_ADIANTAMENTO', rotulo: 'Anexo V · Adiantamento' },
  { valor: 'ANEXO_V_BAIXA', rotulo: 'Anexo V · Baixa' },
  { valor: 'ANEXO_V_REEMBOLSO', rotulo: 'Anexo V · Reembolso' },
  { valor: 'RC_HONORARIOS_NF', rotulo: 'RC Honorários (NF)' },
  { valor: 'RBS_DD_GUIA', rotulo: 'RBS_DD (guia)' },
]

function ContadorSemaforo({ emoji, rotulo, valor, ativo, onClick }: { emoji: string; rotulo: string; valor: number; ativo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-1 border p-4 text-left transition ${ativo ? 'border-[var(--ink)] bg-[var(--surface)]' : 'border-[var(--line)] hover:border-[var(--ink)]'}`}
    >
      <span className="text-2xl">
        {emoji} <span className="f-display font-bold">{valor}</span>
      </span>
      <span className="f-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">{rotulo}</span>
    </button>
  )
}

export function FilaConferencia() {
  const [tipoFluxo, setTipoFluxo] = useState('')
  const [semaforo, setSemaforo] = useState('')
  const [pasta, setPasta] = useState('')
  const { notificar } = useToast()

  const fila = useListaSolicitacoes({ status: 'EM_CONFERENCIA', tipoFluxo: tipoFluxo || undefined, semaforo: semaforo || undefined, pasta: pasta || undefined, pageSize: 200 })
  const todasEmConferencia = useListaSolicitacoes({ status: 'EM_CONFERENCIA', pageSize: 200 })
  const aprovar = useAprovarSolicitacao()

  const contagem = { VERDE: 0, AMARELO: 0, VERMELHO: 0 }
  for (const s of todasEmConferencia.data?.items ?? []) contagem[s.semaforo]++

  const verdesVisiveis = fila.data?.items.filter((s) => s.semaforo === 'VERDE') ?? []

  async function aprovarTodasAsVerdes() {
    for (const s of verdesVisiveis) {
      try {
        await aprovar.mutateAsync(s.id)
      } catch (err) {
        notificar(mensagemDeErro(err, `Não foi possível aprovar a solicitação ${s.id}.`), 'erro')
      }
    }
    notificar(`${verdesVisiveis.length} solicitação(ões) aprovada(s).`)
  }

  return (
    <div>
      <h1 className="f-display text-4xl font-bold">Fila de conferência</h1>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <ContadorSemaforo emoji="🔴" rotulo="Vermelho" valor={contagem.VERMELHO} ativo={semaforo === 'VERMELHO'} onClick={() => setSemaforo(semaforo === 'VERMELHO' ? '' : 'VERMELHO')} />
        <ContadorSemaforo emoji="🟡" rotulo="Amarelo" valor={contagem.AMARELO} ativo={semaforo === 'AMARELO'} onClick={() => setSemaforo(semaforo === 'AMARELO' ? '' : 'AMARELO')} />
        <ContadorSemaforo emoji="🟢" rotulo="Verde" valor={contagem.VERDE} ativo={semaforo === 'VERDE'} onClick={() => setSemaforo(semaforo === 'VERDE' ? '' : 'VERDE')} />
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="f-mono uppercase tracking-wide text-[var(--muted)]">Tipo de fluxo</span>
          <select value={tipoFluxo} onChange={(e) => setTipoFluxo(e.target.value)} className="border border-[var(--line-2)] px-3 py-2 text-sm">
            {TIPOS_FLUXO_FILTRO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="f-mono uppercase tracking-wide text-[var(--muted)]">Pasta</span>
          <input value={pasta} onChange={(e) => setPasta(e.target.value)} placeholder="busca por pasta" className="border border-[var(--line-2)] px-3 py-2 text-sm" />
        </label>

        {verdesVisiveis.length > 0 && (
          <Botao variante="primaria" carregando={aprovar.isPending} onClick={() => void aprovarTodasAsVerdes()} className="ml-auto">
            Aprovar todas as verdes ({verdesVisiveis.length})
          </Botao>
        )}
      </div>

      <div className="mt-8">
        {fila.isLoading && <EstadoCarregando rotulo="Carregando fila…" />}
        {fila.isError && <EstadoErro mensagem="Não foi possível carregar a fila." />}
        {fila.data && fila.data.items.length === 0 && <EstadoVazio mensagem="Nenhuma solicitação em conferência com esses filtros." />}

        <div className="flex flex-col">
          {fila.data?.items.map((s) => (
            <Link
              key={s.id}
              to={`/solicitacoes/${s.id}`}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-4 hover:bg-[var(--surface)]"
            >
              <SemaforoBadge semaforo={s.semaforo} />
              <span className="f-mono text-xs text-[var(--muted)]">{formatarData(s.dataDocumento)}</span>
              <TipoFluxoBadge tipoFluxo={s.tipoFluxo} />
              <span className="f-display font-semibold">{formatarMoeda(s.valorTotal)}</span>
              <StatusBadge status={s.status} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
