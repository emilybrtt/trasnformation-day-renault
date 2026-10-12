import { familiaDoFluxo, type FamiliaFluxo } from '@gavve/shared'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Botao } from '../../components/ui/Button'
import { EstadoCarregando, EstadoErro } from '../../components/ui/Estado'
import { SemaforoBadge, StatusBadge, TipoFluxoBadge } from '../../components/ui/StatusBadge'
import {
  useAbrirChamadoAnexoV,
  useAprovarSolicitacao,
  useChamadoRbsDd,
  useCriarRc,
  useDevolverSolicitacao,
  useEnviarLbs,
  useLancarNf,
  useProgramarPagamento,
  useRegistrarPagamento,
  useResolverAlerta,
  useSolicitacao,
} from '../../hooks/useSolicitacoes'
import { mensagemDeErro, useToast } from '../../hooks/useToast'
import { baixarArquivo } from '../../lib/api'
import { formatarData, formatarMoeda } from '../../lib/formato'
import type { SolicitacaoDetalhe } from '../../types/solicitacao'

// Linha do tempo por família de fluxo (F12) — cada uma com seu próprio caminho de
// integrações simuladas até o PAGO.
const PASSOS_POR_FAMILIA: Record<FamiliaFluxo, { status: string; rotulo: string }[]> = {
  ANEXO_V: [
    { status: 'EM_CONFERENCIA', rotulo: 'Conferência' },
    { status: 'APROVADO', rotulo: 'Aprovado' },
    { status: 'CHAMADO_ABERTO', rotulo: 'Chamado Anexo V (SSC)' },
    { status: 'PAGO', rotulo: 'Pago' },
  ],
  RC_HONORARIOS: [
    { status: 'EM_CONFERENCIA', rotulo: 'Conferência' },
    { status: 'APROVADO', rotulo: 'Aprovado' },
    { status: 'RC_CRIADO', rotulo: 'RC criado (SAP)' },
    { status: 'NF_LANCADA', rotulo: 'NF lançada (0800)' },
    { status: 'PAGAMENTO_PROGRAMADO', rotulo: 'Pagamento programado (SAP)' },
    { status: 'PAGO', rotulo: 'Pago' },
  ],
  RBS_DD: [
    { status: 'EM_CONFERENCIA', rotulo: 'Conferência' },
    { status: 'APROVADO', rotulo: 'Chamado pronto' },
    { status: 'CHAMADO_ABERTO', rotulo: 'Chamado aberto (LBS)' },
    { status: 'PAGO', rotulo: 'Pago' },
  ],
}

function LinhaDoTempo({ tipoFluxo, status }: { tipoFluxo: string; status: string }) {
  const familia = familiaDoFluxo(tipoFluxo as Parameters<typeof familiaDoFluxo>[0])
  const passos = PASSOS_POR_FAMILIA[familia]
  const passoAtual = passos.findIndex((p) => p.status === status)

  return (
    <div className="mt-8 flex flex-wrap gap-2">
      {passos.map((p, i) => (
        <div key={p.status} className="flex items-center gap-2">
          <span
            className={`f-mono px-2 py-1 text-[10px] uppercase tracking-wide ${
              i <= passoAtual || status === 'PAGO' ? 'bg-[var(--ink)] text-[var(--accent)]' : 'bg-[var(--surface-2)] text-[var(--muted)]'
            }`}
          >
            {p.rotulo}
          </span>
          {i < passos.length - 1 && <span className="text-[var(--line-2)]">→</span>}
        </div>
      ))}
    </div>
  )
}

