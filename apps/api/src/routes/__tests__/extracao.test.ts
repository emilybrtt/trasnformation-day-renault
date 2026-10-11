import { join } from 'node:path'
import PDFDocument from 'pdfkit'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { obterIdTokenDeTeste } from '../../test-helpers/emulatorAuth.js'

const semEmulador = !process.env.FIREBASE_AUTH_EMULATOR_HOST
const DEMO_PDFS = join(process.cwd(), 'docs', 'demo-pdfs')

function gerarPdfDeTeste(linhas: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument()
    const partes: Buffer[] = []
    doc.on('data', (p: Buffer) => partes.push(p))
    doc.on('end', () => resolve(Buffer.concat(partes)))
    doc.on('error', reject)
    for (const linha of linhas) doc.text(linha)
    doc.end()
  })
}

describe.skipIf(semEmulador)('POST /extracao (B10)', () => {
  const app = createApp()
  const uidEscritorio = 'test-ext-escritorio-uid'
  const uidGestor = 'test-ext-gestor-uid'
  const fornecedorId = 'test-ext-fornecedor'
  const CNPJ_FICTICIO_TESTE = '12345678000195' // só deste teste — nunca usado em seed/outro lugar

  let tokenEscritorio: string
  let tokenGestor: string

  beforeAll(async () => {
    await prisma.usuario.createMany({
      data: [
        { firebaseUid: uidEscritorio, nome: 'E', email: 'e@test-ext.gavve', perfil: 'ESCRITORIO' },
        { firebaseUid: uidGestor, nome: 'G', email: 'g@test-ext.gavve', perfil: 'GESTOR' },
      ],
      skipDuplicates: true,
    })
    await prisma.fornecedor.upsert({
      where: { id: fornecedorId },
      create: { id: fornecedorId, codigoSap: 'test-ext-90055', nome: 'Fornecedor de Teste', cnpj: CNPJ_FICTICIO_TESTE },
      update: {},
    })

    tokenEscritorio = await obterIdTokenDeTeste(uidEscritorio)
    tokenGestor = await obterIdTokenDeTeste(uidGestor)
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { firebaseUid: { in: [uidEscritorio, uidGestor] } } })
    await prisma.fornecedor.delete({ where: { id: fornecedorId } })
  })

  it('extrai os campos da guia real do B4', async () => {
    const res = await request(app)
      .post('/extracao')
      .set('Authorization', `Bearer ${tokenEscritorio}`)
      .field('tipo', 'GUIA')
      .attach('arquivo', join(DEMO_PDFS, 'guia-1.pdf'))

    expect(res.status).toBe(200)
    expect(res.body.sucesso).toBe(true)
    expect(res.body.dadosExtraidos.valor).toBe(9000)
  })

  it('sugere o fornecedor cadastrado cujo CNPJ bate com o extraído', async () => {
    const pdf = await gerarPdfDeTeste(['Beneficiário: Fornecedor de Teste', 'CNPJ: 12.345.678/0001-95', 'Valor: R$ 10,00'])
    const res = await request(app)
      .post('/extracao')
      .set('Authorization', `Bearer ${tokenEscritorio}`)
      .field('tipo', 'GUIA')
      .attach('arquivo', pdf, { filename: 'guia-teste.pdf', contentType: 'application/pdf' })

    expect(res.status).toBe(200)
    expect(res.body.dadosExtraidos.beneficiarioCnpj).toBe('12.345.678/0001-95')
    expect(res.body.fornecedorSugerido?.id).toBe(fornecedorId)
  })

  it('extrai os campos de uma NF (sem fornecedor cadastrado para o CNPJ)', async () => {
    const res = await request(app)
      .post('/extracao')
      .set('Authorization', `Bearer ${tokenEscritorio}`)
      .field('tipo', 'NF')
      .attach('arquivo', join(DEMO_PDFS, 'nf-1.pdf'))

    expect(res.status).toBe(200)
    expect(res.body.dadosExtraidos.numeroNf).toBe('000001248')
    expect(res.body.fornecedorSugerido).toBeNull()
  })

  it('400 para tipo inválido', async () => {
    const res = await request(app)
      .post('/extracao')
      .set('Authorization', `Bearer ${tokenEscritorio}`)
      .field('tipo', 'OUTRO')
      .attach('arquivo', join(DEMO_PDFS, 'guia-1.pdf'))
    expect(res.status).toBe(400)
  })

  it('400 para arquivo que não é PDF', async () => {
    const res = await request(app)
      .post('/extracao')
      .set('Authorization', `Bearer ${tokenEscritorio}`)
      .field('tipo', 'GUIA')
      .attach('arquivo', Buffer.from('não é pdf'), { filename: 'arquivo.txt', contentType: 'text/plain' })
    expect(res.status).toBe(400)
  })

  it('403 para GESTOR', async () => {
    const res = await request(app)
      .post('/extracao')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .field('tipo', 'GUIA')
      .attach('arquivo', join(DEMO_PDFS, 'guia-1.pdf'))
    expect(res.status).toBe(403)
  })
})
