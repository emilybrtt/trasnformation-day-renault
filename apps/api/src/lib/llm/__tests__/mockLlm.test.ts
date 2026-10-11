import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GuiaExtraida, NfExtraida } from '../extracao.js'
import { MockLlm } from '../mockLlm.js'

describe('MockLlm', () => {
  it('é determinístico para o mesmo prompt', async () => {
    const llm = new MockLlm()
    const a = await llm.gerarTexto('quanto pagamos em 2026?')
    const b = await llm.gerarTexto('quanto pagamos em 2026?')
    expect(a).toBe(b)
    expect(a).toContain('quanto pagamos em 2026?')
  })

  describe('extrairDocumento (lendo os PDFs fictícios do B4)', () => {
    const DEMO_PDFS = join(process.cwd(), 'docs', 'demo-pdfs')

    it('extrai os campos de guia-1.pdf', async () => {
      const buffer = await readFile(join(DEMO_PDFS, 'guia-1.pdf'))
      const dados = (await new MockLlm().extrairDocumento('GUIA', buffer)) as GuiaExtraida

      expect(dados.beneficiarioNome).toBe('TRIBUNAL REGIONAL DO TRABALHO DA 9ª REGIÃO')
      expect(dados.beneficiarioCnpj).toBe('03.141.166/0001-16')
      expect(dados.numeroProcesso).toBe('0000075-84.2026.5.09.0122')
      expect(dados.dataVencimento).toBe('02/10/2026')
      expect(dados.valor).toBe(9000)
    })

    it('extrai os campos de nf-1.pdf', async () => {
      const buffer = await readFile(join(DEMO_PDFS, 'nf-1.pdf'))
      const dados = (await new MockLlm().extrairDocumento('NF', buffer)) as NfExtraida

      expect(dados.numeroNf).toBe('000001248')
      expect(dados.cnpjPrestador).toBe('00.033.333/0001-17')
      expect(dados.nomePrestador).toBe('Escritório Gama Advogados (fictício)')
      expect(dados.valorServico).toBe(6200)
      expect(dados.valorLiquido).toBe(5700)
    })
  })
})
