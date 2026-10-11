import { resolverAlertaSchema } from '@gavve/shared'
import { Router } from 'express'
import { assincrona } from '../lib/assincrona.js'
import { auth, exige } from '../middleware/auth.js'
import { resolverAlerta } from '../services/solicitacoes.js'

export const alertasRouter = Router()

alertasRouter.post(
  '/alertas/:id/resolver',
  auth,
  exige('ANALISTA'),
  assincrona(async (req, res) => {
    const { justificativa } = resolverAlertaSchema.parse(req.body)
    const alerta = await resolverAlerta(req.usuario!, req.params.id, justificativa)
    res.json(alerta)
  }),
)
