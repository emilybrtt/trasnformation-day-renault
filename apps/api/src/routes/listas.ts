import { AREAS, FORMAS_PAGAMENTO, MOTIVOS, STATUS_SOLICITACAO, TIPOS_FLUXO } from '@gavve/shared'
import { Router } from 'express'
import { assincrona } from '../lib/assincrona.js'
import { prisma } from '../lib/prisma.js'
import { auth } from '../middleware/auth.js'

export const listasRouter = Router()

listasRouter.get('/listas', auth, (_req, res) => {
  res.json({
    areas: AREAS,
    motivos: MOTIVOS,
    tiposFluxo: TIPOS_FLUXO,
    formasPagamento: FORMAS_PAGAMENTO,
    statusSolicitacao: STATUS_SOLICITACAO,
  })
})

listasRouter.get(
  '/de-para',
  auth,
  assincrona(async (req, res) => {
    const { area, motivo } = req.query as { area?: string; motivo?: string }
    const linhas = await prisma.deParaContabil.findMany({
      where: { ativo: true, ...(area ? { area } : {}), ...(motivo ? { motivo } : {}) },
      orderBy: [{ ano: 'desc' }, { area: 'asc' }, { motivo: 'asc' }],
    })
    res.json(linhas)
  }),
)

// Lista de referência para o autocomplete de fornecedor no front (F9) — só
// leitura, mesmo espírito de /listas e /de-para.
listasRouter.get(
  '/fornecedores',
  auth,
  assincrona(async (req, res) => {
    const busca = (req.query.busca as string | undefined)?.trim()
    const fornecedores = await prisma.fornecedor.findMany({
      where: busca ? { nome: { contains: busca, mode: 'insensitive' } } : undefined,
      orderBy: { nome: 'asc' },
      take: 20,
    })
    res.json(fornecedores)
  }),
)
