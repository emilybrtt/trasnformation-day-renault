import { randomUUID } from 'node:crypto'
import type { Prisma, Semaforo, StatusSolicitacao, TipoFluxo } from '@prisma/client'
import type { CriarSolicitacaoInput, LinhaLancamentoInput } from '@gavve/shared'
import { familiaDoFluxo } from '@gavve/shared'
import type { UsuarioAutenticado } from '../middleware/auth.js'
import { podeAcessarEscritorio } from '../middleware/escritorioScope.js'
import { resolverDePara } from '../lib/dePara.js'
import { ErroHttp, naoEncontrado, transicaoInvalida } from '../lib/erroHttp.js'
import { registrarHistorico } from '../lib/historico.js'
import { getIntegracaoPortal0800 } from '../lib/integracaoPortal0800/index.js'
import { getIntegracaoPortalSSC } from '../lib/integracaoPortalSSC/index.js'
import { getIntegracaoSap } from '../lib/integracaoSap/index.js'
import { criarNotificacao } from '../lib/notificacoes.js'
import { prisma } from '../lib/prisma.js'
import { piorSemaforo, semaforoDaSolicitacao } from '../lib/semaforo.js'
import { getStorage } from '../lib/storage/index.js'
import { validarEAtualizarAlertas } from './validacoes.js'

function exigirFamilia(tipoFluxo: TipoFluxo, esperada: ReturnType<typeof familiaDoFluxo>, acao: string) {
  if (familiaDoFluxo(tipoFluxo) !== esperada) {
    throw new ErroHttp(422, { erro: `"${acao}" só se aplica a solicitações do fluxo ${esperada}.` })
  }
}

async function montarLinhas(linhas: LinhaLancamentoInput[], ano: number) {
  return Promise.all(
    linhas.map(async (linha) => {
      const resolvido = await resolverDePara(linha.area, linha.motivo, ano)
      return {
        pastaProjuris: linha.pastaProjuris,
        area: linha.area,
        motivo: linha.motivo,
        valorPrincipal: linha.valorPrincipal,
        valorJurosCorrecao: linha.valorJurosCorrecao ?? 0,
        valorProvisaoProjuris: linha.valorProvisaoProjuris,
        valorTotalInformado: linha.valorTotalInformado,
        tipoAcao: linha.tipoAcao,
        centroCusto: resolvido?.centroCusto,
        contaContabil: resolvido?.contaContabil,
        ordemInterna: resolvido?.ordemInterna,
        semaforo: (resolvido ? 'VERDE' : 'VERMELHO') as Semaforo,
      }
    }),
  )
}

function somarValorTotal(linhas: { valorPrincipal: number; valorJurosCorrecao: number }[]): number {
  const total = linhas.reduce((acc, l) => acc + l.valorPrincipal + l.valorJurosCorrecao, 0)
  return Number(total.toFixed(2))
}

function resolverEscritorioId(usuario: UsuarioAutenticado, escritorioIdInformado?: string): string {
  if (usuario.perfil === 'ESCRITORIO') {
    if (!usuario.escritorioId) throw new ErroHttp(400, { erro: 'Usuário ESCRITORIO sem escritório associado' })
    return usuario.escritorioId
  }
  if (!escritorioIdInformado) throw new ErroHttp(400, { erro: 'escritorioId é obrigatório' })
  return escritorioIdInformado
}

export async function criarSolicitacao(usuario: UsuarioAutenticado, input: CriarSolicitacaoInput) {
  const escritorioId = resolverEscritorioId(usuario, input.escritorioId)
  const ano = input.dataDocumento.getFullYear()
  const linhas = await montarLinhas(input.linhas, ano)

  const solicitacao = await prisma.solicitacao.create({
    data: {
      tipoFluxo: input.tipoFluxo,
      escritorioId,
      fornecedorId: input.fornecedorId,
      criadoPorId: usuario.firebaseUid,
      status: 'RASCUNHO',
      formaPagamento: input.formaPagamento,
      dataDocumento: input.dataDocumento,
      dataPrevistaPagamento: input.dataPrevistaPagamento,
      numeroDocumentoLbs: input.numeroDocumentoLbs,
      observacao: input.observacao ?? '',
      valorTotal: somarValorTotal(linhas),
      lancamentos: { create: linhas },
    },
    include: { lancamentos: true },
  })

  await registrarHistorico({
    entidade: 'Solicitacao',
    entidadeId: solicitacao.id,
    acao: 'criar',
    usuarioId: usuario.firebaseUid,
    diff: { status: solicitacao.status },
  })

  return solicitacao
}

