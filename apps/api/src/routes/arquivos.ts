import { Router } from 'express'
import { assincrona } from '../lib/assincrona.js'
import { inferirContentType } from '../lib/contentType.js'
import { naoEncontrado } from '../lib/erroHttp.js'
import { getStorage } from '../lib/storage/index.js'
import { auth } from '../middleware/auth.js'

export const arquivosRouter = Router()

// Serve os arquivos salvos no storage local — é a rota que o B2 deixou como
// placeholder em `LocalDiskStorage.obterUrl` ("/arquivos/<chave>"). Autenticada,
// mas sem checar o escritório do dono do arquivo: a chave (sempre com um
// cuid/uuid) é a própria "credencial", igual a uma signed URL do GCS — quem já
// recebeu a chave (via `/anexos/:id/download`, que aí sim checa o escritório)
// pode acessá-la diretamente.
arquivosRouter.get(
  '/arquivos/*',
  auth,
  assincrona(async (req, res) => {
    const chave = req.params[0]
    let conteudo: Buffer
    try {
      conteudo = await getStorage().ler(chave)
    } catch {
      throw naoEncontrado()
    }
    res.setHeader('Content-Type', inferirContentType(chave))
    res.send(conteudo)
  }),
)
