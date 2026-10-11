import type { Perfil } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import { firebaseAuth } from '../lib/firebaseAdmin.js'
import { prisma } from '../lib/prisma.js'

export interface UsuarioAutenticado {
  firebaseUid: string
  nome: string
  email: string
  perfil: Perfil
  escritorioId: string | null
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado
    }
  }
}

function extrairToken(req: Request): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

/** Verifica o ID token do Firebase e carrega o Usuario correspondente em req.usuario. */
export async function auth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extrairToken(req)
  if (!token) {
    res.status(401).json({ erro: 'Token de autenticação ausente' })
    return
  }

  let uid: string
  try {
    const decoded = await firebaseAuth().verifyIdToken(token)
    uid = decoded.uid
  } catch {
    res.status(401).json({ erro: 'Token de autenticação inválido' })
    return
  }

  const usuario = await prisma.usuario.findUnique({ where: { firebaseUid: uid } })
  if (!usuario) {
    res.status(401).json({ erro: 'Usuário não cadastrado' })
    return
  }

  req.usuario = usuario
  next()
}

/** Restringe a rota aos perfis informados. Use depois de `auth`. */
export function exige(...perfis: Perfil[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      res.status(403).json({ erro: 'Acesso não permitido para este perfil' })
      return
    }
    next()
  }
}