async function buscarOuFalhar(id: string) {
  const solicitacao = await prisma.solicitacao.findUnique({
    where: { id },
    include: { lancamentos: true, anexos: true, alertas: true, comentarios: true },
  })
  if (!solicitacao) throw naoEncontrado()
  return solicitacao
}

function garantirAcesso(usuario: UsuarioAutenticado, escritorioId: string) {
  if (!podeAcessarEscritorio(usuario, escritorioId)) throw naoEncontrado()
}

export async function buscarSolicitacao(usuario: UsuarioAutenticado, id: string) {
  const solicitacao = await buscarOuFalhar(id)
  garantirAcesso(usuario, solicitacao.escritorioId)
  const alertasDaSolicitacao = solicitacao.alertas.filter((a) => !a.lancamentoId && !a.resolvidoEm)
  return { ...solicitacao, semaforo: semaforoDaSolicitacao(solicitacao.lancamentos, alertasDaSolicitacao) }
}

export async function atualizarSolicitacao(
  usuario: UsuarioAutenticado,
  id: string,
  input: Partial<CriarSolicitacaoInput>,
) {
  const atual = await buscarOuFalhar(id)
  garantirAcesso(usuario, atual.escritorioId)
  if (atual.status !== 'RASCUNHO' && atual.status !== 'DEVOLVIDO') {
    throw transicaoInvalida(atual.status, 'edição')
  }

  const dataDocumento = input.dataDocumento ?? atual.dataDocumento
  const ano = dataDocumento.getFullYear()
  const linhas = input.linhas ? await montarLinhas(input.linhas, ano) : undefined

  const solicitacao = await prisma.$transaction(async (tx) => {
    if (linhas) {
      await tx.lancamento.deleteMany({ where: { solicitacaoId: id } })
    }
    return tx.solicitacao.update({
      where: { id },
      data: {
        tipoFluxo: input.tipoFluxo,
        fornecedorId: input.fornecedorId,
        formaPagamento: input.formaPagamento,
        dataDocumento: input.dataDocumento,
        dataPrevistaPagamento: input.dataPrevistaPagamento,
        numeroDocumentoLbs: input.numeroDocumentoLbs,
        observacao: input.observacao,
        valorTotal: linhas ? somarValorTotal(linhas) : undefined,
        lancamentos: linhas ? { create: linhas } : undefined,
      },
      include: { lancamentos: true },
    })
  })

  await registrarHistorico({
    entidade: 'Solicitacao',
    entidadeId: id,
    acao: 'atualizar',
    usuarioId: usuario.firebaseUid,
    diff: { camposAlterados: Object.keys(input) },
  })

  return solicitacao
}

export interface FiltrosListagem {
  status?: StatusSolicitacao
  escritorioId?: string
  tipoFluxo?: TipoFluxo
  pasta?: string
  semaforo?: Semaforo
  page?: number
  pageSize?: number
}

