export interface ResultadoLancarNf {
  protocolo: string
}

/** Lançamento da NF no Portal 0800 (fluxo RC_HONORARIOS_NF) — sempre simulado. */
export interface IntegracaoPortal0800 {
  readonly nome: 'mock'
  lancarNf(solicitacaoId: string): Promise<ResultadoLancarNf>
}
