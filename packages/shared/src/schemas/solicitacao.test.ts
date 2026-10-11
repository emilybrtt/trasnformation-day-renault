import { describe, expect, it } from 'vitest'
import {
  abrirChamadoSchema,
  criarSolicitacaoSchema,
  devolverSolicitacaoSchema,
  linhaLancamentoSchema,
  resolverAlertaSchema,
} from './solicitacao.js'

describe('linhaLancamentoSchema', () => {
  it('aceita uma linha válida e aplica o default de juros', () => {
    const r = linhaLancamentoSchema.parse({
      pastaProjuris: '12345',
      area: 'CÍVEL',
      motivo: 'CONDENAÇÃO/CUSTAS',
      valorPrincipal: 1000,
    })
    expect(r.valorJurosCorrecao).toBe(0)
  })

  it('rejeita valorPrincipal <= 0', () => {
    expect(() =>
      linhaLancamentoSchema.parse({ pastaProjuris: '1', area: 'A', motivo: 'M', valorPrincipal: 0 }),
    ).toThrow()
  })

  it('rejeita pastaProjuris vazia', () => {
    expect(() =>
      linhaLancamentoSchema.parse({ pastaProjuris: '', area: 'A', motivo: 'M', valorPrincipal: 10 }),
    ).toThrow()
  })
})

describe('criarSolicitacaoSchema', () => {
  const base = {
    tipoFluxo: 'RBS_DD_GUIA' as const,
    formaPagamento: 'BOLETO' as const,
    dataDocumento: '2026-09-22',
    linhas: [{ pastaProjuris: '12345', area: 'CÍVEL', motivo: 'CONDENAÇÃO/CUSTAS', valorPrincipal: 1000 }],
  }

  it('aceita o payload mínimo e converte a data', () => {
    const r = criarSolicitacaoSchema.parse(base)
    expect(r.dataDocumento).toBeInstanceOf(Date)
  })

  it('exige ao menos uma linha', () => {
    expect(() => criarSolicitacaoSchema.parse({ ...base, linhas: [] })).toThrow()
  })

  it('rejeita tipoFluxo inválido', () => {
    expect(() => criarSolicitacaoSchema.parse({ ...base, tipoFluxo: 'INVALIDO' })).toThrow()
  })
})

describe('schemas de ação', () => {
  it('devolverSolicitacaoSchema exige comentário não vazio', () => {
    expect(() => devolverSolicitacaoSchema.parse({ comentario: '' })).toThrow()
    expect(devolverSolicitacaoSchema.parse({ comentario: 'Falta anexo' }).comentario).toBe('Falta anexo')
  })

  it('resolverAlertaSchema exige justificativa', () => {
    expect(() => resolverAlertaSchema.parse({ justificativa: '' })).toThrow()
  })

  it('abrirChamadoSchema exige número do chamado', () => {
    expect(() => abrirChamadoSchema.parse({ numeroChamado: '' })).toThrow()
  })
})
