import { ErroHttp, naoEncontrado } from '../lib/erroHttp.js'
import { prisma } from '../lib/prisma.js'

export interface ChamadoRbsDd {
  empresaAprovadora: string
  empresaConsumidora: string
  fornecedor: string
  nomeSolicitante: string
  identificacaoDocumento: string
  dataDocumento: string
  dataPagamento: string
  moeda: 'BRL'
  valorTotal: number
  formaPagamento: string
  motivoDaDemanda: string
  naturezaDeGasto: string
  observacao: string
  classificacao: string
  descricao: string
  alocacao: string
  ceCuAprovador: string
  ceCuConsumidor: string
  zedoa: string
  contaContabil: string
  possuiRateio: 'Sim' | 'Não'
  titulo: string
}

const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  BOLETO: 'Boleto',
  TED: 'Transferência bancária',
  DEPOSITO_JUDICIAL: 'Depósito Judicial',
}

function formatarDataBr(data: Date): string {
  const dd = String(data.getUTCDate()).padStart(2, '0')
  const mm = String(data.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${data.getUTCFullYear()}`
}

/** Monta o JSON com os campos do chamado RBS_DD, na ordem da tela do portal SSC
 * (ver CONTEXT.md). Os campos fixos vêm de `ConfiguracaoChamado` (B4); os demais são
 * calculados a partir da solicitação e do(s) seu(s) lançamento(s). */
export async function montarChamado(solicitacaoId: string): Promise<ChamadoRbsDd> {
  const solicitacao = await prisma.solicitacao.findUnique({
    where: { id: solicitacaoId },
    include: { lancamentos: true, fornecedor: true },
  })
  if (!solicitacao) throw naoEncontrado()

  const config = await prisma.configuracaoChamado.findFirst({ where: { ativo: true } })
  if (!config) {
    throw new ErroHttp(422, { erro: 'Nenhuma configuração de chamado ativa (ConfiguracaoChamado) cadastrada.' })
  }

  const principal = solicitacao.lancamentos[0]
  const motivos = [...new Set(solicitacao.lancamentos.map((l) => l.motivo))]
  const possuiRateio = solicitacao.lancamentos.some((l) => Number(l.valorJurosCorrecao) > 0)
  const dataPagamentoRef = solicitacao.dataPagamento ?? solicitacao.dataPrevistaPagamento ?? solicitacao.dataDocumento

  return {
    empresaAprovadora: config.empresaAprovadora,
    empresaConsumidora: config.empresaConsumidora,
    fornecedor: solicitacao.fornecedor
      ? `${solicitacao.fornecedor.codigoSap} – ${solicitacao.fornecedor.nome} – ${solicitacao.fornecedor.cnpj}`
      : '',
    nomeSolicitante: config.nomeSolicitante,
    identificacaoDocumento: solicitacao.numeroDocumentoLbs ?? '',
    dataDocumento: formatarDataBr(solicitacao.dataDocumento),
    dataPagamento: formatarDataBr(dataPagamentoRef),
    moeda: 'BRL',
    valorTotal: Number(solicitacao.valorTotal),
    formaPagamento: FORMA_PAGAMENTO_LABEL[solicitacao.formaPagamento] ?? solicitacao.formaPagamento,
    motivoDaDemanda: motivos.join(', '),
    naturezaDeGasto: config.naturezaGasto,
    observacao: solicitacao.observacao ?? '',
    classificacao: config.classificacao,
    descricao: solicitacao.observacao?.trim() || motivos.join(', '),
    alocacao: config.alocacao,
    ceCuAprovador: config.ceCuAprovador,
    ceCuConsumidor: principal?.centroCusto ?? '',
    zedoa: principal?.ordemInterna ?? '',
    contaContabil: principal?.contaContabil ?? '',
    possuiRateio: possuiRateio ? 'Sim' : 'Não',
    titulo: `${motivos[0] ?? ''} ${formatarDataBr(dataPagamentoRef).slice(0, 5)}`.trim(),
  }
}
