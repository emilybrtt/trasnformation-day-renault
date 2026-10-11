import { STATUS_SOLICITACAO } from '@gavve/shared'
import { useParams } from 'react-router-dom'
import { Botao } from '../../components/ui/Button'
import { EstadoCarregando, EstadoErro } from '../../components/ui/Estado'
import { SemaforoBadge, StatusBadge } from '../../components/ui/StatusBadge'
import { useSolicitacao } from '../../hooks/useSolicitacoes'
import { useToast, mensagemDeErro } from '../../hooks/useToast'
import { baixarArquivo } from '../../lib/api'
import { formatarData, formatarMoeda } from '../../lib/formato'

// Linha do tempo derivada da posição no enum — não existe endpoint de histórico
// público ainda (Historico é só auditoria interna), então mostramos os status já
// alcançados em ordem, sem timestamp exato de cada um (F9, documentado em DECISOES.md).
const ORDEM_TIMELINE = STATUS_SOLICITACAO.filter((s) => s !== 'DEVOLVIDO' && s !== 'CANCELADO')

export function DetalheSolicitacao() {
  const { id } = useParams<{ id: string }>()
  const { data: solicitacao, isLoading, isError } = useSolicitacao(id)
  const { notificar } = useToast()

  if (isLoading) return <EstadoCarregando rotulo="Carregando solicitação…" />
  if (isError || !solicitacao) return <EstadoErro mensagem="Solicitação não encontrada." />

  const comprovante = solicitacao.anexos.find((a) => a.tipo === 'COMPROVANTE')
  const passoAtual = ORDEM_TIMELINE.indexOf(solicitacao.status as (typeof ORDEM_TIMELINE)[number])

  async function baixarComprovante() {
    if (!comprovante) return
    try {
      await baixarArquivo(`/anexos/${comprovante.id}/download`, comprovante.nomeArquivo)
    } catch (err) {
      notificar(mensagemDeErro(err, 'Não foi possível baixar o comprovante.'), 'erro')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="f-mono text-xs uppercase tracking-wide text-[var(--muted)]">{solicitacao.tipoFluxo}</p>
          <h1 className="f-display text-3xl font-bold">{formatarMoeda(solicitacao.valorTotal)}</h1>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={solicitacao.status} />
          <SemaforoBadge semaforo={solicitacao.semaforo} />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {ORDEM_TIMELINE.map((status, i) => (
          <div key={status} className="flex items-center gap-2">
            <span
              className={`f-mono px-2 py-1 text-[10px] uppercase tracking-wide ${
                i <= passoAtual ? 'bg-[var(--ink)] text-[var(--accent)]' : 'bg-[var(--surface-2)] text-[var(--muted)]'
              }`}
            >
              {status}
            </span>
            {i < ORDEM_TIMELINE.length - 1 && <span className="text-[var(--line-2)]">→</span>}
          </div>
        ))}
      </div>

      {solicitacao.status === 'DEVOLVIDO' && (
        <div className="mt-6 border border-[var(--bad)] bg-[var(--bad-soft)] p-4 text-sm text-[var(--bad-ink)]">Devolvido pelo analista — veja os comentários abaixo.</div>
      )}

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="f-display mb-3 text-xl font-bold">Lançamentos</h2>
          <div className="flex flex-col gap-3">
            {solicitacao.lancamentos.map((l) => (
              <div key={l.id} className="border border-[var(--line)] p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">{l.pastaProjuris}</span>
                  <SemaforoBadge semaforo={l.semaforo} />
                </div>
                <p className="text-[var(--muted)]">
                  {l.area} · {l.motivo}
                </p>
                <p className="f-display font-semibold">{formatarMoeda(Number(l.valorPrincipal) + Number(l.valorJurosCorrecao))}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="f-display mb-3 text-xl font-bold">Comentários</h2>
          {solicitacao.comentarios.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nenhum comentário ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {solicitacao.comentarios.map((c) => (
                <div key={c.id} className="border border-[var(--line)] p-3 text-sm">
                  <p>{c.texto}</p>
                  <p className="f-mono mt-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">{formatarData(c.createdAt)}</p>
                </div>
              ))}
            </div>
          )}

          {comprovante && (
            <Botao className="mt-6" onClick={() => void baixarComprovante()}>
              Baixar comprovante
            </Botao>
          )}
        </div>
      </div>
    </div>
  )
}
