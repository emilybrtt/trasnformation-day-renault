import {
  abrirChamadoSchema,
  atualizarSolicitacaoSchema,
  criarSolicitacaoSchema,
  devolverSolicitacaoSchema,
  registrarPagamentoSchema,
} from '@gavve/shared'
import type { Semaforo, StatusSolicitacao, TipoFluxo } from '@prisma/client'
import { Router } from 'express'
import { assincrona } from '../lib/assincrona.js'
import { getStorage } from '../lib/storage/index.js'
import { uploadArquivo } from '../lib/upload.js'
import { auth, exige } from '../middleware/auth.js'
import { gerarRateioXlsx } from '../services/rateio.js'
import * as servico from '../services/solicitacoes.js'
import { prisma } from '../lib/prisma.js'

export const solicitacoesRouter = Router()

solicitacoesRouter.post(
  '/solicitacoes',
  auth,
  exige('ESCRITORIO', 'ANALISTA'),
  assincrona(async (req, res) => {
    const input = criarSolicitacaoSchema.parse(req.body)
    const solicitacao = await servico.criarSolicitacao(req.usuario!, input)
    res.status(201).json(solicitacao)
  }),
)

solicitacoesRouter.get(
  '/solicitacoes',
  auth,
  assincrona(async (req, res) => {
    const q = req.query as Record<string, string | undefined>
    const resultado = await servico.listarSolicitacoes(req.usuario!, {
      status: q.status as StatusSolicitacao | undefined,
      escritorioId: q.escritorio,
      tipoFluxo: q.tipo as TipoFluxo | undefined,
      pasta: q.pasta,
      semaforo: q.semaforo as Semaforo | undefined,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    })
    res.json(resultado)
  }),
)

solicitacoesRouter.get(
  '/solicitacoes/:id',
  auth,
  assincrona(async (req, res) => {
    const solicitacao = await servico.buscarSolicitacao(req.usuario!, req.params.id)
    res.json(solicitacao)
  }),
)

solicitacoesRouter.patch(
  '/solicitacoes/:id',
  auth,
  exige('ESCRITORIO', 'ANALISTA'),
  assincrona(async (req, res) => {
    const input = atualizarSolicitacaoSchema.parse(req.body)
    const solicitacao = await servico.atualizarSolicitacao(req.usuario!, req.params.id, input)
    res.json(solicitacao)
  }),
)

solicitacoesRouter.post(
  '/solicitacoes/:id/enviar',
  auth,
  exige('ESCRITORIO', 'ANALISTA'),
  assincrona(async (req, res) => {
    const solicitacao = await servico.enviarSolicitacao(req.usuario!, req.params.id)
    res.json(solicitacao)
  }),
)

solicitacoesRouter.post(
  '/solicitacoes/:id/aprovar',
  auth,
  exige('ANALISTA'),
  assincrona(async (req, res) => {
    const solicitacao = await servico.aprovarSolicitacao(req.usuario!, req.params.id)
    res.json(solicitacao)
  }),
)

solicitacoesRouter.post(
  '/solicitacoes/:id/devolver',
  auth,
  exige('ANALISTA'),
  assincrona(async (req, res) => {
    const { comentario } = devolverSolicitacaoSchema.parse(req.body)
    const solicitacao = await servico.devolverSolicitacao(req.usuario!, req.params.id, comentario)
    res.json(solicitacao)
  }),
)

solicitacoesRouter.post(
  '/solicitacoes/:id/chamado',
  auth,
  exige('ANALISTA'),
  assincrona(async (req, res) => {
    const { numeroChamado } = abrirChamadoSchema.parse(req.body)
    const solicitacao = await servico.abrirChamado(req.usuario!, req.params.id, numeroChamado)
    res.json(solicitacao)
  }),
)

solicitacoesRouter.post(
  '/solicitacoes/:id/pagamento',
  auth,
  exige('ANALISTA'),
  // Multipart opcional: o comprovante (B13) pode vir junto ou a solicitação pode
  // ser paga sem ele (multer não altera req.body quando o request não é multipart).
  uploadArquivo.single('comprovante'),
  assincrona(async (req, res) => {
    const dados = registrarPagamentoSchema.parse(req.body)
    const comprovante = req.file
      ? { buffer: req.file.buffer, nomeArquivo: req.file.originalname, mimetype: req.file.mimetype }
      : undefined
    const solicitacao = await servico.registrarPagamento(req.usuario!, req.params.id, dados, comprovante)
    res.json(solicitacao)
  }),
)

solicitacoesRouter.post(
  '/solicitacoes/:id/chamado-anexo-v',
  auth,
  exige('ANALISTA'),
  assincrona(async (req, res) => {
    const solicitacao = await servico.abrirChamadoAnexoV(req.usuario!, req.params.id)
    res.json(solicitacao)
  }),
)

solicitacoesRouter.post(
  '/solicitacoes/:id/rc',
  auth,
  exige('ANALISTA'),
  assincrona(async (req, res) => {
    const solicitacao = await servico.criarRc(req.usuario!, req.params.id)
    res.json(solicitacao)
  }),
)

solicitacoesRouter.post(
  '/solicitacoes/:id/nf-0800',
  auth,
  exige('ANALISTA'),
  assincrona(async (req, res) => {
    const solicitacao = await servico.lancarNf(req.usuario!, req.params.id)
    res.json(solicitacao)
  }),
)

solicitacoesRouter.post(
  '/solicitacoes/:id/programar-pagamento',
  auth,
  exige('ANALISTA'),
  assincrona(async (req, res) => {
    const solicitacao = await servico.programarPagamento(req.usuario!, req.params.id)
    res.json(solicitacao)
  }),
)

solicitacoesRouter.get(
  '/solicitacoes/:id/rateio.xlsx',
  auth,
  exige('ANALISTA'),
  assincrona(async (req, res) => {
    const id = req.params.id
    await servico.buscarSolicitacao(req.usuario!, id) // 404 se não existir
    const buffer = await gerarRateioXlsx(id)

    const chave = `rateio/${id}.xlsx`
    await getStorage().salvar(chave, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    await prisma.anexo.deleteMany({ where: { solicitacaoId: id, tipo: 'RATEIO_XLSX' } })
    await prisma.anexo.create({
      data: { solicitacaoId: id, tipo: 'RATEIO_XLSX', caminho: chave, nomeArquivo: 'rateio.xlsx' },
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="rateio.xlsx"')
    res.send(buffer)
  }),
)
