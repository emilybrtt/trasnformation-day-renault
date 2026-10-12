import { z } from 'zod'

export const TIPOS_FLUXO = [
  'ANEXO_V_ADIANTAMENTO',
  'ANEXO_V_BAIXA',
  'ANEXO_V_REEMBOLSO',
  'RC_HONORARIOS_NF',
  'RBS_DD_GUIA',
] as const
export const tipoFluxoSchema = z.enum(TIPOS_FLUXO)
export type TipoFluxo = z.infer<typeof tipoFluxoSchema>

export const FORMAS_PAGAMENTO = ['BOLETO', 'TED', 'DEPOSITO_JUDICIAL'] as const
export const formaPagamentoSchema = z.enum(FORMAS_PAGAMENTO)
export type FormaPagamento = z.infer<typeof formaPagamentoSchema>

export const STATUS_SOLICITACAO = [
  'RASCUNHO',
  'ENVIADO',
  'EM_CONFERENCIA',
  'DEVOLVIDO',
  'APROVADO',
  'CHAMADO_ABERTO',
  'RC_CRIADO',
  'NF_LANCADA',
  'PAGAMENTO_PROGRAMADO',
  'PAGO',
  'CANCELADO',
] as const
export const statusSolicitacaoSchema = z.enum(STATUS_SOLICITACAO)
export type StatusSolicitacao = z.infer<typeof statusSolicitacaoSchema>

/** As 3 famílias de fluxo de pagamento (F12) — cada uma com seu próprio caminho
 * de integrações simuladas até o PAGO. O escritório escolhe isso em cards no
 * início da solicitação (o tipoFluxo específico, ex. ANEXO_V_BAIXA, já indica a
 * família). */
export const FAMILIAS_FLUXO = ['ANEXO_V', 'RC_HONORARIOS', 'RBS_DD'] as const
export type FamiliaFluxo = (typeof FAMILIAS_FLUXO)[number]

export function familiaDoFluxo(tipoFluxo: TipoFluxo): FamiliaFluxo {
  if (tipoFluxo === 'RC_HONORARIOS_NF') return 'RC_HONORARIOS'
  if (tipoFluxo === 'RBS_DD_GUIA') return 'RBS_DD'
  return 'ANEXO_V'
}

/** Documento obrigatório muda por família (F12): planilha de rateio não é bem um
 * "anexo do escritório" (é gerada pelo B8), então aqui é só o que o ESCRITÓRIO
 * precisa enviar junto com a solicitação. */
export function anexoObrigatorioDaFamilia(familia: FamiliaFluxo): 'GUIA' | 'NF' | null {
  if (familia === 'RBS_DD') return 'GUIA'
  if (familia === 'RC_HONORARIOS') return 'NF'
  return null // ANEXO_V: sem anexo obrigatório do escritório (CAMPO_OBRIGATORIO do B7 não se aplica)
}

export const AREAS = ['CONSUMIDOR', 'CÍVEL', 'REDE', 'TRABALHISTA PIF/PDV'] as const
export const MOTIVOS = [
  'CONDENAÇÃO',
  'ACORDO',
  'ACORDO PROJETO SAC',
  'PROJETO SAC',
  'CUSTAS PROCESSUAIS',
  'CONDENAÇÃO/CUSTAS',
  'MULTA',
  'DEPÓSITO JUDICIAL',
  'SEGURO GARANTIA',
  'PERÍCIA',
  'HONORÁRIOS',
  'OUTROS',
] as const

export const linhaLancamentoSchema = z.object({
  pastaProjuris: z.string().trim().min(1, 'Pasta Projuris é obrigatória'),
  area: z.string().trim().min(1, 'Área é obrigatória'),
  motivo: z.string().trim().min(1, 'Motivo é obrigatório'),
  valorPrincipal: z.number().positive('Valor principal deve ser maior que zero'),
  valorJurosCorrecao: z.number().min(0).default(0),
  valorProvisaoProjuris: z.number().min(0).optional(),
  valorTotalInformado: z.number().min(0).optional(),
  tipoAcao: z.string().trim().min(1).optional(),
})
export type LinhaLancamentoInput = z.infer<typeof linhaLancamentoSchema>

export const criarSolicitacaoSchema = z.object({
  tipoFluxo: tipoFluxoSchema,
  escritorioId: z.string().trim().min(1).optional(), // obrigatório só quando quem cria não é ESCRITORIO
  fornecedorId: z.string().trim().min(1).optional(),
  formaPagamento: formaPagamentoSchema,
  dataDocumento: z.coerce.date(),
  dataPrevistaPagamento: z.coerce.date().optional(),
  numeroDocumentoLbs: z.string().trim().min(1).optional(),
  observacao: z.string().trim().optional(),
  linhas: z.array(linhaLancamentoSchema).min(1, 'A solicitação precisa de ao menos um lançamento'),
})
export type CriarSolicitacaoInput = z.infer<typeof criarSolicitacaoSchema>

export const atualizarSolicitacaoSchema = criarSolicitacaoSchema.partial().extend({
  linhas: z.array(linhaLancamentoSchema).min(1).optional(),
})
export type AtualizarSolicitacaoInput = z.infer<typeof atualizarSolicitacaoSchema>

export const devolverSolicitacaoSchema = z.object({
  comentario: z.string().trim().min(1, 'Comentário é obrigatório para devolver'),
})

export const abrirChamadoSchema = z.object({
  numeroChamado: z.string().trim().min(1, 'Número do chamado é obrigatório'),
})

export const registrarPagamentoSchema = z.object({
  dataPagamento: z.coerce.date(),
  numeroDocumentoLbs: z.string().trim().min(1).optional(),
})

export const resolverAlertaSchema = z.object({
  justificativa: z.string().trim().min(1, 'Justificativa é obrigatória para resolver o alerta'),
})
