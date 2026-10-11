import cors from 'cors'
import express from 'express'
import { meRouter } from './routes/me.js'

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use(meRouter)

  return app
}
