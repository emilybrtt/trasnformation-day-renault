import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { DadosExtraidos, GuiaExtraida, NfExtraida, TipoDocumentoExtracao } from './extracao.js'
import type { DeclaracaoFerramenta, EscolhaFerramenta, MensagemAgente } from './ferramentas.js'
import type { LlmProvider } from './types.js'

const NOMES_MES: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
}

function anosEncontrados(mensagem: string): number[] {
  return [...mensagem.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]))
}

function mesEncontrado(mensagemMinuscula: string): number | undefined {
  for (const [nome, numero] of Object.entries(NOMES_MES)) {
    if (mensagemMinuscula.includes(nome)) return numero
  }
  return undefined
}

/** "3º trimestre"/"terceiro trimestre" → [7, 9]. */
function trimestreEncontrado(mensagemMinuscula: string): [number, number] | undefined {
  const porNumero = /([1-4])\s*[ºo°]?\s*trimestre/.exec(mensagemMinuscula)
  if (porNumero) {
    const t = Number(porNumero[1])
    return [(t - 1) * 3 + 1, t * 3]
  }
  const ORDINAIS: Record<string, number> = { primeiro: 1, segundo: 2, terceiro: 3, quarto: 4 }
  for (const [nome, t] of Object.entries(ORDINAIS)) {
    if (mensagemMinuscula.includes(`${nome} trimestre`)) return [(t - 1) * 3 + 1, t * 3]
  }
  return undefined
}

/** Roteamento por palavras-chave, sem nenhum modelo de verdade por trás — determinístico
 * e sem credencial, mas respeitando o mesmo contrato (`escolherFerramenta`) do provider real. */
function rotearPorPalavrasChave(mensagem: string): EscolhaFerramenta | null {
  const msg = mensagem.toLowerCase()

  if (/amarelo|vermelho|pend[eê]ncia/.test(msg)) {
    return { ferramenta: 'pendencias', parametros: {} }
  }

  if (/compar/.test(msg)) {
    const anos = anosEncontrados(msg)
    if (anos.length >= 2) {
      return {
        ferramenta: 'comparativoAnual',
        parametros: {
          anoA: anos[0],
          anoB: anos[1],
          mesFim: mesEncontrado(msg),
          motivo: /condena/.test(msg) ? 'CONDENAÇÃO' : undefined,
        },
      }
    }
  }

  if (/honor[aá]rio/.test(msg) && /m[eé]dia/.test(msg)) {
    const anos = anosEncontrados(msg)
    return {
      ferramenta: 'mediaHonorarios',
      parametros: {
        agruparPor: /ano/.test(msg) && !/[aá]rea/.test(msg) ? 'ano' : 'area',
        ano: anos[0] ?? (/este ano|ano atual/.test(msg) ? new Date().getFullYear() : undefined),
      },
    }
  }

  if (/ordem interna|realizado/.test(msg)) {
    const trimestre = trimestreEncontrado(msg)
    const anos = anosEncontrados(msg)
    return {
      ferramenta: 'realizadoAteMes',
      parametros: {
        ano: anos[0] ?? new Date().getFullYear(),
        mesInicio: trimestre?.[0],
        mesFim: trimestre?.[1] ?? mesEncontrado(msg),
        agruparPor: /ordem interna/.test(msg) ? 'ordemInterna' : 'mes',
      },
    }
  }

  if (/top|maiores/.test(msg) && /pasta/.test(msg)) {
    return { ferramenta: 'topPastas', parametros: { ano: anosEncontrados(msg)[0] } }
  }

  if (/quanto pagamos|total.*pago|pagamentos? total/.test(msg)) {
    return {
      ferramenta: 'totalPago',
      parametros: {
        ano: anosEncontrados(msg)[0],
        motivo: /condena/.test(msg) ? 'CONDENAÇÃO' : undefined,
      },
    }
  }

  return null
}

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

  /** Roteamento por palavras-chave (B11) — ignora `historico`/`ferramentas` de propósito:
   * não há modelo de verdade por trás, então não há contexto de conversa a interpretar nem
   * declarações de ferramenta a "ler"; a lista de ferramentas aceitas é a mesma fixa de
   * `DECLARACOES_FERRAMENTAS`, só repetida aqui via regex por nome. */
  async escolherFerramenta(
    mensagem: string,
    _historico: MensagemAgente[],
    _ferramentas: DeclaracaoFerramenta[],
  ): Promise<EscolhaFerramenta | null> {
    return rotearPorPalavrasChave(mensagem)
  }

  /** Lê o texto do PDF (gerado pelo B4 em docs/demo-pdfs/) e extrai por regex — não
   * é IA de verdade, mas funciona de forma determinística sem nenhuma credencial. */
  async extrairDocumento(tipo: TipoDocumentoExtracao, pdfBuffer: Buffer): Promise<DadosExtraidos> {
    const texto = await extrairTextoPdf(pdfBuffer)
    return tipo === 'GUIA' ? extrairGuia(texto) : extrairNf(texto)
  }
}
