export interface ResultadoEnvioLbs {
  numeroChamado: string
}

export interface IntegracaoLbs {
  readonly nome: 'mock'
  enviar(solicitacaoId: string): Promise<ResultadoEnvioLbs>
}
