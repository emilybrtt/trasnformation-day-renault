import { z } from 'zod'

export const mensagemAgenteHistoricoSchema = z.object({
  papel: z.enum(['usuario', 'assistente']),
  texto: z.string().trim().min(1),
})
export type MensagemAgenteHistorico = z.infer<typeof mensagemAgenteHistoricoSchema>

export const enviarMensagemAgenteSchema = z.object({
  mensagem: z.string().trim().min(1, 'Mensagem é obrigatória'),
  // O cliente pode mandar uma conversa mais longa; o servidor só considera as
  // últimas 6 mensagens (regra do card B11) — por isso o limite aqui é só uma
  // salvaguarda contra payloads abusivos, bem maior que 6.
  historico: z.array(mensagemAgenteHistoricoSchema).max(50).optional(),
})
export type EnviarMensagemAgenteInput = z.infer<typeof enviarMensagemAgenteSchema>

export const visualAgenteSchema = z.object({
  tipo: z.enum(['barra', 'linha', 'tabela']),
  dados: z.unknown(),
})

export const respostaAgenteSchema = z.object({
  texto: z.string(),
  visual: visualAgenteSchema.optional(),
})
export type RespostaAgente = z.infer<typeof respostaAgenteSchema>
