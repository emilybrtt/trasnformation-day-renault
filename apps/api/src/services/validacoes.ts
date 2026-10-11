import type { Severidade } from '@prisma/client'
import { formatarMoeda } from '../lib/formatoMoeda.js'
import { prisma } from '../lib/prisma.js'
import { piorSemaforo } from '../lib/semaforo.js'

const TOLERANCIA_CENTAVOS = 0.01
const JANELA_DUPLICIDADE_DIAS = 180
const AMOSTRA_MINIMA_VALOR_ATIPICO = 3

/** Diferença em reais, arredondando cada valor a centavos antes de subtrair —
 * evita falso positivo por erro de ponto flutuante (ex.: 110.01 - 110 !== 0.01). */
function diferenca(a: number, b: number): number {
  return Math.abs(Math.round(a * 100) - Math.round(b * 100)) / 100
}

export interface AlertaCandidato {
  lancamentoId: string | null
  codigo: string
  severidade: Severidade
  mensagem: string
}

function extrairValorDocumento(anexos: { dadosExtraidos: unknown }[]): number | null {
  for (const anexo of anexos) {
    const dados = anexo.dadosExtraidos as { valor?: number; valorServico?: number } | null
    if (!dados) continue
    if (typeof dados.valor === 'number') return dados.valor
    if (typeof dados.valorServico === 'number') return dados.valorServico
  }
  return null
}

/** Roda todas as regras do motor de validação para uma solicitação e devolve os
 * alertas que deveriam existir agora (sem persistir nada — ver
 * `validarEAtualizarAlertas` para a versão que grava). */
