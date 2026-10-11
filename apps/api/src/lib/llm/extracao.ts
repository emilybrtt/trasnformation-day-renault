export type TipoDocumentoExtracao = 'GUIA' | 'NF'

export interface GuiaExtraida {
  beneficiarioNome?: string
  beneficiarioCnpj?: string
  numeroProcesso?: string
  nossoNumero?: string
  numeroDocumento?: string
  dataDocumento?: string
  dataVencimento?: string
  valor?: number
  linhaDigitavel?: string
}

export interface NfExtraida {
  numeroNf?: string
  cnpjPrestador?: string
  nomePrestador?: string
  dataEmissao?: string
  valorServico?: number
  valorLiquido?: number
  descricao?: string
}

export type DadosExtraidos = GuiaExtraida | NfExtraida
