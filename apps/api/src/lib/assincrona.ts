import type { NextFunction, Request, Response } from 'express'

/** Encaminha rejeições de handlers async para o middleware de erro do Express. */
export function assincrona(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
  }
}