export async function listarSolicitacoes(usuario: UsuarioAutenticado, filtros: FiltrosListagem) {
  const page = Math.max(1, filtros.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filtros.pageSize ?? 20))

  const where: Prisma.SolicitacaoWhereInput = {}
  if (usuario.perfil === 'ESCRITORIO') {
    where.escritorioId = usuario.escritorioId ?? '__nenhum__'
  } else if (filtros.escritorioId) {
    where.escritorioId = filtros.escritorioId
  }
  if (filtros.status) where.status = filtros.status
  if (filtros.tipoFluxo) where.tipoFluxo = filtros.tipoFluxo
  if (filtros.pasta) where.lancamentos = { some: { pastaProjuris: { contains: filtros.pasta } } }

  const todos = await prisma.solicitacao.findMany({
    where,
    include: {
      lancamentos: { select: { semaforo: true } },
      alertas: { where: { lancamentoId: null, resolvidoEm: null }, select: { severidade: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const comSemaforo = todos.map((s) => ({
    ...s,
    semaforo: semaforoDaSolicitacao(s.lancamentos, s.alertas),
  }))
  const filtrados = filtros.semaforo ? comSemaforo.filter((s) => s.semaforo === filtros.semaforo) : comSemaforo

  const total = filtrados.length
  const items = filtrados.slice((page - 1) * pageSize, page * pageSize)
  return { items, total, page, pageSize }
}

export async function enviarSolicitacao(usuario: UsuarioAutenticado, id: string) {
  const atual = await buscarOuFalhar(id)
  garantirAcesso(usuario, atual.escritorioId)
  if (atual.status !== 'RASCUNHO' && atual.status !== 'DEVOLVIDO') {
    throw transicaoInvalida(atual.status, 'EM_CONFERENCIA')
  }

  const solicitacao = await prisma.solicitacao.update({ where: { id }, data: { status: 'EM_CONFERENCIA' } })
  const alertas = await validarEAtualizarAlertas(id)
  await registrarHistorico({
    entidade: 'Solicitacao',
    entidadeId: id,
    acao: 'enviar',
    usuarioId: usuario.firebaseUid,
    diff: { status: { de: atual.status, para: 'EM_CONFERENCIA' }, alertas: alertas.map((a) => a.codigo) },
  })
  return solicitacao
}

export async function aprovarSolicitacao(usuario: UsuarioAutenticado, id: string) {
  const atual = await buscarOuFalhar(id)
  if (atual.status !== 'EM_CONFERENCIA') throw transicaoInvalida(atual.status, 'APROVADO')

  const vermelhoAberto =
    atual.alertas.some((a) => a.severidade === 'VERMELHO' && !a.resolvidoEm) ||
    atual.lancamentos.some((l) => l.semaforo === 'VERMELHO')
  if (vermelhoAberto) {
    throw new ErroHttp(422, { erro: 'Existem alertas vermelhos não resolvidos nesta solicitação' })
  }

  const solicitacao = await prisma.solicitacao.update({ where: { id }, data: { status: 'APROVADO' } })
  await registrarHistorico({
    entidade: 'Solicitacao',
    entidadeId: id,
    acao: 'aprovar',
    usuarioId: usuario.firebaseUid,
    diff: { status: { de: atual.status, para: 'APROVADO' } },
  })
  return solicitacao
}

export async function devolverSolicitacao(usuario: UsuarioAutenticado, id: string, comentario: string) {
  const atual = await buscarOuFalhar(id)
  if (atual.status !== 'EM_CONFERENCIA') throw transicaoInvalida(atual.status, 'DEVOLVIDO')

  const [solicitacao] = await prisma.$transaction([
    prisma.solicitacao.update({ where: { id }, data: { status: 'DEVOLVIDO' } }),
    prisma.comentario.create({ data: { solicitacaoId: id, autorId: usuario.firebaseUid, texto: comentario } }),
  ])
  await registrarHistorico({
    entidade: 'Solicitacao',
    entidadeId: id,
    acao: 'devolver',
    usuarioId: usuario.firebaseUid,
    diff: { status: { de: atual.status, para: 'DEVOLVIDO' }, comentario },
  })
  return solicitacao
}

export async function abrirChamado(usuario: UsuarioAutenticado, id: string, numeroChamado: string) {
  const atual = await buscarOuFalhar(id)
  exigirFamilia(atual.tipoFluxo, 'RBS_DD', 'abrir chamado RBS_DD')
  if (atual.status !== 'APROVADO') throw transicaoInvalida(atual.status, 'CHAMADO_ABERTO')

  const solicitacao = await prisma.solicitacao.update({
    where: { id },
    data: { status: 'CHAMADO_ABERTO', numeroChamado },
  })
  await registrarHistorico({
    entidade: 'Solicitacao',
    entidadeId: id,
    acao: 'abrir-chamado',
    usuarioId: usuario.firebaseUid,
    diff: { status: { de: atual.status, para: 'CHAMADO_ABERTO' }, numeroChamado },
  })
  return solicitacao
}

/** Fluxo ANEXO_V (adiantamento/baixa/reembolso): abre o chamado no portal SSC via
 * IntegracaoPortalSSC (mock) — paralelo ao abrirChamado do RBS_DD, mas com a
 * integração/terminologia própria do Anexo V (F12). */
export async function abrirChamadoAnexoV(usuario: UsuarioAutenticado, id: string) {
  const atual = await buscarOuFalhar(id)
  exigirFamilia(atual.tipoFluxo, 'ANEXO_V', 'abrir chamado Anexo V')
  if (atual.status !== 'APROVADO') throw transicaoInvalida(atual.status, 'CHAMADO_ABERTO')

  const { numeroChamado } = await getIntegracaoPortalSSC().abrirChamadoAnexoV(id)
  const solicitacao = await prisma.solicitacao.update({
    where: { id },
    data: { status: 'CHAMADO_ABERTO', numeroChamado },
  })
  await registrarHistorico({
    entidade: 'Solicitacao',
    entidadeId: id,
    acao: 'abrir-chamado-anexo-v',
    usuarioId: usuario.firebaseUid,
    diff: { status: { de: atual.status, para: 'CHAMADO_ABERTO' }, numeroChamado },
  })
  return solicitacao
}

/** Fluxo RC_HONORARIOS_NF, passo 1/3: cria o RC no SAP (mock). */
export async function criarRc(usuario: UsuarioAutenticado, id: string) {
  const atual = await buscarOuFalhar(id)
  exigirFamilia(atual.tipoFluxo, 'RC_HONORARIOS', 'criar RC')
  if (atual.status !== 'APROVADO') throw transicaoInvalida(atual.status, 'RC_CRIADO')

  const { numeroRc } = await getIntegracaoSap().criarRc(id)
  const solicitacao = await prisma.solicitacao.update({ where: { id }, data: { status: 'RC_CRIADO', numeroRc } })
  await registrarHistorico({
    entidade: 'Solicitacao',
    entidadeId: id,
    acao: 'criar-rc',
    usuarioId: usuario.firebaseUid,
    diff: { status: { de: atual.status, para: 'RC_CRIADO' }, numeroRc },
  })
  return solicitacao
}

/** Fluxo RC_HONORARIOS_NF, passo 2/3: lança a NF no Portal 0800 (mock). */
export async function lancarNf(usuario: UsuarioAutenticado, id: string) {
  const atual = await buscarOuFalhar(id)
  exigirFamilia(atual.tipoFluxo, 'RC_HONORARIOS', 'lançar NF')
  if (atual.status !== 'RC_CRIADO') throw transicaoInvalida(atual.status, 'NF_LANCADA')

  const { protocolo } = await getIntegracaoPortal0800().lancarNf(id)
  const solicitacao = await prisma.solicitacao.update({ where: { id }, data: { status: 'NF_LANCADA', protocoloNf: protocolo } })
  await registrarHistorico({
    entidade: 'Solicitacao',
    entidadeId: id,
    acao: 'lancar-nf',
    usuarioId: usuario.firebaseUid,
    diff: { status: { de: atual.status, para: 'NF_LANCADA' }, protocolo },
  })
  return solicitacao
}

/** Fluxo RC_HONORARIOS_NF, passo 3/3: programa o pagamento no SAP (mock). */
export async function programarPagamento(usuario: UsuarioAutenticado, id: string) {
  const atual = await buscarOuFalhar(id)
  exigirFamilia(atual.tipoFluxo, 'RC_HONORARIOS', 'programar pagamento')
  if (atual.status !== 'NF_LANCADA') throw transicaoInvalida(atual.status, 'PAGAMENTO_PROGRAMADO')

  const { numeroDocumentoSap } = await getIntegracaoSap().programarPagamento(id)
  const solicitacao = await prisma.solicitacao.update({
    where: { id },
    data: { status: 'PAGAMENTO_PROGRAMADO', numeroDocumentoSap },
  })
  await registrarHistorico({
    entidade: 'Solicitacao',
    entidadeId: id,
    acao: 'programar-pagamento',
    usuarioId: usuario.firebaseUid,
    diff: { status: { de: atual.status, para: 'PAGAMENTO_PROGRAMADO' }, numeroDocumentoSap },
  })
  return solicitacao
}

const STATUS_PRECURSORES_PAGAMENTO: StatusSolicitacao[] = ['CHAMADO_ABERTO', 'PAGAMENTO_PROGRAMADO']

export interface ComprovanteUpload {
  buffer: Buffer
  nomeArquivo: string
  mimetype: string
}

export async function registrarPagamento(
  usuario: UsuarioAutenticado,
  id: string,
  dados: { dataPagamento: Date; numeroDocumentoLbs?: string },
  comprovante?: ComprovanteUpload,
) {
  const atual = await buscarOuFalhar(id)
  if (!STATUS_PRECURSORES_PAGAMENTO.includes(atual.status)) throw transicaoInvalida(atual.status, 'PAGO')

  const solicitacao = await prisma.solicitacao.update({
    where: { id },
    data: {
      status: 'PAGO',
      dataPagamento: dados.dataPagamento,
      numeroDocumentoLbs: dados.numeroDocumentoLbs ?? atual.numeroDocumentoLbs,
    },
  })

  if (comprovante) {
    const chave = `anexos/${id}/${randomUUID()}-${comprovante.nomeArquivo}`
    await getStorage().salvar(chave, comprovante.buffer, comprovante.mimetype)
    await prisma.anexo.create({
      data: { solicitacaoId: id, tipo: 'COMPROVANTE', caminho: chave, nomeArquivo: comprovante.nomeArquivo },
    })
    await criarNotificacao({
      escritorioId: atual.escritorioId,
      solicitacaoId: id,
      mensagem: `Comprovante de pagamento anexado à sua solicitação (pasta(s) ${atual.lancamentos.map((l) => l.pastaProjuris).join(', ')}).`,
    })
  }

  await registrarHistorico({
    entidade: 'Solicitacao',
    entidadeId: id,
    acao: 'registrar-pagamento',
    usuarioId: usuario.firebaseUid,
    diff: {
      status: { de: atual.status, para: 'PAGO' },
      dataPagamento: dados.dataPagamento.toISOString(),
      comComprovante: Boolean(comprovante),
    },
  })
  return solicitacao
}

export async function resolverAlerta(usuario: UsuarioAutenticado, alertaId: string, justificativa: string) {
  const alerta = await prisma.alerta.findUnique({ where: { id: alertaId } })
  if (!alerta) throw naoEncontrado()

  const atualizado = await prisma.alerta.update({
    where: { id: alertaId },
    data: { resolvidoPorId: usuario.firebaseUid, resolvidoEm: new Date(), justificativa },
  })

  if (alerta.lancamentoId) {
    const abertos = await prisma.alerta.findMany({
      where: { lancamentoId: alerta.lancamentoId, resolvidoEm: null, id: { not: alertaId } },
    })
    const semaforo = piorSemaforo(abertos.map((a) => a.severidade))
    await prisma.lancamento.update({ where: { id: alerta.lancamentoId }, data: { semaforo } })
  }

  await registrarHistorico({
    entidade: 'Alerta',
    entidadeId: alertaId,
    acao: 'resolver',
    usuarioId: usuario.firebaseUid,
    diff: { justificativa },
  })

  return atualizado
}
