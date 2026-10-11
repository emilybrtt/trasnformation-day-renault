import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { DadosExtraidos, GuiaExtraida, NfExtraida, TipoDocumentoExtracao } from './extracao.js'
import type { LlmProvider } from './types.js'

// pdf-parse (a lib "óbvia" para isso) está abandonada desde 2019 e usa um pdf.js tão
// antigo que não lê nem os PDFs gerados pelo próprio pdfkit do B4 ("bad XRef entry").
// Usamos o pdf.js de verdade (pdfjs-dist) diretamente.
const require = createRequire(import.meta.url)
const STANDARD_FONT_DATA_URL = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + '/'

async function extrairTextoPdf(pdfBuffer: Buffer): Promise<string> {
  const documento = await getDocument({
    data: new Uint8Array(pdfBuffer),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    useSystemFonts: true,
  }).promise
  let texto = ''
  for (let i = 1; i <= documento.numPages; i++) {
    const pagina = await documento.getPage(i)
    const conteudo = await pagina.getTextContent()
    for (const item of conteudo.items) {
      if ('str' in item) texto += item.str + (item.hasEOL ? '\n' : '')
    }
  }
  return texto
}

function capturar(texto: string, label: string): string | undefined {
  // ^ ancorado no início da linha — sem isso, "Prestador:" também bate como
  // substring dentro de "CNPJ do prestador:".
  const regex = new RegExp(`^${label}:\\s*(.+)`, 'im')
  return regex.exec(texto)?.[1]?.trim()
}

/** "R$ 9.000,00" → 9000. Sem o "R$"/pontos de milhar, com vírgula decimal. */
function moedaBrParaNumero(texto?: string): number | undefined {
  if (!texto) return undefined
  const soDigitosEVirgula = texto.replace(/[^\d.,]/g, '')
  const semMilhar = soDigitosEVirgula.replace(/\.(?=\d{3}(\D|$))/g, '')
  const n = Number(semMilhar.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

function extrairGuia(texto: string): GuiaExtraida {
  return {
    beneficiarioNome: capturar(texto, 'Beneficiário'),
    beneficiarioCnpj: capturar(texto, 'CNPJ'),
    numeroProcesso: capturar(texto, 'Número do processo'),
    nossoNumero: capturar(texto, 'Nosso número'),
    numeroDocumento: capturar(texto, 'Número do documento'),
    dataDocumento: capturar(texto, 'Data do documento'),
    dataVencimento: capturar(texto, 'Vencimento'),
    valor: moedaBrParaNumero(capturar(texto, 'Valor')),
    linhaDigitavel: capturar(texto, 'Linha digitável'),
  }
}

function extrairNf(texto: string): NfExtraida {
  return {
    numeroNf: capturar(texto, 'Nota Fiscal nº'),
    cnpjPrestador: capturar(texto, 'CNPJ do prestador'),
    nomePrestador: capturar(texto, 'Prestador'),
    dataEmissao: capturar(texto, 'Data de emissão'),
    valorServico: moedaBrParaNumero(capturar(texto, 'Valor do serviço')),
    valorLiquido: moedaBrParaNumero(capturar(texto, 'Valor líquido')),
    descricao: capturar(texto, 'Descrição'),
  }
}

/** Provider determinístico, usado quando GEMINI_API_KEY não está configurada. */
export class MockLlm implements LlmProvider {
  readonly nome = 'mock' as const

  async gerarTexto(prompt: string): Promise<string> {
    return `[mock] resposta determinística para: ${prompt.slice(0, 120)}`
  }

  /** Lê o texto do PDF (gerado pelo B4 em docs/demo-pdfs/) e extrai por regex — não
   * é IA de verdade, mas funciona de forma determinística sem nenhuma credencial. */
  async extrairDocumento(tipo: TipoDocumentoExtracao, pdfBuffer: Buffer): Promise<DadosExtraidos> {
    const texto = await extrairTextoPdf(pdfBuffer)
    return tipo === 'GUIA' ? extrairGuia(texto) : extrairNf(texto)
  }
}
