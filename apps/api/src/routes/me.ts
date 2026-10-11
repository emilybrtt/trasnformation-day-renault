import { Router } from 'express'
import { auth } from '../middleware/auth.js'

export const meRouter = Router()

meRouter.get('/me', auth, (req, res) => {
  const { firebaseUid, nome, email, perfil, escritorioId } = req.usuario!
  res.json({ firebaseUid, nome, email, perfil, escritorioId })
})
