import type { Prisma, StatusSolicitacao } from '@prisma/client'
import ExcelJS from 'exceljs'
import { prisma } from '../lib/prisma.js'

export interface FiltrosDashboard {
  de?: Date
  ate?: Date
  area?: string
  motivo?: string
  escritorioId?: string
}

function filtroDataPagamento(filtros: FiltrosDashboard): Prisma.DateTimeFilter | undefined {
  if (!filtros.de && !filtros.ate) return undefined
  const filtro: Prisma.DateTimeFilter = {}
  if (filtros.de) filtro.gte = filtros.de
  if (filtros.ate) filtro.lte = filtros.ate
  return filtro
}

function filtroLancamentos(filtros: FiltrosDashboard): Prisma.LancamentoListRelationFilter | undefined {
  if (!filtros.area && !filtros.motivo) return undefined
  return { some: { area: filtros.area, motivo: filtros.motivo } }
}

/** "Realizado" = status PAGO, pela dataPagamento (regra do briefing). */
function whereSolicitacaoRealizada(filtros: FiltrosDashboard): Prisma.SolicitacaoWhereInput {
  return {
    status: 'PAGO',
    escritorioId: filtros.escritorioId,
    dataPagamento: filtroDataPagamento(filtros),
    lancamentos: filtroLancamentos(filtros),
  }
}

async function solicitacoesRealizadas(filtros: FiltrosDashboard) {
  return prisma.solicitacao.findMany({
    where: whereSolicitacaoRealizada(filtros),
    select: { valorTotal: true, dataPagamento: true, tipoFluxo: true },
  })
}

async function lancamentosRealizados(filtros: FiltrosDashboard) {
  return prisma.lancamento.findMany({
    where: {
      area: filtros.area,
      motivo: filtros.motivo,
      solicitacao: {
        status: 'PAGO',
        escritorioId: filtros.escritorioId,
        dataPagamento: filtroDataPagamento(filtros),
      },
    },
    include: { solicitacao: { select: { dataPagamento: true, tipoFluxo: true } } },
  })
}

export async function kpis(filtros: FiltrosDashboard) {
  const [solicitacoes, alertasAbertos, emConferencia] = await Promise.all([
    solicitacoesRealizadas(filtros),
    prisma.alerta.count({ where: { resolvidoEm: null } }),
    prisma.solicitacao.count({ where: { status: 'EM_CONFERENCIA' } }),
  ])
  const totalPago = solicitacoes.reduce((acc, s) => acc + Number(s.valorTotal), 0)
  const quantidadeSolicitacoesPagas = solicitacoes.length

  return {
    totalPago: Number(totalPago.toFixed(2)),
    quantidadeSolicitacoesPagas,
    valorMedioPorSolicitacao: quantidadeSolicitacoesPagas
      ? Number((totalPago / quantidadeSolicitacoesPagas).toFixed(2))
      : 0,
    alertasAbertos,
    emConferencia,
  }
}

export async function realizadoMensal(ano: number, filtros: FiltrosDashboard) {
  const inicioAno = new Date(Date.UTC(ano, 0, 1))
  const fimAno = new Date(Date.UTC(ano, 11, 31, 23, 59, 59))
  const solicitacoes = await solicitacoesRealizadas({
    ...filtros,
    de: filtros.de && filtros.de > inicioAno ? filtros.de : inicioAno,
    ate: filtros.ate && filtros.ate < fimAno ? filtros.ate : fimAno,
  })

  const porMes = Array.from({ length: 12 }, () => 0)
  for (const s of solicitacoes) {
    if (!s.dataPagamento) continue
    porMes[s.dataPagamento.getUTCMonth()] += Number(s.valorTotal)
  }
  return porMes.map((total, i) => ({ mes: i + 1, total: Number(total.toFixed(2)) }))
}

function agruparPorCampo(lancamentos: { area: string; motivo: string; valorPrincipal: unknown; valorJurosCorrecao: unknown }[], campo: 'area' | 'motivo') {
  const mapa = new Map<string, number>()
  for (const l of lancamentos) {
    const chave = l[campo]
    const valor = Number(l.valorPrincipal) + Number(l.valorJurosCorrecao)
    mapa.set(chave, (mapa.get(chave) ?? 0) + valor)
  }
  return [...mapa.entries()].map(([chave, total]) => ({ chave, total: Number(total.toFixed(2)) }))
}

export async function porArea(filtros: FiltrosDashboard) {
  return agruparPorCampo(await lancamentosRealizados(filtros), 'area')
}

