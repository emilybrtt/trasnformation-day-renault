import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GuiaExtraida, NfExtraida } from '../extracao.js'
import { DECLARACOES_FERRAMENTAS } from '../ferramentas.js'
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

  describe('escolherFerramenta (roteamento por palavras-chave, B11)', () => {
    const llm = new MockLlm()

    it('"Quanto pagamos de condenações em 2026 até setembro, comparado com 2025?" → comparativoAnual', async () => {
      const escolha = await llm.escolherFerramenta(
        'Quanto pagamos de condenações em 2026 até setembro, comparado com 2025?',
        [],
        DECLARACOES_FERRAMENTAS,
      )
      expect(escolha).toEqual({
        ferramenta: 'comparativoAnual',
        parametros: { anoA: 2026, anoB: 2025, mesFim: 9, motivo: 'CONDENAÇÃO' },
      })
    })

    it('"Qual a média de honorários por área este ano?" → mediaHonorarios', async () => {
      const escolha = await llm.escolherFerramenta('Qual a média de honorários por área este ano?', [], DECLARACOES_FERRAMENTAS)
      expect(escolha?.ferramenta).toBe('mediaHonorarios')
      expect(escolha?.parametros.agruparPor).toBe('area')
      expect(escolha?.parametros.ano).toBe(new Date().getFullYear())
    })

    it('"Quais solicitações estão em amarelo ou vermelho agora?" → pendencias', async () => {
      const escolha = await llm.escolherFerramenta('Quais solicitações estão em amarelo ou vermelho agora?', [], DECLARACOES_FERRAMENTAS)
      expect(escolha).toEqual({ ferramenta: 'pendencias', parametros: {} })
    })

    it('"Gere o realizado por ordem interna do 3º trimestre" → realizadoAteMes', async () => {
      const escolha = await llm.escolherFerramenta('Gere o realizado por ordem interna do 3º trimestre', [], DECLARACOES_FERRAMENTAS)
      expect(escolha?.ferramenta).toBe('realizadoAteMes')
      expect(escolha?.parametros).toMatchObject({ mesInicio: 7, mesFim: 9, agruparPor: 'ordemInterna' })
    })

    it('devolve null quando nenhuma palavra-chave conhecida aparece', async () => {
      const escolha = await llm.escolherFerramenta('Qual é a capital da França?', [], DECLARACOES_FERRAMENTAS)
      expect(escolha).toBeNull()
    })
  })
})
