import multer from 'multer'
import { ErroHttp } from './erroHttp.js'

const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024
const TIPOS_ACEITOS = new Set(['application/pdf', 'image/png', 'image/jpeg'])

/** Multer compartilhado pelas rotas de anexo (B13: upload de anexo e comprovante
 * de pagamento) — guias/NFs são PDF, comprovantes às vezes são print/foto. */
export const uploadArquivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_ACEITOS.has(file.mimetype)) {
      cb(new ErroHttp(400, { erro: 'Tipo de arquivo não aceito (use PDF, PNG ou JPEG)' }))
      return
    }
    cb(null, true)
  },
})
