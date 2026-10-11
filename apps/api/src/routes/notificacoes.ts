import { Router } from 'express'
import { assincrona } from '../lib/assincrona.js'
import { prisma } from '../lib/prisma.js'
import { auth } from '../middleware/auth.js'

export const notificacoesRouter = Router()

notificacoesRouter.get(
  '/notificacoes',
  auth,
  assincrona(async (req, res) => {
    const usuario = req.usuario!
    // ESCRITORIO só vê as próprias notificações; ANALISTA/GESTOR veem de todos
    // os escritórios (mesma regra de escopo usada nos dashboards/B12).
    const where = usuario.perfil === 'ESCRITORIO' ? { escritorioId: usuario.escritorioId ?? '__nenhum__' } : {}
    const notificacoes = await prisma.notificacao.findMany({ where, orderBy: { createdAt: 'desc' } })
    res.json(notificacoes)
  }),
)