export async function avaliarSolicitacao(solicitacaoId: string): Promise<AlertaCandidato[]> {
  const solicitacao = await prisma.solicitacao.findUniqueOrThrow({
    where: { id: solicitacaoId },
    include: { lancamentos: true, anexos: true },
  })
  const candidatos: AlertaCandidato[] = []

  if (solicitacao.tipoFluxo === 'RC_HONORARIOS_NF' && !solicitacao.anexos.some((a) => a.tipo === 'NF')) {
    candidatos.push({
      lancamentoId: null,
      codigo: 'CAMPO_OBRIGATORIO',
      severidade: 'VERMELHO',
      mensagem: 'Pagamento de honorários com Nota Fiscal precisa do anexo da NF.',
    })
  }
  if (solicitacao.tipoFluxo === 'RBS_DD_GUIA' && !solicitacao.anexos.some((a) => a.tipo === 'GUIA')) {
    candidatos.push({
      lancamentoId: null,
      codigo: 'CAMPO_OBRIGATORIO',
      severidade: 'VERMELHO',
      mensagem: 'Pagamento por guia/boleto judicial precisa do anexo da guia.',
    })
  }

  const valorDocumento = extrairValorDocumento(solicitacao.anexos)

  for (const lanc of solicitacao.lancamentos) {
    if (!lanc.pastaProjuris.trim()) {
      candidatos.push({
        lancamentoId: lanc.id,
        codigo: 'CAMPO_OBRIGATORIO',
        severidade: 'VERMELHO',
        mensagem: 'A pasta Projuris é obrigatória.',
      })
    }

    if (!lanc.centroCusto || !lanc.contaContabil) {
      candidatos.push({
        lancamentoId: lanc.id,
        codigo: 'DE_PARA_INEXISTENTE',
        severidade: 'VERMELHO',
        mensagem: `Não existe de-para cadastrado para Área ${lanc.area} + Motivo ${lanc.motivo} em ${solicitacao.dataDocumento.getFullYear()}.`,
      })
    }

    const soma = Number(lanc.valorPrincipal) + Number(lanc.valorJurosCorrecao)

    if (lanc.valorTotalInformado != null && diferenca(soma, Number(lanc.valorTotalInformado)) > TOLERANCIA_CENTAVOS) {
      candidatos.push({
        lancamentoId: lanc.id,
        codigo: 'SOMA_DIVERGENTE',
        severidade: 'VERMELHO',
        mensagem: `Principal + juros (R$ ${formatarMoeda(soma)}) não bate com o valor total informado (R$ ${formatarMoeda(Number(lanc.valorTotalInformado))}).`,
      })
    }

    if (valorDocumento != null && diferenca(soma, valorDocumento) > TOLERANCIA_CENTAVOS) {
      candidatos.push({
        lancamentoId: lanc.id,
        codigo: 'DIVERGENCIA_VALOR_DOC',
        severidade: 'AMARELO',
        mensagem: `Valor digitado (R$ ${formatarMoeda(soma)}) diverge do valor extraído do documento (R$ ${formatarMoeda(valorDocumento)}).`,
      })
    }

    const inicioJanela = new Date(solicitacao.dataDocumento)
    inicioJanela.setDate(inicioJanela.getDate() - JANELA_DUPLICIDADE_DIAS)
    const fimJanela = new Date(solicitacao.dataDocumento)
    fimJanela.setDate(fimJanela.getDate() + JANELA_DUPLICIDADE_DIAS)

    const duplicado = await prisma.lancamento.findFirst({
      where: {
        id: { not: lanc.id },
        pastaProjuris: lanc.pastaProjuris,
        motivo: lanc.motivo,
        valorPrincipal: lanc.valorPrincipal,
        solicitacao: { dataDocumento: { gte: inicioJanela, lte: fimJanela } },
      },
    })
    if (duplicado) {
      candidatos.push({
        lancamentoId: lanc.id,
        codigo: 'DUPLICIDADE',
        severidade: 'AMARELO',
        mensagem: `Possível duplicidade: a pasta ${lanc.pastaProjuris} já tem R$ ${formatarMoeda(Number(lanc.valorPrincipal))} (${lanc.motivo}) lançado nos últimos ${JANELA_DUPLICIDADE_DIAS} dias.`,
      })
    }

    const outros = await prisma.lancamento.findMany({
      where: { area: lanc.area, motivo: lanc.motivo, id: { not: lanc.id } },
      select: { valorPrincipal: true },
    })
    if (outros.length >= AMOSTRA_MINIMA_VALOR_ATIPICO) {
      const valores = outros.map((o) => Number(o.valorPrincipal))
      const media = valores.reduce((a, b) => a + b, 0) / valores.length
      const variancia = valores.reduce((a, b) => a + (b - media) ** 2, 0) / valores.length
      const limite = media + 3 * Math.sqrt(variancia)
      if (Number(lanc.valorPrincipal) > limite) {
        candidatos.push({
          lancamentoId: lanc.id,
          codigo: 'VALOR_ATIPICO',
          severidade: 'AMARELO',
          mensagem: `Valor de R$ ${formatarMoeda(Number(lanc.valorPrincipal))} está muito acima da média (~R$ ${formatarMoeda(media)}) para ${lanc.area}/${lanc.motivo}.`,
        })
      }
    }
  }

  if (solicitacao.numeroDocumentoLbs) {
    const mesmoDocumento = await prisma.solicitacao.findFirst({
      where: { id: { not: solicitacao.id }, numeroDocumentoLbs: solicitacao.numeroDocumentoLbs },
    })
    if (mesmoDocumento) {
      candidatos.push({
        lancamentoId: null,
        codigo: 'DUPLICIDADE',
        severidade: 'AMARELO',
        mensagem: `Já existe outra solicitação com o número de documento ${solicitacao.numeroDocumentoLbs}.`,
      })
    }
  }

  if (solicitacao.tipoFluxo === 'ANEXO_V_BAIXA') {
    const [adiantado, baixado] = await Promise.all([
      prisma.solicitacao.aggregate({
        where: { escritorioId: solicitacao.escritorioId, tipoFluxo: 'ANEXO_V_ADIANTAMENTO', status: { not: 'CANCELADO' } },
        _sum: { valorTotal: true },
      }),
      prisma.solicitacao.aggregate({
        where: {
          escritorioId: solicitacao.escritorioId,
          tipoFluxo: 'ANEXO_V_BAIXA',
          status: { not: 'CANCELADO' },
          id: { not: solicitacao.id },
        },
        _sum: { valorTotal: true },
      }),
    ])
    const saldo = Number(adiantado._sum.valorTotal ?? 0) - Number(baixado._sum.valorTotal ?? 0)
    if (Number(solicitacao.valorTotal) > saldo) {
      candidatos.push({
        lancamentoId: null,
        codigo: 'SALDO_ADIANTAMENTO',
        severidade: 'VERMELHO',
        mensagem: `Baixa de R$ ${formatarMoeda(Number(solicitacao.valorTotal))} é maior que o saldo adiantado (R$ ${formatarMoeda(saldo)}).`,
      })
    }
  }

  return candidatos
}

/** Roda o motor de validação e grava os alertas: substitui os alertas ainda
 * abertos (os já resolvidos ficam como histórico) e recalcula o semáforo de cada
 * lançamento a partir dos alertas abertos. Chamado por `enviarSolicitacao` (B6). */
export async function validarEAtualizarAlertas(solicitacaoId: string): Promise<AlertaCandidato[]> {
  const candidatos = await avaliarSolicitacao(solicitacaoId)

  await prisma.alerta.deleteMany({ where: { solicitacaoId, resolvidoEm: null } })
  if (candidatos.length > 0) {
    await prisma.alerta.createMany({ data: candidatos.map((c) => ({ solicitacaoId, ...c })) })
  }

  const lancamentos = await prisma.lancamento.findMany({
    where: { solicitacaoId },
    include: { alertas: { where: { resolvidoEm: null } } },
  })
  for (const lanc of lancamentos) {
    const semaforo = piorSemaforo(lanc.alertas.map((a) => a.severidade))
    if (semaforo !== lanc.semaforo) {
      await prisma.lancamento.update({ where: { id: lanc.id }, data: { semaforo } })
    }
  }

  return candidatos
}
