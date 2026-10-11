import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { assincrona } from '../lib/assincrona.js'
import { ErroHttp, naoEncontrado } from '../lib/erroHttp.js'
import { prisma } from '../lib/prisma.js'
import { getStorage } from '../lib/storage/index.js'
import { uploadArquivo } from '../lib/upload.js'
import { auth, exige } from '../middleware/auth.js'
import { podeAcessarEscritorio } from '../middleware/escritorioScope.js'
import { buscarSolicitacao } from '../services/solicitacoes.js'

export const anexosRouter = Router()

const TIPOS_ANEXO_UPLOAD = ['GUIA', 'NF', 'COMPROVANTE', 'OUTRO'] as const
type TipoAnexoUpload = (typeof TIPOS_ANEXO_UPLOAD)[number]

function éTipoAnexoUpload(valor: unknown): valor is TipoAnexoUpload {
  return TIPOS_ANEXO_UPLOAD.includes(valor as TipoAnexoUpload)
}

anexosRouter.post(
  '/solicitacoes/:id/anexos',
  auth,
  exige('ESCRITORIO', 'ANALISTA'),
  uploadArquivo.single('arquivo'),
  assincrona(async (req, res) => {
    const { id } = req.params
    await buscarSolicitacao(req.usuario!, id) // 404 se não existir ou não pertencer ao escritório

    if (!éTipoAnexoUpload(req.body.tipo)) {
      throw new ErroHttp(400, { erro: `O campo "tipo" deve ser um de: ${TIPOS_ANEXO_UPLOAD.join(', ')}` })
    }
    if (!req.file) throw new ErroHttp(400, { erro: 'Arquivo é obrigatório' })

    const chave = `anexos/${id}/${randomUUID()}-${req.file.originalname}`
    await getStorage().salvar(chave, req.file.buffer, req.file.mimetype)

    const anexo = await prisma.anexo.create({
      data: { solicitacaoId: id, tipo: req.body.tipo, caminho: chave, nomeArquivo: req.file.originalname },
    })
    res.status(201).json(anexo)
  }),
)

anexosRouter.get(
  '/solicitacoes/:id/anexos',
  auth,
  assincrona(async (req, res) => {
    const { id } = req.params
    await buscarSolicitacao(req.usuario!, id) // 404 se não existir ou não pertencer ao escritório
    const anexos = await prisma.anexo.findMany({ where: { solicitacaoId: id }, orderBy: { createdAt: 'desc' } })
    res.json(anexos)
  }),
)

anexosRouter.get(
  '/anexos/:id/download',
  auth,
  assincrona(async (req, res) => {
    const anexo = await prisma.anexo.findUnique({
      where: { id: req.params.id },
      include: { solicitacao: { select: { escritorioId: true } } },
    })
    if (!anexo || !podeAcessarEscritorio(req.usuario!, anexo.solicitacao.escritorioId)) throw naoEncontrado()

    // URL assinada no GCS, caminho protegido (/arquivos/*) no storage local —
    // `obterUrl` já devolve a forma certa para cada provider (B2/B13).
    res.redirect(await getStorage().obterUrl(anexo.caminho))
  }),
)
