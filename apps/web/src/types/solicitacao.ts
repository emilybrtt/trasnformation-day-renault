export type Semaforo = 'VERDE' | 'AMARELO' | 'VERMELHO'

export interface Lancamento {
  id: string
  pastaProjuris: string
  area: string
  motivo: string
  valorPrincipal: string
  valorJurosCorrecao: string
  centroCusto: string | null
  contaContabil: string | null
  ordemInterna: string | null
  semaforo: Semaforo
}

export interface Alerta {
  id: string
  lancamentoId: string | null
  codigo: string
  severidade: 'AMARELO' | 'VERMELHO'
  mensagem: string
  resolvidoEm: string | null
  justificativa: string | null
}

export interface Comentario {
  id: string
  autorId: string
  texto: string
  createdAt: string
}

export interface Anexo {
  id: string
  tipo: string
  nomeArquivo: string
  createdAt: string
}

export interface SolicitacaoResumo {
  id: string
  tipoFluxo: string
  status: string
  valorTotal: string
  dataDocumento: string
  dataPagamento: string | null
  escritorioId: string
  numeroChamado: string | null
  numeroRc: string | null
  protocoloNf: string | null
  numeroDocumentoSap: string | null
  semaforo: Semaforo
  createdAt: string
}

export interface SolicitacaoDetalhe extends SolicitacaoResumo {
  observacao: string | null
  numeroDocumentoLbs: string | null
  dataPrevistaPagamento: string | null
  lancamentos: Lancamento[]
  alertas: Alerta[]
  comentarios: Comentario[]
  anexos: Anexo[]
}

export interface ChamadoRbsDd {
  empresaAprovadora: string
  empresaConsumidora: string
  fornecedor: string
  nomeSolicitante: string
  identificacaoDocumento: string
  dataDocumento: string
  dataPagamento: string
  moeda: string
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

export interface Notificacao {
  id: string
  escritorioId: string
  solicitacaoId: string | null
  mensagem: string
  lida: boolean
  createdAt: string
}

export interface ListaSolicitacoes {
  items: SolicitacaoResumo[]
  total: number
  page: number
  pageSize: number
}

export interface DeParaLinha {
  id: string
  area: string
  motivo: string
  centroCusto: string
  contaContabil: string
  ordemInterna: string | null
  ano: number
}

export interface Fornecedor {
  id: string
  codigoSap: string
  nome: string
  cnpj: string
}
