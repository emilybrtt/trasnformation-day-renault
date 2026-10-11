#!/usr/bin/env tsx
/**
 * Gera os PDFs fictícios usados na demo (guias de boleto judicial e NFs de
 * honorários), para o B10 (extração por IA) ter algo determinístico para ler sem
 * precisar de nenhum documento real da Renault.
 *
 * As labels usadas aqui ("Beneficiário:", "Valor:" etc.) são o formato que o
 * MockLlm (B10) espera ao extrair por regex — mudar o texto aqui exige mudar o
 * extrator também.
 *
 * Uso: tsx scripts/gerar-pdfs-demo.ts
 */
import { createWriteStream, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEST_DIR = join(__dirname, '..', 'docs', 'demo-pdfs')

interface CampoGuia {
  beneficiarioNome: string
  beneficiarioCnpj: string
  numeroProcesso: string
  nossoNumero: string
  numeroDocumento: string
  dataDocumento: string
  dataVencimento: string
  valor: string
  linhaDigitavel: string
}

interface CampoNf {
  numeroNf: string
  cnpjPrestador: string
  nomePrestador: string
  dataEmissao: string
  valorServico: string
  valorLiquido: string
  descricao: string
}

function escreverGuia(caminho: string, campos: CampoGuia) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.pipe(createWriteStream(caminho))

  doc.fontSize(16).text('GUIA DE RECOLHIMENTO JUDICIAL (DEMONSTRAÇÃO FICTÍCIA)', { align: 'center' })
  doc.moveDown()
  doc.fontSize(10).fillColor('red').text('Documento fictício gerado para fins de demonstração — não é um documento oficial.', { align: 'center' })
  doc.fillColor('black').moveDown(2)

  doc.fontSize(12)
  doc.text(`Beneficiário: ${campos.beneficiarioNome}`)
  doc.text(`CNPJ: ${campos.beneficiarioCnpj}`)
  doc.text(`Número do processo: ${campos.numeroProcesso}`)
  doc.text(`Nosso número: ${campos.nossoNumero}`)
  doc.text(`Número do documento: ${campos.numeroDocumento}`)
  doc.text(`Data do documento: ${campos.dataDocumento}`)
  doc.text(`Vencimento: ${campos.dataVencimento}`)
  doc.text(`Valor: ${campos.valor}`)
  doc.moveDown()
  doc.fontSize(10).text(`Linha digitável: ${campos.linhaDigitavel}`)

  doc.end()
}

function escreverNf(caminho: string, campos: CampoNf) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.pipe(createWriteStream(caminho))

  doc.fontSize(16).text('NOTA FISCAL DE SERVIÇOS (DEMONSTRAÇÃO FICTÍCIA)', { align: 'center' })
  doc.moveDown()
  doc.fontSize(10).fillColor('red').text('Documento fictício gerado para fins de demonstração — não é um documento oficial.', { align: 'center' })
  doc.fillColor('black').moveDown(2)

  doc.fontSize(12)
  doc.text(`Nota Fiscal nº: ${campos.numeroNf}`)
  doc.text(`CNPJ do prestador: ${campos.cnpjPrestador}`)
  doc.text(`Prestador: ${campos.nomePrestador}`)
  doc.text(`Data de emissão: ${campos.dataEmissao}`)
  doc.text(`Valor do serviço: ${campos.valorServico}`)
  doc.text(`Valor líquido: ${campos.valorLiquido}`)
  doc.moveDown()
  doc.text(`Descrição: ${campos.descricao}`)

  doc.end()
}

function main() {
  mkdirSync(DEST_DIR, { recursive: true })

  escreverGuia(join(DEST_DIR, 'guia-1.pdf'), {
    beneficiarioNome: 'TRIBUNAL REGIONAL DO TRABALHO DA 9ª REGIÃO',
    beneficiarioCnpj: '03.141.166/0001-16',
    numeroProcesso: '0000075-84.2026.5.09.0122',
    nossoNumero: '202600014945',
    numeroDocumento: 'GRJ-00014945',
    dataDocumento: '22/09/2026',
    dataVencimento: '02/10/2026',
    valor: 'R$ 9.000,00',
    linhaDigitavel: '85810000009 00014945101 20260922014 09000000090000',
  })

  escreverGuia(join(DEST_DIR, 'guia-2.pdf'), {
    beneficiarioNome: 'TRIBUNAL REGIONAL FICTÍCIO DA 99ª REGIÃO (DEMO)',
    beneficiarioCnpj: '90.001.000/0001-00',
    numeroProcesso: '0000312-20.2026.5.99.0001',
    nossoNumero: '202600099312',
    numeroDocumento: 'GRJ-00099312',
    dataDocumento: '03/06/2026',
    dataVencimento: '13/06/2026',
    valor: 'R$ 15.500,00',
    linhaDigitavel: '85810000015 50099312201 20260603099 31200000155000',
  })

  escreverGuia(join(DEST_DIR, 'guia-3.pdf'), {
    beneficiarioNome: 'TRIBUNAL DE JUSTIÇA FICTÍCIO (DEMO)',
    beneficiarioCnpj: '90.002.000/0001-00',
    numeroProcesso: '0001145-55.2026.8.99.0001',
    nossoNumero: '202600078452',
    numeroDocumento: 'GRJ-00078452',
    dataDocumento: '11/03/2026',
    dataVencimento: '21/03/2026',
    valor: 'R$ 23.450,10',
    linhaDigitavel: '85810000023 45078452301 20260311078 45200002345010',
  })

  escreverNf(join(DEST_DIR, 'nf-1.pdf'), {
    numeroNf: '000001248',
    cnpjPrestador: '00.033.333/0001-17',
    nomePrestador: 'Escritório Gama Advogados (fictício)',
    dataEmissao: '15/04/2026',
    valorServico: 'R$ 6.200,00',
    valorLiquido: 'R$ 5.700,00',
    descricao: 'Honorários advocatícios — processo nº 0000421-10.2026.8.09.0001',
  })

  escreverNf(join(DEST_DIR, 'nf-2.pdf'), {
    numeroNf: '000001301',
    cnpjPrestador: '00.033.333/0001-17',
    nomePrestador: 'Escritório Gama Advogados (fictício)',
    dataEmissao: '15/09/2026',
    valorServico: 'R$ 72.000,00',
    valorLiquido: 'R$ 66.000,00',
    descricao: 'Honorários advocatícios — processo nº 0000998-77.2026.8.09.0001',
  })

  console.log(`✔ PDFs fictícios gerados em ${DEST_DIR}`)
}


main()
