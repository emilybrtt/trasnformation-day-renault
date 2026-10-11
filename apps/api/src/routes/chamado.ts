import { Router } from 'express'
import { assincrona } from '../lib/assincrona.js'
import { getIntegracaoLbs } from '../lib/integracaoLbs/index.js'
import { auth, exige } from '../middleware/auth.js'
import { montarChamado } from '../services/chamado.js'
import { abrirChamado, buscarSolicitacao } from '../services/solicitacoes.js'

export const chamadoRouter = Router()

chamadoRouter.get(
  '/solicitacoes/:id/chamado',
  auth,
  exige('ANALISTA'),
  assincrona(async (req, res) => {
    const chamado = await montarChamado(req.params.id)
    res.json(chamado)
  }),
)

chamadoRouter.post(
  '/integracoes/lbs/enviar/:id',
  auth,
  exige('ANALISTA'),
  assincrona(async (req, res) => {
    const id = req.params.id
    await buscarSolicitacao(req.usuario!, id) // 404 se não existir
    const { numeroChamado } = await getIntegracaoLbs().enviar(id)
    const solicitacao = await abrirChamado(req.usuario!, id, numeroChamado)
    res.json(solicitacao)
  }),
)
