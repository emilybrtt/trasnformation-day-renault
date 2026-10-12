export interface ResultadoChamadoAnexoV {
  numeroChamado: string
}

/** Abertura do chamado Anexo V no portal SSC (adiantamento/baixa/reembolso) —
 * mock sempre, igual à integração RBS_DD (ver lib/integracaoLbs). */
export interface IntegracaoPortalSSC {
  readonly nome: 'mock'
  abrirChamadoAnexoV(solicitacaoId: string): Promise<ResultadoChamadoAnexoV>
}
