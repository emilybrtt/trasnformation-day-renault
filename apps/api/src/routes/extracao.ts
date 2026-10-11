import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import { assincrona } from '../lib/assincrona.js'
import { normalizarCnpj } from '../lib/cnpj.js'
import { ErroHttp } from '../lib/erroHttp.js'
import { getLlmProvider } from '../lib/llm/index.js'
import type { DadosExtraidos, GuiaExtraida, NfExtraida } from '../lib/llm/extracao.js'
import { prisma } from '../lib/prisma.js'
import { getStorage } from '../lib/storage/index.js'
import { comTimeout, TimeoutError } from '../lib/timeout.js'
import { auth, exige } from '../middleware/auth.js'

export const extracaoRouter = Router()

const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024
const TIMEOUT_MS = 20_000

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new ErroHttp(400, { erro: 'Só são aceitos arquivos PDF' }))
      return
    }
    cb(null, true)
  },
})

function cnpjExtraido(dados: DadosExtraidos): string | undefined {
  const bruto = (dados as GuiaExtraida).beneficiarioCnpj ?? (dados as NfExtraida).cnpjPrestador
  return bruto ? normalizarCnpj(bruto) : undefined
}

extracaoRouter.post(
  '/extracao',
  auth,
  exige('ESCRITORIO', 'ANALISTA'),
  upload.single('arquivo'),
  assincrona(async (req, res) => {
    const tipo = req.body.tipo
    if (tipo !== 'GUIA' && tipo !== 'NF') {
      throw new ErroHttp(400, { erro: 'O campo "tipo" deve ser GUIA ou NF' })
    }
    if (!req.file) {
      throw new ErroHttp(400, { erro: 'Arquivo é obrigatório' })
    }

    const chave = `extracao/${randomUUID()}.pdf`
    await getStorage().salvar(chave, req.file.buffer, 'application/pdf')

    let dadosExtraidos: DadosExtraidos = {}
    let sucesso = true
    try {
      dadosExtraidos = await comTimeout(getLlmProvider().extrairDocumento(tipo, req.file.buffer), TIMEOUT_MS)
    } catch (err) {
      sucesso = false
      if (!(err instanceof TimeoutError) && !(err instanceof Error)) throw err
    }

    const cnpj = cnpjExtraido(dadosExtraidos)
    const fornecedorSugerido = cnpj ? await prisma.fornecedor.findFirst({ where: { cnpj } }) : null

    res.json({ sucesso, chave, dadosExtraidos, fornecedorSugerido })
  }),
)
