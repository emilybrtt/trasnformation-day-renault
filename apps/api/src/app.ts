import cors from 'cors'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { ErroHttp } from './lib/erroHttp.js'
import { alertasRouter } from './routes/alertas.js'
import { listasRouter } from './routes/listas.js'
import { meRouter } from './routes/me.js'
import { solicitacoesRouter } from './routes/solicitacoes.js'

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use(meRouter)
  app.use(listasRouter)
  app.use(solicitacoesRouter)
  app.use(alertasRouter)

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ erro: 'Dados inválidos', detalhes: err.issues })
      return
    }
    if (err instanceof ErroHttp) {
      res.status(err.status).json(err.corpo)
      return
    }
    console.error(err)
    res.status(500).json({ erro: 'Erro interno' })
  })

  return app
}
