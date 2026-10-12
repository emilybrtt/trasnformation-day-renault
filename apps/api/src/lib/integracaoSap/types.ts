export interface ResultadoCriarRc {
  numeroRc: string
}

export interface ResultadoProgramarPagamento {
  numeroDocumentoSap: string
}

/** Fluxo RC_HONORARIOS_NF: criação do RC e programação do pagamento no SAP —
 * sempre simulado, nunca uma integração real com o SAP de verdade. */
export interface IntegracaoSAP {
  readonly nome: 'mock'
  criarRc(solicitacaoId: string): Promise<ResultadoCriarRc>
  programarPagamento(solicitacaoId: string): Promise<ResultadoProgramarPagamento>
}