export async function porMotivo(filtros: FiltrosDashboard) {
  return agruparPorCampo(await lancamentosRealizados(filtros), 'motivo')
}

export async function porOrdemInterna(filtros: FiltrosDashboard) {
  const lancamentos = await prisma.lancamento.findMany({
    where: {
      area: filtros.area,
      motivo: filtros.motivo,
      solicitacao: { status: 'PAGO', escritorioId: filtros.escritorioId, dataPagamento: filtroDataPagamento(filtros) },
    },
    select: { ordemInterna: true, valorPrincipal: true, valorJurosCorrecao: true },
  })
  const mapa = new Map<string, number>()
  for (const l of lancamentos) {
    const chave = l.ordemInterna ?? 'sem ordem interna'
    const valor = Number(l.valorPrincipal) + Number(l.valorJurosCorrecao)
    mapa.set(chave, (mapa.get(chave) ?? 0) + valor)
  }
  return [...mapa.entries()].map(([chave, total]) => ({ chave, total: Number(total.toFixed(2)) }))
}

export type AgrupamentoHonorarios = 'area' | 'ano'

/** Honorários realizados (RC_HONORARIOS_NF), agrupados por área ou por ano —
 * cobre os relatórios "Histórico Honorários Anual" e "Honorários variáveis anual"
 * do PPTX (ver docs/REFS_RESUMO.md). */
export async function mediaHonorarios(agruparPor: AgrupamentoHonorarios, filtros: FiltrosDashboard) {
  const lancamentos = await prisma.lancamento.findMany({
    where: {
      area: filtros.area,
      motivo: filtros.motivo,
      solicitacao: {
        status: 'PAGO',
        tipoFluxo: 'RC_HONORARIOS_NF',
        escritorioId: filtros.escritorioId,
        dataPagamento: filtroDataPagamento(filtros),
      },
    },
    include: { solicitacao: { select: { dataPagamento: true } } },
  })

  const mapa = new Map<string, { soma: number; quantidade: number }>()
  for (const l of lancamentos) {
    const chave = agruparPor === 'ano' ? String(l.solicitacao.dataPagamento?.getUTCFullYear() ?? 'sem-data') : l.area
    const atual = mapa.get(chave) ?? { soma: 0, quantidade: 0 }
    atual.soma += Number(l.valorPrincipal)
    atual.quantidade += 1
    mapa.set(chave, atual)
  }
  return [...mapa.entries()].map(([chave, { soma, quantidade }]) => ({
    chave,
    total: Number(soma.toFixed(2)),
    media: quantidade ? Number((soma / quantidade).toFixed(2)) : 0,
    quantidade,
  }))
}

/** Funil de status — ao contrário dos demais, não filtra por "realizado": mostra
 * a distribuição em TODOS os status, incluindo DEVOLVIDO/CANCELADO (o "vazamento"
 * do funil). */
export async function funil(filtros: FiltrosDashboard) {
  const where: Prisma.SolicitacaoWhereInput = {
    escritorioId: filtros.escritorioId,
    lancamentos: filtroLancamentos(filtros),
  }
  const grupos = await prisma.solicitacao.groupBy({ by: ['status'], where, _count: { _all: true } })
  const porStatus = new Map(grupos.map((g) => [g.status, g._count._all]))
  const ordem: StatusSolicitacao[] = [
    'RASCUNHO',
    'ENVIADO',
    'EM_CONFERENCIA',
    'DEVOLVIDO',
    'APROVADO',
    'CHAMADO_ABERTO',
    'PAGO',
    'CANCELADO',
  ]
  return ordem.map((status) => ({ status, quantidade: porStatus.get(status) ?? 0 }))
}

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const

/** Exporta o realizado mensal do ano (mesmos dados de `realizadoMensal`) como
 * .xlsx, para o dashboard do gestor. */
export async function exportarRealizadoXlsx(ano: number, filtros: FiltrosDashboard): Promise<Buffer> {
  const dados = await realizadoMensal(ano, filtros)

  const workbook = new ExcelJS.Workbook()
  const planilha = workbook.addWorksheet(`Realizado ${ano}`)
  planilha.addRow(['Mês', 'Total pago (R$)'])
  for (const linha of dados) {
    planilha.addRow([NOMES_MES[linha.mes - 1], linha.total])
  }
  planilha.addRow(['Total do ano', Number(dados.reduce((acc, l) => acc + l.total, 0).toFixed(2))])

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
