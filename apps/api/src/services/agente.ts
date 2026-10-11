import { formatarMoeda } from '../lib/formatoMoeda.js'
import * as dashboards from './dashboards.js'

export interface VisualAgente {
  tipo: 'barra' | 'linha' | 'tabela'
  dados: unknown
}

export interface ResultadoFerramenta {
  texto: string
  visual?: VisualAgente
}

function inicioEFimDoAno(ano: number, mesInicio = 1, mesFim = 12): { de: Date; ate: Date } {
  const de = new Date(Date.UTC(ano, mesInicio - 1, 1))
  const ate = new Date(Date.UTC(ano, mesFim, 0, 23, 59, 59))
  return { de, ate }
}

export async function totalPago(params: {
  ano?: number
  area?: string
  motivo?: string
}): Promise<ResultadoFerramenta> {
  const { de, ate } = params.ano ? inicioEFimDoAno(params.ano) : { de: undefined, ate: undefined }
  const total = await dashboards.totalRealizado({ de, ate, area: params.area, motivo: params.motivo })

  const partes = [params.motivo ? `de ${params.motivo.toLowerCase()}` : undefined, params.area ? `na área ${params.area}` : undefined, params.ano ? `em ${params.ano}` : undefined].filter(
    (p): p is string => Boolean(p),
  )
  const texto = `Total pago${partes.length ? ` ${partes.join(' ')}` : ''}: R$ ${formatarMoeda(total)}.`

  return { texto, visual: { tipo: 'tabela', dados: [{ ano: params.ano ?? 'todos', total }] } }
}

export async function comparativoAnual(params: {
  anoA: number
  anoB: number
  mesFim?: number
  area?: string
  motivo?: string
}): Promise<ResultadoFerramenta> {
  const mesFim = params.mesFim ?? 12
  const [{ de: deA, ate: ateA }, { de: deB, ate: ateB }] = [inicioEFimDoAno(params.anoA, 1, mesFim), inicioEFimDoAno(params.anoB, 1, mesFim)]
  const [totalA, totalB] = await Promise.all([
    dashboards.totalRealizado({ de: deA, ate: ateA, area: params.area, motivo: params.motivo }),
    dashboards.totalRealizado({ de: deB, ate: ateB, area: params.area, motivo: params.motivo }),
  ])

  const filtro = params.motivo ? ` de ${params.motivo.toLowerCase()}` : ''
  const periodo = mesFim === 12 ? 'no ano' : `até o mês ${mesFim}`
  const texto =
    `Total pago${filtro} ${periodo} em ${params.anoA}: R$ ${formatarMoeda(totalA)}. ` +
    `Em ${params.anoB}: R$ ${formatarMoeda(totalB)}.`

  return {
    texto,
    visual: {
      tipo: 'barra',
      dados: [
        { ano: params.anoA, total: totalA },
        { ano: params.anoB, total: totalB },
      ],
    },
  }
}

export async function mediaHonorarios(params: {
  agruparPor?: 'area' | 'ano'
  ano?: number
}): Promise<ResultadoFerramenta> {
  const agruparPor = params.agruparPor ?? 'area'
  const { de, ate } = params.ano ? inicioEFimDoAno(params.ano) : { de: undefined, ate: undefined }
  const dados = await dashboards.mediaHonorarios(agruparPor, { de, ate })

  const texto = dados.length
    ? `Honorários por ${agruparPor === 'ano' ? 'ano' : 'área'}: ${dados.map((d) => `${d.chave} — média R$ ${formatarMoeda(d.media)} (${d.quantidade} pagamentos)`).join('; ')}.`
    : 'Nenhum honorário pago encontrado para esse filtro.'

  return { texto, visual: { tipo: 'barra', dados } }
}

export async function realizadoAteMes(params: {
  ano?: number
  mesInicio?: number
  mesFim?: number
  agruparPor?: 'mes' | 'ordemInterna' | 'area' | 'motivo'
}): Promise<ResultadoFerramenta> {
  const ano = params.ano ?? new Date().getFullYear()
  const mesInicio = params.mesInicio ?? 1
  const mesFim = params.mesFim ?? 12
  const agruparPor = params.agruparPor ?? 'mes'

  if (agruparPor === 'mes') {
    const porMes = await dashboards.realizadoMensal(ano, {})
    const dados = porMes.filter((m) => m.mes >= mesInicio && m.mes <= mesFim)
    const total = dados.reduce((acc, m) => acc + m.total, 0)
    return {
      texto: `Realizado de ${ano} entre os meses ${mesInicio} e ${mesFim}: R$ ${formatarMoeda(total)}.`,
      visual: { tipo: 'linha', dados },
    }
  }

  const { de, ate } = inicioEFimDoAno(ano, mesInicio, mesFim)
  const dados =
    agruparPor === 'ordemInterna'
      ? await dashboards.porOrdemInterna({ de, ate })
      : agruparPor === 'area'
        ? await dashboards.porArea({ de, ate })
        : await dashboards.porMotivo({ de, ate })

  const total = dados.reduce((acc, d) => acc + d.total, 0)
  return {
    texto: `Realizado de ${ano} entre os meses ${mesInicio} e ${mesFim}, por ${agruparPor}: R$ ${formatarMoeda(total)} no total, em ${dados.length} grupo(s).`,
    visual: { tipo: 'barra', dados },
  }
}

export async function topPastas(params: { limite?: number; ano?: number }): Promise<ResultadoFerramenta> {
  const { de, ate } = params.ano ? inicioEFimDoAno(params.ano) : { de: undefined, ate: undefined }
  const dados = await dashboards.topPastas({ de, ate }, params.limite ?? 5)

  const texto = dados.length
    ? `Pastas com maior valor pago: ${dados.map((d) => `${d.pastaProjuris} (R$ ${formatarMoeda(d.total)})`).join(', ')}.`
    : 'Nenhuma pasta com pagamento realizado encontrada.'

  return { texto, visual: { tipo: 'tabela', dados } }
}

export async function pendencias(): Promise<ResultadoFerramenta> {
  const dados = await dashboards.pendencias()

  const texto = dados.length
    ? `${dados.length} solicitação(ões) em amarelo ou vermelho agora: ${dados
        .map((d) => `${d.pastas.join('/') || d.id} (${d.semaforo}, ${d.escritorio})`)
        .join('; ')}.`
    : 'Nenhuma solicitação em amarelo ou vermelho agora.'

  return { texto, visual: { tipo: 'tabela', dados } }
}

export const EXECUTORES_FERRAMENTAS: Record<string, (parametros: Record<string, unknown>) => Promise<ResultadoFerramenta>> = {
  totalPago: (p) => totalPago(p as Parameters<typeof totalPago>[0]),
  comparativoAnual: (p) => comparativoAnual(p as Parameters<typeof comparativoAnual>[0]),
  mediaHonorarios: (p) => mediaHonorarios(p as Parameters<typeof mediaHonorarios>[0]),
  realizadoAteMes: (p) => realizadoAteMes(p as Parameters<typeof realizadoAteMes>[0]),
  topPastas: (p) => topPastas(p as Parameters<typeof topPastas>[0]),
  pendencias: () => pendencias(),
}