function PainelAlertas({ solicitacao }: { solicitacao: SolicitacaoDetalhe }) {
  const resolver = useResolverAlerta(solicitacao.id)
  const [justificativas, setJustificativas] = useState<Record<string, string>>({})
  const { notificar } = useToast()

  if (solicitacao.alertas.length === 0) return null

  async function resolverAlerta(alertaId: string) {
    const justificativa = justificativas[alertaId]?.trim()
    if (!justificativa) {
      notificar('Informe a justificativa para resolver o alerta.', 'erro')
      return
    }
    try {
      await resolver.mutateAsync({ alertaId, justificativa })
      notificar('Alerta resolvido.')
    } catch (err) {
      notificar(mensagemDeErro(err, 'Não foi possível resolver o alerta.'), 'erro')
    }
  }

  return (
    <div className="mb-8">
      <h2 className="f-display mb-3 text-xl font-bold">Alertas</h2>
      <div className="flex flex-col gap-3">
        {solicitacao.alertas.map((a) => (
          <div
            key={a.id}
            className={`border p-3 text-sm ${a.resolvidoEm ? 'border-[var(--line)] opacity-60' : a.severidade === 'VERMELHO' ? 'border-[var(--bad)] bg-[var(--bad-soft)]' : 'border-[var(--warn)] bg-[var(--warn-soft)]'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="f-mono text-[10px] uppercase tracking-wide">{a.codigo}</span>
              {a.resolvidoEm && <span className="f-mono text-[10px] uppercase tracking-wide text-[var(--ok-ink)]">✓ resolvido</span>}
            </div>
            <p className="mt-1">{a.mensagem}</p>
            {a.justificativa && <p className="mt-1 text-xs text-[var(--muted)]">Justificativa: {a.justificativa}</p>}
            {!a.resolvidoEm && (
              <div className="mt-2 flex gap-2">
                <input
                  placeholder="justificativa"
                  value={justificativas[a.id] ?? ''}
                  onChange={(e) => setJustificativas((j) => ({ ...j, [a.id]: e.target.value }))}
                  className="flex-1 border border-[var(--line-2)] px-2 py-1 text-xs"
                />
                <Botao carregando={resolver.isPending} onClick={() => void resolverAlerta(a.id)}>
                  Resolver
                </Botao>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FormRegistrarPagamento({ solicitacaoId }: { solicitacaoId: string }) {
  const [dataPagamento, setDataPagamento] = useState('')
  const [numeroDocumentoLbs, setNumeroDocumentoLbs] = useState('')
  const [comprovante, setComprovante] = useState<File | null>(null)
  const registrar = useRegistrarPagamento()
  const { notificar } = useToast()

  async function registrarPagamento() {
    if (!dataPagamento) {
      notificar('Informe a data do pagamento.', 'erro')
      return
    }
    try {
      await registrar.mutateAsync({ id: solicitacaoId, dataPagamento, numeroDocumentoLbs: numeroDocumentoLbs || undefined, comprovante: comprovante ?? undefined })
      notificar('Pagamento registrado.')
    } catch (err) {
      notificar(mensagemDeErro(err, 'Não foi possível registrar o pagamento.'), 'erro')
    }
  }

  return (
    <div className="border border-[var(--ink)] p-4">
      <h3 className="f-display mb-3 font-bold">Registrar pagamento</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="f-mono uppercase tracking-wide text-[var(--muted)]">Data do pagamento</span>
          <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="border border-[var(--line-2)] px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="f-mono uppercase tracking-wide text-[var(--muted)]">Nº documento LBS (opcional)</span>
          <input value={numeroDocumentoLbs} onChange={(e) => setNumeroDocumentoLbs(e.target.value)} className="border border-[var(--line-2)] px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="f-mono uppercase tracking-wide text-[var(--muted)]">Comprovante (opcional)</span>
          <input type="file" accept="application/pdf" onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} className="text-sm" />
        </label>
        <Botao variante="primaria" carregando={registrar.isPending} onClick={() => void registrarPagamento()}>
          Registrar pagamento
        </Botao>
      </div>
    </div>
  )
}

function CampoCopiavel({ rotulo, valor }: { rotulo: string; valor: string }) {
  const { notificar } = useToast()
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-2 text-sm">
      <div>
        <p className="f-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">{rotulo}</p>
        <p className="font-medium">{valor || '—'}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(valor)
          notificar(`"${rotulo}" copiado.`)
        }}
        className="f-mono shrink-0 border border-[var(--line-2)] px-2 py-1 text-[10px] uppercase tracking-wide hover:border-[var(--ink)]"
      >
        Copiar
      </button>
    </div>
  )
}

function PainelAcoesAnexoV({ solicitacao }: { solicitacao: SolicitacaoDetalhe }) {
  const abrirChamado = useAbrirChamadoAnexoV()
  const { notificar } = useToast()

  if (solicitacao.status === 'APROVADO') {
    return (
      <Botao
        variante="primaria"
        carregando={abrirChamado.isPending}
        onClick={() =>
          abrirChamado.mutate(solicitacao.id, {
            onSuccess: (d) => notificar(`Chamado ${d.numeroChamado} aberto no Portal SSC.`),
            onError: (err) => notificar(mensagemDeErro(err, 'Não foi possível abrir o chamado.'), 'erro'),
          })
        }
      >
        Abrir chamado Anexo V (Portal SSC)
      </Botao>
    )
  }
  if (solicitacao.status === 'CHAMADO_ABERTO') return <FormRegistrarPagamento solicitacaoId={solicitacao.id} />
  return null
}

function PainelAcoesRcHonorarios({ solicitacao }: { solicitacao: SolicitacaoDetalhe }) {
  const criarRc = useCriarRc()
  const lancarNf = useLancarNf()
  const programarPagamento = useProgramarPagamento()
  const { notificar } = useToast()

  if (solicitacao.status === 'APROVADO') {
    return (
      <Botao
        variante="primaria"
        carregando={criarRc.isPending}
        onClick={() =>
          criarRc.mutate(solicitacao.id, {
            onSuccess: (d) => notificar(`RC ${d.numeroRc} criado no SAP.`),
            onError: (err) => notificar(mensagemDeErro(err, 'Não foi possível criar o RC.'), 'erro'),
          })
        }
      >
        Criar RC (SAP)
      </Botao>
    )
  }
  if (solicitacao.status === 'RC_CRIADO') {
    return (
      <Botao
        variante="primaria"
        carregando={lancarNf.isPending}
        onClick={() =>
          lancarNf.mutate(solicitacao.id, {
            onSuccess: (d) => notificar(`NF lançada — protocolo ${d.protocoloNf}.`),
            onError: (err) => notificar(mensagemDeErro(err, 'Não foi possível lançar a NF.'), 'erro'),
          })
        }
      >
        Lançar NF (Portal 0800)
      </Botao>
    )
  }
  if (solicitacao.status === 'NF_LANCADA') {
    return (
      <Botao
        variante="primaria"
        carregando={programarPagamento.isPending}
        onClick={() =>
          programarPagamento.mutate(solicitacao.id, {
            onSuccess: (d) => notificar(`Pagamento programado — doc. SAP ${d.numeroDocumentoSap}.`),
            onError: (err) => notificar(mensagemDeErro(err, 'Não foi possível programar o pagamento.'), 'erro'),
          })
        }
      >
        Programar pagamento (SAP)
      </Botao>
    )
  }
  if (solicitacao.status === 'PAGAMENTO_PROGRAMADO') return <FormRegistrarPagamento solicitacaoId={solicitacao.id} />
  return null
}

function PainelAcoesRbsDd({ solicitacao }: { solicitacao: SolicitacaoDetalhe }) {
  const chamado = useChamadoRbsDd(solicitacao.id, solicitacao.status === 'APROVADO')
  const enviarLbs = useEnviarLbs()
  const { notificar } = useToast()

  if (solicitacao.status === 'APROVADO') {
    return (
      <div>
        <h3 className="f-display mb-3 font-bold">Chamado RBS_DD pronto</h3>
        {chamado.isLoading && <EstadoCarregando rotulo="Montando os campos do chamado…" />}
        {chamado.data && (
          <div className="border border-[var(--ink)] p-4">
            <CampoCopiavel rotulo="Título" valor={chamado.data.titulo} />
            <CampoCopiavel rotulo="Fornecedor" valor={chamado.data.fornecedor} />
            <CampoCopiavel rotulo="Identificação do documento" valor={chamado.data.identificacaoDocumento} />
            <CampoCopiavel rotulo="Data do documento" valor={chamado.data.dataDocumento} />
            <CampoCopiavel rotulo="Data de pagamento" valor={chamado.data.dataPagamento} />
            <CampoCopiavel rotulo="Valor total" valor={formatarMoeda(chamado.data.valorTotal)} />
            <CampoCopiavel rotulo="Forma de pagamento" valor={chamado.data.formaPagamento} />
            <CampoCopiavel rotulo="Motivo da demanda" valor={chamado.data.motivoDaDemanda} />
            <CampoCopiavel rotulo="CeCu Consumidor" valor={chamado.data.ceCuConsumidor} />
            <CampoCopiavel rotulo="ZEDOA" valor={chamado.data.zedoa} />
            <CampoCopiavel rotulo="Conta contábil" valor={chamado.data.contaContabil} />
            <CampoCopiavel rotulo="Possui rateio?" valor={chamado.data.possuiRateio} />
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Botao onClick={() => void baixarArquivo(`/solicitacoes/${solicitacao.id}/rateio.xlsx`, 'rateio.xlsx')}>Baixar rateio.xlsx</Botao>
          <Botao
            variante="primaria"
            carregando={enviarLbs.isPending}
            onClick={() =>
              enviarLbs.mutate(solicitacao.id, {
                onSuccess: (d) => notificar(`Chamado ${d.numeroChamado} aberto.`),
                onError: (err) => notificar(mensagemDeErro(err, 'Não foi possível enviar ao LBS/SAP.'), 'erro'),
              })
            }
          >
            Enviar ao LBS/SAP
          </Botao>
        </div>
      </div>
    )
  }
  if (solicitacao.status === 'CHAMADO_ABERTO') return <FormRegistrarPagamento solicitacaoId={solicitacao.id} />
  return null
}

const PAINEL_POR_FAMILIA: Record<FamiliaFluxo, (props: { solicitacao: SolicitacaoDetalhe }) => React.JSX.Element | null> = {
  ANEXO_V: PainelAcoesAnexoV,
  RC_HONORARIOS: PainelAcoesRcHonorarios,
  RBS_DD: PainelAcoesRbsDd,
}

export function DetalheSolicitacao() {
  const { id } = useParams<{ id: string }>()
  const { data: solicitacao, isLoading, isError } = useSolicitacao(id)
  const aprovar = useAprovarSolicitacao()
  const devolver = useDevolverSolicitacao()
  const { notificar } = useToast()
  const [comentarioDevolucao, setComentarioDevolucao] = useState('')
  const [mostrarDevolucao, setMostrarDevolucao] = useState(false)

  if (isLoading) return <EstadoCarregando rotulo="Carregando solicitação…" />
  if (isError || !solicitacao) return <EstadoErro mensagem="Solicitação não encontrada." />

  const solicitacaoId = solicitacao.id
  const comprovante = solicitacao.anexos.find((a) => a.tipo === 'COMPROVANTE')
  const familia = familiaDoFluxo(solicitacao.tipoFluxo as Parameters<typeof familiaDoFluxo>[0])
  const PainelAcoes = PAINEL_POR_FAMILIA[familia]
  const haVermelhoAberto = solicitacao.alertas.some((a) => a.severidade === 'VERMELHO' && !a.resolvidoEm)

  async function aprovarSolicitacao() {
    try {
      await aprovar.mutateAsync(solicitacaoId)
      notificar('Solicitação aprovada.')
    } catch (err) {
      notificar(mensagemDeErro(err, 'Não foi possível aprovar.'), 'erro')
    }
  }

  async function devolverSolicitacao() {
    if (!comentarioDevolucao.trim()) {
      notificar('Informe o motivo da devolução.', 'erro')
      return
    }
    try {
      await devolver.mutateAsync({ id: solicitacaoId, comentario: comentarioDevolucao })
      notificar('Solicitação devolvida ao escritório.')
      setMostrarDevolucao(false)
      setComentarioDevolucao('')
    } catch (err) {
      notificar(mensagemDeErro(err, 'Não foi possível devolver.'), 'erro')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <TipoFluxoBadge tipoFluxo={solicitacao.tipoFluxo} />
          <h1 className="f-display mt-2 text-3xl font-bold">{formatarMoeda(solicitacao.valorTotal)}</h1>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={solicitacao.status} />
          <SemaforoBadge semaforo={solicitacao.semaforo} />
        </div>
      </div>

      <LinhaDoTempo tipoFluxo={solicitacao.tipoFluxo} status={solicitacao.status} />

      {solicitacao.status === 'EM_CONFERENCIA' && (
        <div className="mt-8 flex flex-wrap gap-2 border border-[var(--ink)] p-4">
          <Botao variante="primaria" carregando={aprovar.isPending} disabled={haVermelhoAberto} onClick={() => void aprovarSolicitacao()}>
            Aprovar
          </Botao>
          <Botao variante="perigo" onClick={() => setMostrarDevolucao((v) => !v)}>
            Devolver
          </Botao>
          {haVermelhoAberto && <p className="w-full text-xs text-[var(--bad-ink)]">Resolva os alertas vermelhos para poder aprovar.</p>}
          {mostrarDevolucao && (
            <div className="flex w-full gap-2">
              <input
                placeholder="motivo da devolução"
                value={comentarioDevolucao}
                onChange={(e) => setComentarioDevolucao(e.target.value)}
                className="flex-1 border border-[var(--line-2)] px-3 py-2 text-sm"
              />
              <Botao variante="perigo" carregando={devolver.isPending} onClick={() => void devolverSolicitacao()}>
                Confirmar devolução
              </Botao>
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <PainelAcoes solicitacao={solicitacao} />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <PainelAlertas solicitacao={solicitacao} />

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
          <h2 className="f-display mb-3 text-xl font-bold">Anexos</h2>
          {solicitacao.anexos.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nenhum anexo.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {solicitacao.anexos.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => void baixarArquivo(`/anexos/${a.id}/download`, a.nomeArquivo)}
                  className="flex items-center justify-between border border-[var(--line)] px-3 py-2 text-left text-sm hover:border-[var(--ink)]"
                >
                  <span>{a.nomeArquivo}</span>
                  <span className="f-mono text-[10px] uppercase text-[var(--muted)]">{a.tipo}</span>
                </button>
              ))}
            </div>
          )}

          <h2 className="f-display mb-3 mt-8 text-xl font-bold">Comentários</h2>
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
            <Botao className="mt-6" onClick={() => void baixarArquivo(`/anexos/${comprovante.id}/download`, comprovante.nomeArquivo)}>
              Baixar comprovante
            </Botao>
          )}
        </div>
      </div>
    </div>
  )
}
