import ExcelJS from 'exceljs'
import { ErroHttp } from '../lib/erroHttp.js'
import { prisma } from '../lib/prisma.js'

// Colunas A–P, exatamente como no arquivo real (ver CONTEXT.md, seção "Excel de rateio").
export const CABECALHO_RATEIO = [
  'CHAVE DE LANÇAMENTO',
  'DEB/CRED',
  'CONTA',
  'REFERENCIA',
  'ELEMENTO PEP',
  'ORDEM INTERNA',
  'CENTRO DE CUSTO',
  'TIPO DE ATIVIDADE',
  'VALOR',
  'MOEDA',
  'TEXTO CAB. DOCUMENTO',
  'DT LANÇAMENTO',
  'DT DO DOCUMENTO',
  'ATRIBUIÇÃO',
  'NUMERO DO ATIVO',
  'TEXTO MÊS DE REFERENCIA',
] as const

const CONTA_JUROS = '686242'
const CENTRO_CUSTO_JUROS = 'GI85030'
const CONTA_CREDITO_ANEXO_V = '108067'
const TOLERANCIA_CENTAVOS = 0.01

export interface LinhaRateio {
  chave: '40' | '31'
  debCred: 'Deb' | 'Cred'
  conta: string
  referencia: string
  elementoPep: string
  ordemInterna: string
  centroCusto: string
  tipoAtividade: string
  valor: number
  moeda: 'BRL'
  textoCabDocumento: string
  dtLancamento: string
  dtDocumento: string
  atribuicao: string
  numeroAtivo: string
  textoMes: string
}

function formatarDataSap(data: Date): string {
  const dd = String(data.getUTCDate()).padStart(2, '0')
  const mm = String(data.getUTCMonth() + 1).padStart(2, '0')
  const aaaa = data.getUTCFullYear()
  return `${dd}.${mm}.${aaaa}`
}

function linhaBase(partial: Partial<LinhaRateio> & Pick<LinhaRateio, 'chave' | 'debCred' | 'conta' | 'valor' | 'dtLancamento' | 'dtDocumento'>): LinhaRateio {
  return {
    referencia: '',
    elementoPep: '',
    ordemInterna: '',
    centroCusto: '',
    tipoAtividade: '',
    moeda: 'BRL',
    textoCabDocumento: '',
    atribuicao: '',
    numeroAtivo: '',
    textoMes: '',
    ...partial,
  }
}

/** Monta as linhas do rateio (sem gerar o .xlsx) — útil para testar o conteúdo
 * isoladamente do formato do arquivo. */
export async function montarLinhasRateio(solicitacaoId: string): Promise<LinhaRateio[]> {
  const solicitacao = await prisma.solicitacao.findUniqueOrThrow({
    where: { id: solicitacaoId },
    include: { lancamentos: true, escritorio: true, fornecedor: true },
  })

  const dtDocumento = formatarDataSap(solicitacao.dataDocumento)
  const dtLancamento = formatarDataSap(solicitacao.dataPagamento ?? new Date())
  const referenciaDocumento = solicitacao.numeroDocumentoLbs ?? ''

  const linhas: LinhaRateio[] = []
  let totalDebitos = 0

  for (const lanc of solicitacao.lancamentos) {
    if (!lanc.contaContabil || !lanc.centroCusto) {
      throw new ErroHttp(422, {
        erro: `Lançamento da pasta ${lanc.pastaProjuris} não tem de-para resolvido — não é possível gerar o rateio.`,
      })
    }

    const principal = Number(lanc.valorPrincipal)
    linhas.push(
      linhaBase({
        chave: '40',
        debCred: 'Deb',
        conta: lanc.contaContabil,
        referencia: referenciaDocumento,
        ordemInterna: lanc.ordemInterna ?? '',
        centroCusto: lanc.centroCusto,
        valor: principal,
        dtLancamento,
        dtDocumento,
        atribuicao: lanc.pastaProjuris,
        textoMes: lanc.motivo,
      }),
    )
    totalDebitos += principal

    const juros = Number(lanc.valorJurosCorrecao)
    if (juros > 0) {
      linhas.push(
        linhaBase({
          chave: '40',
          debCred: 'Deb',
          conta: CONTA_JUROS,
          referencia: referenciaDocumento,
          ordemInterna: lanc.ordemInterna ?? '',
          centroCusto: CENTRO_CUSTO_JUROS,
          valor: juros,
          dtLancamento,
          dtDocumento,
          atribuicao: lanc.pastaProjuris,
          textoMes: 'Juros e Correção',
        }),
      )
      totalDebitos += juros
    }
  }

  const ehAnexoV = solicitacao.tipoFluxo.startsWith('ANEXO_V')
  const contaCredito = ehAnexoV ? CONTA_CREDITO_ANEXO_V : solicitacao.fornecedor?.codigoSap
  if (!contaCredito) {
    throw new ErroHttp(422, {
      erro: 'Solicitação sem fornecedor associado — RBS_DD precisa de um fornecedor para gerar o rateio.',
    })
  }
  const textoCredito = ehAnexoV
    ? `Baixa de adiantamento ${solicitacao.escritorio.nome}`
    : `Pagamento ${solicitacao.fornecedor?.nome ?? ''}`.trim()

  linhas.push(
    linhaBase({
      chave: '31',
      debCred: 'Cred',
      conta: contaCredito,
      referencia: ehAnexoV ? textoCredito : referenciaDocumento,
      textoCabDocumento: textoCredito,
      valor: Number(totalDebitos.toFixed(2)),
      dtLancamento,
      dtDocumento,
    }),
  )

  return linhas
}

function somaPorTipo(linhas: LinhaRateio[], debCred: 'Deb' | 'Cred'): number {
  const soma = linhas.filter((l) => l.debCred === debCred).reduce((acc, l) => acc + l.valor, 0)
  return Math.round(soma * 100) / 100
}

export function garantirDebitoIgualCredito(linhas: LinhaRateio[]): void {
  const debitos = somaPorTipo(linhas, 'Deb')
  const creditos = somaPorTipo(linhas, 'Cred')
  if (Math.abs(Math.round(debitos * 100) - Math.round(creditos * 100)) > TOLERANCIA_CENTAVOS * 100) {
    throw new ErroHttp(422, { erro: `Soma dos débitos (R$ ${debitos}) não bate com o crédito (R$ ${creditos}).` })
  }
}

export async function gerarRateioXlsx(solicitacaoId: string): Promise<Buffer> {
  const linhas = await montarLinhasRateio(solicitacaoId)
  garantirDebitoIgualCredito(linhas)

  const workbook = new ExcelJS.Workbook()
  const planilha = workbook.addWorksheet('Planilha1')
  planilha.addRow([...CABECALHO_RATEIO])
  for (const l of linhas) {
    planilha.addRow([
      l.chave,
      l.debCred,
      l.conta,
      l.referencia,
      l.elementoPep,
      l.ordemInterna,
      l.centroCusto,
      l.tipoAtividade,
      Number(l.valor.toFixed(2)),
      l.moeda,
      l.textoCabDocumento,
      l.dtLancamento,
      l.dtDocumento,
      l.atribuicao,
      l.numeroAtivo,
      l.textoMes,
    ])
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
