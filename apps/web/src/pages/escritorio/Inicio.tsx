import { Link } from 'react-router-dom'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../components/ui/Estado'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useListaSolicitacoes } from '../../hooks/useSolicitacoes'
import { formatarData, formatarMoeda } from '../../lib/formato'

function Tile({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: 'ok' | 'pend' }) {
  const fundo = destaque === 'ok' ? 'bg-[var(--ok-soft)]' : destaque === 'pend' ? 'bg-[var(--accent)]' : 'bg-[var(--bg)]'
  const cor = destaque === 'ok' ? 'text-[var(--ok-ink)]' : destaque === 'pend' ? 'text-[var(--on-accent)]' : 'text-[var(--ink)]'
  return (
    <div className={`flex flex-col gap-2 border border-[var(--ink)] p-5 ${fundo}`}>
      <span className="f-mono text-[11px] uppercase tracking-wide">{rotulo}</span>
      <span className={`f-display text-4xl font-bold ${cor}`}>{valor}</span>
    </div>
  )
}

function inicioDoMes(): Date {
  const hoje = new Date()
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
}

export function Inicio() {
  const emConferencia = useListaSolicitacoes({ status: 'EM_CONFERENCIA' })
  const devolvidas = useListaSolicitacoes({ status: 'DEVOLVIDO' })
  const pagas = useListaSolicitacoes({ status: 'PAGO' })
  const adiantamentos = useListaSolicitacoes({ tipoFluxo: 'ANEXO_V_ADIANTAMENTO' })
  const baixas = useListaSolicitacoes({ tipoFluxo: 'ANEXO_V_BAIXA' })
  const recentes = useListaSolicitacoes({ pageSize: 10 })

  const carregando = emConferencia.isLoading || devolvidas.isLoading || pagas.isLoading || adiantamentos.isLoading || baixas.isLoading
  const erro = emConferencia.isError || devolvidas.isError || pagas.isError || adiantamentos.isError || baixas.isError

  const inicioMes = inicioDoMes()
  const pagasNoMes = pagas.data?.items.filter((s) => s.dataPagamento && new Date(s.dataPagamento) >= inicioMes).length ?? 0

  const totalAdiantado = adiantamentos.data?.items
    .filter((s) => s.status !== 'CANCELADO')
    .reduce((acc, s) => acc + Number(s.valorTotal), 0)
  const totalBaixado = baixas.data?.items
    .filter((s) => s.status !== 'CANCELADO')
    .reduce((acc, s) => acc + Number(s.valorTotal), 0)
  const saldoAdiantamento = (totalAdiantado ?? 0) - (totalBaixado ?? 0)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <h1 className="f-display text-4xl font-bold">Início</h1>
        <Link
          to="/solicitacoes/nova"
          className="f-mono inline-flex items-center gap-2 bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--on-accent)] hover:brightness-95"
        >
          + Nova solicitação
        </Link>
      </div>

      {carregando && <EstadoCarregando rotulo="Carregando painel…" />}
      {erro && <EstadoErro mensagem="Não foi possível carregar o painel. Tente novamente." />}

      {!carregando && !erro && (
        <>
          <div className="grid grid-cols-1 gap-px border border-[var(--ink)] sm:grid-cols-2 lg:grid-cols-4">
            <Tile rotulo="Em conferência" valor={String(emConferencia.data?.total ?? 0)} destaque="pend" />
            <Tile rotulo="Devolvidas" valor={String(devolvidas.data?.total ?? 0)} />
            <Tile rotulo="Pagas no mês" valor={String(pagasNoMes)} destaque="ok" />
            <Tile rotulo="Saldo de adiantamento" valor={formatarMoeda(saldoAdiantamento)} />
          </div>

          <div className="mt-10 border-b-2 border-[var(--ink)] pb-3">
            <h2 className="f-display text-2xl font-bold">Solicitações recentes</h2>
          </div>

          {recentes.data && recentes.data.items.length === 0 && <EstadoVazio mensagem="Nenhuma solicitação ainda. Crie a primeira." />}

          <div className="flex flex-col">
            {recentes.data?.items.map((s) => (
              <Link
                key={s.id}
                to={`/solicitacoes/${s.id}`}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-4 hover:bg-[var(--surface)]"
              >
                <span className="f-mono text-xs text-[var(--muted)]">{formatarData(s.dataDocumento)}</span>
                <span className="text-sm">{s.tipoFluxo}</span>
                <span className="f-display font-semibold">{formatarMoeda(s.valorTotal)}</span>
                <StatusBadge status={s.status} />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
