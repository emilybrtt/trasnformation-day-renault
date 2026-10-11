import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { avaliarSolicitacao, validarEAtualizarAlertas } from '../validacoes.js'

describe('motor de validações (B7)', () => {
  const escritorioId = 'test-val-escritorio'
  const uid = 'test-val-usuario'
  const ano = 2032 // ano exclusivo dos testes

  beforeAll(async () => {
    await prisma.escritorio.upsert({
      where: { id: escritorioId },
      create: { id: escritorioId, nome: 'Escritório Validação', cnpj: '33333333000199' },
      update: {},
    })
    await prisma.usuario.upsert({
      where: { firebaseUid: uid },
      create: { firebaseUid: uid, nome: 'Usuário Validação', email: 'val@test-val.gavve', perfil: 'ESCRITORIO', escritorioId },
      update: {},
    })
    await prisma.deParaContabil.upsert({
      where: { area_motivo_ano: { area: 'VAL', motivo: 'VAL', ano } },
      create: { area: 'VAL', motivo: 'VAL', centroCusto: 'CC', contaContabil: 'CT', ordemInterna: 'OI', ano, ativo: true },
      update: {},
    })
  })

  afterAll(async () => {
    await prisma.solicitacao.deleteMany({ where: { escritorioId } })
    await prisma.historico.deleteMany({ where: { usuarioId: uid } })
    await prisma.usuario.delete({ where: { firebaseUid: uid } })
    await prisma.escritorio.delete({ where: { id: escritorioId } })
    await prisma.deParaContabil.deleteMany({ where: { area: 'VAL' } })
  })

  async function criarSolicitacao(opts: {
    tipoFluxo?: 'RBS_DD_GUIA' | 'RC_HONORARIOS_NF' | 'ANEXO_V_BAIXA' | 'ANEXO_V_ADIANTAMENTO'
    status?: 'RASCUNHO' | 'EM_CONFERENCIA' | 'PAGO'
    numeroDocumentoLbs?: string
    dataDocumento?: Date
    valorTotal?: number
    anexos?: { tipo: 'GUIA' | 'NF'; dadosExtraidos?: object }[]
    linhas: { pastaProjuris: string; area: string; motivo: string; valorPrincipal: number; valorJurosCorrecao?: number; valorTotalInformado?: number; comDePara?: boolean }[]
  }) {
    const linhas = opts.linhas.map((l) => ({
      pastaProjuris: l.pastaProjuris,
      area: l.comDePara === false ? 'SEM-DE-PARA' : l.area,
      motivo: l.comDePara === false ? 'SEM-DE-PARA' : l.motivo,
      valorPrincipal: l.valorPrincipal,
      valorJurosCorrecao: l.valorJurosCorrecao ?? 0,
      valorTotalInformado: l.valorTotalInformado,
      centroCusto: l.comDePara === false ? null : 'CC',
      contaContabil: l.comDePara === false ? null : 'CT',
      ordemInterna: l.comDePara === false ? null : 'OI',
    }))
    const valorTotal =
      opts.valorTotal ?? linhas.reduce((acc, l) => acc + l.valorPrincipal + l.valorJurosCorrecao, 0)

    return prisma.solicitacao.create({
      data: {
        tipoFluxo: opts.tipoFluxo ?? 'RBS_DD_GUIA',
        escritorioId,
        criadoPorId: uid,
        status: opts.status ?? 'RASCUNHO',
        formaPagamento: 'BOLETO',
        dataDocumento: opts.dataDocumento ?? new Date(`${ano}-06-15`),
        numeroDocumentoLbs: opts.numeroDocumentoLbs,
        valorTotal,
        observacao: '',
        lancamentos: { create: linhas },
        anexos: opts.anexos
          ? { create: opts.anexos.map((a) => ({ ...a, caminho: 'teste.pdf', nomeArquivo: 'teste.pdf' })) }
          : undefined,
      },
      include: { lancamentos: true },
    })
  }

  it('CAMPO_OBRIGATORIO: RBS_DD_GUIA sem anexo da guia', async () => {
    const sol = await criarSolicitacao({
      tipoFluxo: 'RBS_DD_GUIA',
      linhas: [{ pastaProjuris: '1', area: 'VAL', motivo: 'VAL', valorPrincipal: 100 }],
    })
    const alertas = await avaliarSolicitacao(sol.id)
    expect(alertas.some((a) => a.codigo === 'CAMPO_OBRIGATORIO' && a.severidade === 'VERMELHO')).toBe(true)
  })

  it('CAMPO_OBRIGATORIO: some quando o anexo da guia existe', async () => {
    const sol = await criarSolicitacao({
      tipoFluxo: 'RBS_DD_GUIA',
      anexos: [{ tipo: 'GUIA' }],
      linhas: [{ pastaProjuris: '2', area: 'VAL', motivo: 'VAL', valorPrincipal: 100 }],
    })
    const alertas = await avaliarSolicitacao(sol.id)
    expect(alertas.some((a) => a.codigo === 'CAMPO_OBRIGATORIO')).toBe(false)
  })

  it('DE_PARA_INEXISTENTE: área/motivo sem de-para cadastrado', async () => {
    const sol = await criarSolicitacao({
      anexos: [{ tipo: 'GUIA' }],
      linhas: [{ pastaProjuris: '3', area: 'X', motivo: 'Y', valorPrincipal: 100, comDePara: false }],
    })
    const alertas = await avaliarSolicitacao(sol.id)
    expect(alertas.some((a) => a.codigo === 'DE_PARA_INEXISTENTE' && a.severidade === 'VERMELHO')).toBe(true)
  })

  it('SOMA_DIVERGENTE: principal + juros ≠ valor total informado', async () => {
    const sol = await criarSolicitacao({
      anexos: [{ tipo: 'GUIA' }],
      linhas: [{ pastaProjuris: '4', area: 'VAL', motivo: 'VAL', valorPrincipal: 100, valorJurosCorrecao: 10, valorTotalInformado: 150 }],
    })
    const alertas = await avaliarSolicitacao(sol.id)
    expect(alertas.some((a) => a.codigo === 'SOMA_DIVERGENTE' && a.severidade === 'VERMELHO')).toBe(true)
  })

  it('SOMA_DIVERGENTE: não dispara dentro da tolerância de R$ 0,01', async () => {
    const sol = await criarSolicitacao({
      anexos: [{ tipo: 'GUIA' }],
      linhas: [{ pastaProjuris: '5', area: 'VAL', motivo: 'VAL', valorPrincipal: 100, valorJurosCorrecao: 10, valorTotalInformado: 110.01 }],
    })
    const alertas = await avaliarSolicitacao(sol.id)
    expect(alertas.some((a) => a.codigo === 'SOMA_DIVERGENTE')).toBe(false)
  })

  it('DIVERGENCIA_VALOR_DOC: valor lançado diverge do extraído do documento', async () => {
    const sol = await criarSolicitacao({
      anexos: [{ tipo: 'GUIA', dadosExtraidos: { valor: 500 } }],
      linhas: [{ pastaProjuris: '6', area: 'VAL', motivo: 'VAL', valorPrincipal: 100 }],
    })
    const alertas = await avaliarSolicitacao(sol.id)
    expect(alertas.some((a) => a.codigo === 'DIVERGENCIA_VALOR_DOC' && a.severidade === 'AMARELO')).toBe(true)
  })

  it('DUPLICIDADE: mesma pasta + motivo + valor dentro de 180 dias', async () => {
    await criarSolicitacao({
      anexos: [{ tipo: 'GUIA' }],
      dataDocumento: new Date(`${ano}-03-01`),
      linhas: [{ pastaProjuris: '14945-dup', area: 'VAL', motivo: 'VAL', valorPrincipal: 777 }],
    })
    const segunda = await criarSolicitacao({
      anexos: [{ tipo: 'GUIA' }],
      dataDocumento: new Date(`${ano}-04-01`),
      linhas: [{ pastaProjuris: '14945-dup', area: 'VAL', motivo: 'VAL', valorPrincipal: 777 }],
    })
    const alertas = await avaliarSolicitacao(segunda.id)
    expect(alertas.some((a) => a.codigo === 'DUPLICIDADE' && a.severidade === 'AMARELO')).toBe(true)
  })

  it('DUPLICIDADE: mesmo número de documento em outra solicitação', async () => {
    await criarSolicitacao({
      anexos: [{ tipo: 'GUIA' }],
      numeroDocumentoLbs: 'DOC-DUP-1',
      linhas: [{ pastaProjuris: '7', area: 'VAL', motivo: 'VAL', valorPrincipal: 50 }],
    })
    const segunda = await criarSolicitacao({
      anexos: [{ tipo: 'GUIA' }],
      numeroDocumentoLbs: 'DOC-DUP-1',
      linhas: [{ pastaProjuris: '8', area: 'VAL', motivo: 'VAL', valorPrincipal: 999 }],
    })
    const alertas = await avaliarSolicitacao(segunda.id)
    expect(alertas.some((a) => a.codigo === 'DUPLICIDADE' && a.lancamentoId === null)).toBe(true)
  })

  it('VALOR_ATIPICO: só dispara com amostra suficiente e valor > média + 3σ', async () => {
    for (const valor of [100, 110, 90]) {
      await criarSolicitacao({
        anexos: [{ tipo: 'GUIA' }],
        linhas: [{ pastaProjuris: 'atipico', area: 'VAL-ATIPICO', motivo: 'VAL-ATIPICO', valorPrincipal: valor, comDePara: false }],
      })
    }
    const outlier = await criarSolicitacao({
      anexos: [{ tipo: 'GUIA' }],
      linhas: [{ pastaProjuris: 'atipico', area: 'VAL-ATIPICO', motivo: 'VAL-ATIPICO', valorPrincipal: 100000, comDePara: false }],
    })
    const alertas = await avaliarSolicitacao(outlier.id)
    expect(alertas.some((a) => a.codigo === 'VALOR_ATIPICO' && a.severidade === 'AMARELO')).toBe(true)
  })

  it('SALDO_ADIANTAMENTO: baixa maior que o saldo adiantado', async () => {
    await criarSolicitacao({
      tipoFluxo: 'ANEXO_V_ADIANTAMENTO',
      status: 'PAGO',
      anexos: [{ tipo: 'GUIA' }],
      valorTotal: 1000,
      linhas: [{ pastaProjuris: '9', area: 'VAL', motivo: 'VAL', valorPrincipal: 1000 }],
    })
    const baixa = await criarSolicitacao({
      tipoFluxo: 'ANEXO_V_BAIXA',
      anexos: [{ tipo: 'GUIA' }],
      valorTotal: 1500,
      linhas: [{ pastaProjuris: '10', area: 'VAL', motivo: 'VAL', valorPrincipal: 1500 }],
    })
    const alertas = await avaliarSolicitacao(baixa.id)
    expect(alertas.some((a) => a.codigo === 'SALDO_ADIANTAMENTO' && a.severidade === 'VERMELHO')).toBe(true)
  })

  it('SALDO_ADIANTAMENTO: não dispara quando a baixa cabe no saldo', async () => {
    await criarSolicitacao({
      tipoFluxo: 'ANEXO_V_ADIANTAMENTO',
      status: 'PAGO',
      anexos: [{ tipo: 'GUIA' }],
      valorTotal: 5000,
      linhas: [{ pastaProjuris: '11', area: 'VAL', motivo: 'VAL', valorPrincipal: 5000 }],
    })
    const baixa = await criarSolicitacao({
      tipoFluxo: 'ANEXO_V_BAIXA',
      anexos: [{ tipo: 'GUIA' }],
      valorTotal: 1000,
      linhas: [{ pastaProjuris: '12', area: 'VAL', motivo: 'VAL', valorPrincipal: 1000 }],
    })
    const alertas = await avaliarSolicitacao(baixa.id)
    expect(alertas.some((a) => a.codigo === 'SALDO_ADIANTAMENTO')).toBe(false)
  })

  describe('validarEAtualizarAlertas (persistência)', () => {
    it('grava os alertas e atualiza o semáforo do lançamento', async () => {
      const sol = await criarSolicitacao({
        linhas: [{ pastaProjuris: '13', area: 'X', motivo: 'Y', valorPrincipal: 10, comDePara: false }],
      })
      await validarEAtualizarAlertas(sol.id)

      const alertas = await prisma.alerta.findMany({ where: { solicitacaoId: sol.id } })
      expect(alertas.some((a) => a.codigo === 'DE_PARA_INEXISTENTE')).toBe(true)

      const lancamento = await prisma.lancamento.findUnique({ where: { id: sol.lancamentos[0].id } })
      expect(lancamento?.semaforo).toBe('VERMELHO')
    })

    it('ao rodar de novo, remove alertas abertos obsoletos mas preserva os já resolvidos', async () => {
      const sol = await criarSolicitacao({
        anexos: [{ tipo: 'GUIA' }],
        linhas: [{ pastaProjuris: '14', area: 'VAL', motivo: 'VAL', valorPrincipal: 100 }],
      })
      await prisma.alerta.create({
        data: { solicitacaoId: sol.id, codigo: 'MANUAL_RESOLVIDO', severidade: 'AMARELO', mensagem: 'x', resolvidoEm: new Date(), resolvidoPorId: uid, justificativa: 'ok' },
      })

      await validarEAtualizarAlertas(sol.id)

      const alertas = await prisma.alerta.findMany({ where: { solicitacaoId: sol.id } })
      expect(alertas.some((a) => a.codigo === 'MANUAL_RESOLVIDO')).toBe(true)
      expect(alertas.filter((a) => !a.resolvidoEm)).toHaveLength(0)
    })
  })
})
