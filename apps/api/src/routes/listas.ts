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
