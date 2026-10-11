import { Router } from 'express'
import { assincrona } from '../lib/assincrona.js'
import { ErroHttp } from '../lib/erroHttp.js'
import { auth, exige } from '../middleware/auth.js'
import * as dashboards from '../services/dashboards.js'
import type { AgrupamentoHonorarios, FiltrosDashboard } from '../services/dashboards.js'

export const dashboardRouter = Router()
dashboardRouter.use('/dashboard', auth, exige('ANALISTA', 'GESTOR'))

function filtrosDaQuery(query: Record<string, string | undefined>): FiltrosDashboard {
  return {
    de: query.de ? new Date(query.de) : undefined,
    ate: query.ate ? new Date(query.ate) : undefined,
    area: query.area,
    motivo: query.motivo,
    escritorioId: query.escritorio,
  }
}

dashboardRouter.get(
  '/dashboard/kpis',
  assincrona(async (req, res) => {
    res.json(await dashboards.kpis(filtrosDaQuery(req.query as Record<string, string | undefined>)))
  }),
)

dashboardRouter.get(
  '/dashboard/realizado-mensal',
  assincrona(async (req, res) => {
    const query = req.query as Record<string, string | undefined>
    const ano = Number(query.ano ?? new Date().getFullYear())
    res.json(await dashboards.realizadoMensal(ano, filtrosDaQuery(query)))
  }),
)

dashboardRouter.get(
  '/dashboard/por-area',
  assincrona(async (req, res) => {
    res.json(await dashboards.porArea(filtrosDaQuery(req.query as Record<string, string | undefined>)))
  }),
)

dashboardRouter.get(
  '/dashboard/por-motivo',
  assincrona(async (req, res) => {
    res.json(await dashboards.porMotivo(filtrosDaQuery(req.query as Record<string, string | undefined>)))
  }),
)

dashboardRouter.get(
  '/dashboard/por-ordem-interna',
  assincrona(async (req, res) => {
    res.json(await dashboards.porOrdemInterna(filtrosDaQuery(req.query as Record<string, string | undefined>)))
  }),
)

dashboardRouter.get(
  '/dashboard/media-honorarios',
  assincrona(async (req, res) => {
    const query = req.query as Record<string, string | undefined>
    const agruparPor = query.agruparPor === 'ano' ? 'ano' : 'area'
    res.json(await dashboards.mediaHonorarios(agruparPor as AgrupamentoHonorarios, filtrosDaQuery(query)))
  }),
)

// Alias explícito para os relatórios "Histórico Honorários Anual" / "Honorários
// variáveis anual" do PPTX (ver docs/REFS_RESUMO.md) — mesmos dados de
// media-honorarios?agruparPor=ano, com um nome que corresponde ao slide.
dashboardRouter.get(
  '/dashboard/honorarios-anual',
  assincrona(async (req, res) => {
    res.json(await dashboards.mediaHonorarios('ano', filtrosDaQuery(req.query as Record<string, string | undefined>)))
  }),
)

dashboardRouter.get(
  '/dashboard/funil',
  assincrona(async (req, res) => {
    res.json(await dashboards.funil(filtrosDaQuery(req.query as Record<string, string | undefined>)))
  }),
)

dashboardRouter.get(
  '/dashboard/export.xlsx',
  assincrona(async (req, res) => {
    const query = req.query as Record<string, string | undefined>
    const ano = Number(query.ano ?? new Date().getFullYear())
    if (Number.isNaN(ano)) throw new ErroHttp(400, { erro: 'ano inválido' })

    const buffer = await dashboards.exportarRealizadoXlsx(ano, filtrosDaQuery(query))
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="realizado-${ano}.xlsx"`)
    res.send(buffer)
  }),
)
