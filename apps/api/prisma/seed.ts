#!/usr/bin/env tsx
/**
 * Seed de demonstração — todos os dados (exceto os códigos contábeis do de-para,
 * que são reais) são fictícios: nomes de escritórios, fornecedores, pastas e valores.
 * Idempotente para o cadastro de referência (upsert por chave fixa); a parte de
 * solicitações/lançamentos é recriada do zero a cada execução (deleteMany + insert),
 * com uma RNG determinística — por isso os números não mudam entre execuções.
 */
import { PrismaClient } from '@prisma/client'
import type { FormaPagamento, StatusSolicitacao, TipoFluxo } from '@prisma/client'

const prisma = new PrismaClient()

// --- RNG determinística (mulberry32) para a demo ser reprodutível ---
function criarRng(seed: number) {
  let estado = seed
  return function rand() {
    estado |= 0
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = criarRng(20260911)
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
const randMoeda = (min: number, max: number) => Number((rand() * (max - min) + min).toFixed(2))
function escolher<T>(opções: readonly T[]): T {
  return opções[randInt(0, opções.length - 1)]
}
function escolherPonderado<T>(opções: readonly [T, number][]): T {
  const total = opções.reduce((acc, [, peso]) => acc + peso, 0)
  let alvo = rand() * total
  for (const [valor, peso] of opções) {
    if (alvo < peso) return valor
    alvo -= peso
  }
  return opções[opções.length - 1][0]
}
function pastaAleatoria(): string {
  return String(randInt(10000, 99999))
}

// --- gerador de CNPJ fictício, com dígitos verificadores válidos ---
function calcularDigitoCnpj(digitos: number[], pesos: number[]): number {
  const soma = digitos.reduce((acc, d, i) => acc + d * pesos[i], 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}
function gerarCnpjFicticio(raizNumerica: number): string {
  const raiz = String(raizNumerica).padStart(8, '0').slice(0, 8)
  const filial = '0001'
  const doze = `${raiz}${filial}`.split('').map(Number)
  const d1 = calcularDigitoCnpj(doze, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const treze = [...doze, d1]
  const d2 = calcularDigitoCnpj(treze, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return `${raiz}${filial}${d1}${d2}`
}

function dataAleatoria(deAno = 2025, deMes = 0, ateAno = 2026, ateMes = 9, ateDia = 11): Date {
  const inicio = new Date(deAno, deMes, 1).getTime()
  const fim = new Date(ateAno, ateMes, ateDia).getTime()
  return new Date(inicio + rand() * (fim - inicio))
}
function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * 24 * 60 * 60 * 1000)
}
function numeroChamadoAleatorio(): string {
  return `BR-${String(randInt(100000, 999999))}`
}
function numeroAleatorio(prefixo: string): string {
  return `${prefixo}${String(randInt(10000000, 99999999))}`
}
function protocoloAleatorio(): string {
  return `PROT-${String(randInt(100000, 999999))}`
}

/** Campos das integrações do fluxo RC_HONORARIOS_NF (F12) — cada etapa alcançada
 * implica as anteriores também terem acontecido. */
function camposIntegracaoRc(status: StatusSolicitacao) {
  const atingiuRc = (['RC_CRIADO', 'NF_LANCADA', 'PAGAMENTO_PROGRAMADO', 'PAGO'] as StatusSolicitacao[]).includes(status)
  const atingiuNf = (['NF_LANCADA', 'PAGAMENTO_PROGRAMADO', 'PAGO'] as StatusSolicitacao[]).includes(status)
  const atingiuPagtoProgramado = (['PAGAMENTO_PROGRAMADO', 'PAGO'] as StatusSolicitacao[]).includes(status)
  return {
    numeroRc: atingiuRc ? numeroAleatorio('RC') : null,
    protocoloNf: atingiuNf ? protocoloAleatorio() : null,
    numeroDocumentoSap: atingiuPagtoProgramado ? numeroAleatorio('DOC') : null,
  }
}

// --- de-para contábil (seção 1 do CONTEXT.md) ---
// Os códigos de 2025 são os reais do briefing. Os de 2026 são uma extrapolação
// fictícia (troca dos 2 últimos caracteres da ordem interna por "26") só para a
// demo mostrar que a "zedoa" muda a cada ano — ver docs/DECISOES.md.
const DE_PARA_BASE = [
  { area: 'CONSUMIDOR', motivo: 'PROJETO SAC', centroCusto: 'GI85032', contaContabil: '681554', ordemInterna: 'ZDOA00429016' },
  { area: 'CONSUMIDOR', motivo: 'ACORDO', centroCusto: 'GI85032', contaContabil: '681554', ordemInterna: 'ZDOA00429018' },
  { area: 'CONSUMIDOR', motivo: 'CONDENAÇÃO/CUSTAS', centroCusto: 'GI85032', contaContabil: '681554', ordemInterna: 'ZDOA00003018' },
  { area: 'CÍVEL', motivo: 'CONDENAÇÃO/CUSTAS', centroCusto: 'GI85163', contaContabil: '681554', ordemInterna: 'ZDOA00003018' },
  { area: 'REDE', motivo: 'CONDENAÇÃO/CUSTAS', centroCusto: 'GI85162', contaContabil: '681554', ordemInterna: 'ZDOA00003018' },
  { area: 'TRABALHISTA PIF/PDV', motivo: 'CONDENAÇÃO', centroCusto: 'GI85031', contaContabil: '681580', ordemInterna: 'ZDOACONPIF24' },
] as const

function ordemInternaParaAno(ordemInterna: string, ano: number): string {
  if (ano === 2025) return ordemInterna
  return `${ordemInterna.slice(0, -2)}26`
}

type DeParaResolvido = { centroCusto: string; contaContabil: string; ordemInterna: string | null }
function resolverDePara(mapa: Map<string, DeParaResolvido>, area: string, motivo: string, ano: number) {
  return mapa.get(`${area}|${motivo}|${ano}`) ?? null
}

async function seedReferencia() {
  const mapa = new Map<string, DeParaResolvido>()
  for (const ano of [2025, 2026]) {
    for (const linha of DE_PARA_BASE) {
      const ordemInterna = ordemInternaParaAno(linha.ordemInterna, ano)
      await prisma.deParaContabil.upsert({
        where: { area_motivo_ano: { area: linha.area, motivo: linha.motivo, ano } },
        create: { ...linha, ordemInterna, ano, ativo: true },
        update: { centroCusto: linha.centroCusto, contaContabil: linha.contaContabil, ordemInterna, ativo: true },
      })
      mapa.set(`${linha.area}|${linha.motivo}|${ano}`, {
        centroCusto: linha.centroCusto,
        contaContabil: linha.contaContabil,
        ordemInterna,
      })
    }
  }

  await prisma.configuracaoChamado.upsert({
    where: { id: 'config-rbs-dd-padrao' },
    create: {
      id: 'config-rbs-dd-padrao',
      empresaAprovadora: '0483',
      empresaConsumidora: '0483',
      nomeSolicitante: 'Pagamentos Jurídico',
      naturezaGasto: '0007 - Acts and…',
      classificacao: 'Despesas administrativas (Centro de Custo)',
      alocacao: '0007 - 622700 - CUSTOS DE ATOS E LITÍGIOS',
      ceCuAprovador: 'GI52000',
      ativo: true,
    },
    update: {},
  })

  const fornecedores = [
    { id: 'fornecedor-trt9', codigoSap: '40761', nome: 'TRIBUNAL REGIONAL DO TRABALHO DA 9ª REGIÃO', cnpj: '03141166000116' },
    { id: 'fornecedor-ficticio-1', codigoSap: '90001', nome: 'TRIBUNAL REGIONAL FICTÍCIO DA 99ª REGIÃO (DEMO)', cnpj: gerarCnpjFicticio(90001) },
    { id: 'fornecedor-ficticio-2', codigoSap: '90002', nome: 'TRIBUNAL DE JUSTIÇA FICTÍCIO (DEMO)', cnpj: gerarCnpjFicticio(90002) },
    { id: 'fornecedor-ficticio-3', codigoSap: '90003', nome: 'TRIBUNAL REGIONAL FEDERAL FICTÍCIO (DEMO)', cnpj: gerarCnpjFicticio(90003) },
  ]
  for (const f of fornecedores) {
    await prisma.fornecedor.upsert({ where: { id: f.id }, create: f, update: f })
  }

  const escritorios = [
    { id: 'escritorio-alfa', nome: 'Escritório Alfa Advogados Associados (fictício)', cnpj: gerarCnpjFicticio(11111) },
    { id: 'escritorio-beta', nome: 'Escritório Beta Sociedade de Advocacia (fictício)', cnpj: gerarCnpjFicticio(22222) },
    { id: 'escritorio-gama', nome: 'Escritório Gama Advogados (fictício)', cnpj: gerarCnpjFicticio(33333) },
  ]
  for (const e of escritorios) {
    await prisma.escritorio.upsert({ where: { id: e.id }, create: e, update: e })
  }

  const usuarios = [
    { firebaseUid: 'demo-escritorio', nome: 'Escritório Alfa (demo)', email: 'escritorio@demo.gavve', perfil: 'ESCRITORIO' as const, escritorioId: 'escritorio-alfa' },
    { firebaseUid: 'demo-analista', nome: 'Natiele (demo)', email: 'analista@demo.gavve', perfil: 'ANALISTA' as const, escritorioId: null },
    { firebaseUid: 'demo-gestor', nome: 'Gestor (demo)', email: 'gestor@demo.gavve', perfil: 'GESTOR' as const, escritorioId: null },
    { firebaseUid: 'seed-escritorio-beta', nome: 'Escritório Beta (seed)', email: 'contato@beta.demo.gavve', perfil: 'ESCRITORIO' as const, escritorioId: 'escritorio-beta' },
    { firebaseUid: 'seed-escritorio-gama', nome: 'Escritório Gama (seed)', email: 'contato@gama.demo.gavve', perfil: 'ESCRITORIO' as const, escritorioId: 'escritorio-gama' },
  ]
  for (const u of usuarios) {
    await prisma.usuario.upsert({ where: { firebaseUid: u.firebaseUid }, create: u, update: u })
  }

  return { mapa, fornecedores, escritorios, usuarios }
}

interface LinhaLancamento {
  pastaProjuris: string
  area: string
  motivo: string
  valorPrincipal: number
  valorJurosCorrecao: number
}

async function criarSolicitacao(opts: {
  tipoFluxo: TipoFluxo
  escritorioId: string
  criadoPorId: string
  fornecedorId?: string
  status: StatusSolicitacao
  formaPagamento: FormaPagamento
  dataDocumento: Date
  dataPagamento?: Date | null
  numeroChamado?: string | null
  numeroRc?: string | null
  protocoloNf?: string | null
  numeroDocumentoSap?: string | null
  observacao?: string
  linhas: LinhaLancamento[]
  mapa: Map<string, DeParaResolvido>
  ano: number
  alertas?: { lancamentoIndex: number | null; codigo: string; severidade: 'AMARELO' | 'VERMELHO'; mensagem: string }[]
  anexos?: { tipo: 'GUIA' | 'NF' | 'COMPROVANTE'; caminho: string; nomeArquivo: string; dadosExtraidos?: object }[]
}) {
  const valorTotal = opts.linhas.reduce((acc, l) => acc + l.valorPrincipal + l.valorJurosCorrecao, 0)

  const solicitacao = await prisma.solicitacao.create({
    data: {
      tipoFluxo: opts.tipoFluxo,
      escritorioId: opts.escritorioId,
      criadoPorId: opts.criadoPorId,
      fornecedorId: opts.fornecedorId,
      status: opts.status,
      formaPagamento: opts.formaPagamento,
      dataDocumento: opts.dataDocumento,
      dataPagamento: opts.dataPagamento ?? null,
      dataPrevistaPagamento:
        opts.status === 'RASCUNHO' ? null : somarDias(opts.dataDocumento, randInt(10, 20)),
      numeroChamado: opts.numeroChamado ?? null,
      numeroRc: opts.numeroRc ?? null,
      protocoloNf: opts.protocoloNf ?? null,
      numeroDocumentoSap: opts.numeroDocumentoSap ?? null,
      observacao: opts.observacao ?? '',
      valorTotal: Number(valorTotal.toFixed(2)),
    },
  })

  const lancamentos = []
  for (const linha of opts.linhas) {
    const resolvido = resolverDePara(opts.mapa, linha.area, linha.motivo, opts.ano)
    const lancamento = await prisma.lancamento.create({
      data: {
        solicitacaoId: solicitacao.id,
        pastaProjuris: linha.pastaProjuris,
        area: linha.area,
        motivo: linha.motivo,
        valorPrincipal: linha.valorPrincipal,
        valorJurosCorrecao: linha.valorJurosCorrecao,
        centroCusto: resolvido?.centroCusto ?? null,
        contaContabil: resolvido?.contaContabil ?? null,
        ordemInterna: resolvido?.ordemInterna ?? null,
        semaforo: resolvido ? 'VERDE' : 'VERMELHO',
      },
    })
    lancamentos.push(lancamento)
  }

  for (const anexo of opts.anexos ?? []) {
    await prisma.anexo.create({
      data: {
        solicitacaoId: solicitacao.id,
        tipo: anexo.tipo,
        caminho: anexo.caminho,
        nomeArquivo: anexo.nomeArquivo,
        dadosExtraidos: anexo.dadosExtraidos,
      },
    })
  }

  for (const alerta of opts.alertas ?? []) {
    const lancamentoId = alerta.lancamentoIndex == null ? null : lancamentos[alerta.lancamentoIndex].id
    await prisma.alerta.create({
      data: {
        solicitacaoId: solicitacao.id,
        lancamentoId,
        codigo: alerta.codigo,
        severidade: alerta.severidade,
        mensagem: alerta.mensagem,
      },
    })
    if (lancamentoId) {
      await prisma.lancamento.update({ where: { id: lancamentoId }, data: { semaforo: alerta.severidade } })
    }
  }

  return solicitacao
}

const MOTIVOS_VALIDOS = [
  { area: 'CONSUMIDOR', motivo: 'PROJETO SAC' },
  { area: 'CONSUMIDOR', motivo: 'ACORDO' },
  { area: 'CONSUMIDOR', motivo: 'CONDENAÇÃO/CUSTAS' },
  { area: 'CÍVEL', motivo: 'CONDENAÇÃO/CUSTAS' },
  { area: 'REDE', motivo: 'CONDENAÇÃO/CUSTAS' },
  { area: 'TRABALHISTA PIF/PDV', motivo: 'CONDENAÇÃO' },
] as const

function gerarValorLinha(motivo: string): { principal: number; juros: number } {
  const éAcordoOuCondenação = motivo === 'ACORDO' || motivo === 'PROJETO SAC' || motivo === 'CONDENAÇÃO'
  const comoCusta = motivo === 'CONDENAÇÃO/CUSTAS' && rand() < 0.5

  if (comoCusta) {
    return { principal: randMoeda(2, 5000), juros: 0 }
  }
  const principal = motivo === 'ACORDO' || motivo === 'PROJETO SAC' ? randMoeda(3000, 110000) : randMoeda(3000, 150000)
  const juros = éAcordoOuCondenação || motivo === 'CONDENAÇÃO/CUSTAS' ? Number((principal * randMoeda(0.01, 0.6)).toFixed(2)) : 0
  return { principal, juros }
}

async function seedSolicitacoesAleatorias(ctx: Awaited<ReturnType<typeof seedReferencia>>) {
  const escritoriosCiclo = [
    { id: 'escritorio-alfa', criadoPorId: 'demo-escritorio', peso: 5 },
    { id: 'escritorio-beta', criadoPorId: 'seed-escritorio-beta', peso: 3 },
    { id: 'escritorio-gama', criadoPorId: 'seed-escritorio-gama', peso: 2 },
  ] as const
  const fornecedoresIds = ctx.fornecedores.map((f) => f.id)

  // ANEXO_V e RBS_DD: Conferido → chamado (SSC/LBS) → Pago. RC_HONORARIOS tem 3
  // passos de integração próprios (RC → NF 0800 → pagamento programado no SAP),
  // por isso usa um ciclo de status diferente (F12).
  const STATUS_CICLO_CHAMADO: readonly [StatusSolicitacao, number][] = [
    ['PAGO', 40],
    ['APROVADO', 10],
    ['CHAMADO_ABERTO', 10],
    ['EM_CONFERENCIA', 15],
    ['ENVIADO', 10],
    ['RASCUNHO', 5],
    ['DEVOLVIDO', 5],
    ['CANCELADO', 5],
  ]
  const STATUS_CICLO_RC: readonly [StatusSolicitacao, number][] = [
    ['PAGO', 35],
    ['PAGAMENTO_PROGRAMADO', 8],
    ['NF_LANCADA', 8],
    ['RC_CRIADO', 8],
    ['APROVADO', 6],
    ['EM_CONFERENCIA', 15],
    ['ENVIADO', 10],
    ['RASCUNHO', 5],
    ['DEVOLVIDO', 5],
    ['CANCELADO', 5],
  ]
  const TIPO_FLUXO_CICLO: readonly [TipoFluxo, number][] = [
    ['RBS_DD_GUIA', 40],
    ['ANEXO_V_BAIXA', 35],
    ['ANEXO_V_ADIANTAMENTO', 10],
    ['ANEXO_V_REEMBOLSO', 10],
    ['RC_HONORARIOS_NF', 5],
  ]

  for (let i = 0; i < 185; i++) {
    const { area, motivo } = escolher(MOTIVOS_VALIDOS)
    const dataDocumento = dataAleatoria()
    const ano = dataDocumento.getFullYear()
    const escritorio = escolherPonderado(escritoriosCiclo.map((e) => [e, e.peso] as [typeof e, number]))
    const tipoFluxo = escolherPonderado(TIPO_FLUXO_CICLO)
    const status = escolherPonderado(tipoFluxo === 'RC_HONORARIOS_NF' ? STATUS_CICLO_RC : STATUS_CICLO_CHAMADO)
    const { principal, juros } = gerarValorLinha(motivo)

    const dataPagamento =
      status === 'PAGO'
        ? new Date(Math.min(somarDias(dataDocumento, randInt(5, 45)).getTime(), dataAleatoria(2026, 9, 2026, 9, 11).getTime()))
        : null

    const anexos =
      tipoFluxo === 'RBS_DD_GUIA'
        ? [{ tipo: 'GUIA' as const, caminho: `demo-pdfs/guia-${randInt(1, 3)}.pdf`, nomeArquivo: `guia-judicial-${randInt(1, 3)}.pdf` }]
        : tipoFluxo === 'RC_HONORARIOS_NF'
          ? [{ tipo: 'NF' as const, caminho: `demo-pdfs/nf-${randInt(1, 2)}.pdf`, nomeArquivo: `nf-honorarios-${randInt(1, 2)}.pdf` }]
          : []

    await criarSolicitacao({
      tipoFluxo,
      escritorioId: escritorio.id,
      criadoPorId: escritorio.criadoPorId,
      fornecedorId: tipoFluxo === 'RBS_DD_GUIA' ? escolher(fornecedoresIds) : undefined,
      status,
      formaPagamento: escolherPonderado([
        ['BOLETO', 60],
        ['DEPOSITO_JUDICIAL', 20],
        ['TED', 20],
      ]),
      dataDocumento,
      dataPagamento,
      numeroChamado:
        tipoFluxo !== 'RC_HONORARIOS_NF' && (status === 'CHAMADO_ABERTO' || status === 'PAGO')
          ? numeroChamadoAleatorio()
          : null,
      ...(tipoFluxo === 'RC_HONORARIOS_NF' ? camposIntegracaoRc(status) : {}),
      linhas: [{ pastaProjuris: pastaAleatoria(), area, motivo, valorPrincipal: principal, valorJurosCorrecao: juros }],
      mapa: ctx.mapa,
      ano,
      anexos,
    })
  }
}

/** Os 5 casos propositais descritos no briefing (B4), para a demo funcionar sem
 *  depender ainda do motor de validação (B7) — quando o B7 existir, ele recalcula
 *  os mesmos alertas ao reabrir/reenviar a solicitação. */
async function seedCasosPropositais(ctx: Awaited<ReturnType<typeof seedReferencia>>) {
  // 1) DUPLICIDADE — mesma pasta + mesmo par principal/juros, 3x.
  const dataBase = new Date(2026, 8, 22) // 22/09/2026
  for (let i = 0; i < 3; i++) {
    const solicitacao = await criarSolicitacao({
      tipoFluxo: 'RBS_DD_GUIA',
      escritorioId: 'escritorio-alfa',
      criadoPorId: 'demo-escritorio',
      fornecedorId: 'fornecedor-trt9',
      status: 'EM_CONFERENCIA',
      formaPagamento: 'BOLETO',
      dataDocumento: somarDias(dataBase, i),
      linhas: [
        {
          pastaProjuris: '14945',
          area: 'TRABALHISTA PIF/PDV',
          motivo: 'CONDENAÇÃO',
          valorPrincipal: 4410.64,
          valorJurosCorrecao: 4589.36,
        },
      ],
      mapa: ctx.mapa,
      ano: 2026,
      anexos: [{ tipo: 'GUIA', caminho: 'demo-pdfs/guia-1.pdf', nomeArquivo: 'guia-judicial-1.pdf' }],
      alertas:
        i === 0
          ? []
          : [
              {
                lancamentoIndex: 0,
                codigo: 'DUPLICIDADE',
                severidade: 'AMARELO',
                mensagem: 'Possível duplicidade: a pasta 14945 já tem R$ 4.410,64 (Condenação) em 22/09.',
              },
            ],
    })
    void solicitacao
  }

  // 2) DE_PARA_INEXISTENTE — área/motivo sem de-para cadastrado.
  await criarSolicitacao({
    tipoFluxo: 'ANEXO_V_BAIXA',
    escritorioId: 'escritorio-beta',
    criadoPorId: 'seed-escritorio-beta',
    status: 'EM_CONFERENCIA',
    formaPagamento: 'TED',
    dataDocumento: new Date(2026, 7, 10),
    linhas: [
      { pastaProjuris: pastaAleatoria(), area: 'IMOBILIÁRIO', motivo: 'OUTROS', valorPrincipal: 8200, valorJurosCorrecao: 0 },
    ],
    mapa: ctx.mapa,
    ano: 2026,
    alertas: [
      {
        lancamentoIndex: 0,
        codigo: 'DE_PARA_INEXISTENTE',
        severidade: 'VERMELHO',
        mensagem: 'Não existe de-para cadastrado para Área IMOBILIÁRIO + Motivo OUTROS em 2026.',
      },
    ],
  })

  // 3) DIVERGENCIA_VALOR_DOC — valor digitado ≠ valor extraído da guia pela IA.
  await criarSolicitacao({
    tipoFluxo: 'RBS_DD_GUIA',
    escritorioId: 'escritorio-alfa',
    criadoPorId: 'demo-escritorio',
    fornecedorId: 'fornecedor-ficticio-1',
    status: 'EM_CONFERENCIA',
    formaPagamento: 'BOLETO',
    dataDocumento: new Date(2026, 5, 3),
    linhas: [
      { pastaProjuris: pastaAleatoria(), area: 'CÍVEL', motivo: 'CONDENAÇÃO/CUSTAS', valorPrincipal: 15000, valorJurosCorrecao: 0 },
    ],
    mapa: ctx.mapa,
    ano: 2026,
    anexos: [
      {
        tipo: 'GUIA',
        caminho: 'demo-pdfs/guia-2.pdf',
        nomeArquivo: 'guia-judicial-2.pdf',
        dadosExtraidos: { valor: 15500.0, numeroProcesso: '0000075-84.2026.5.09.0122' },
      },
    ],
    alertas: [
      {
        lancamentoIndex: 0,
        codigo: 'DIVERGENCIA_VALOR_DOC',
        severidade: 'AMARELO',
        mensagem: 'Valor digitado (R$ 15.000,00) diverge do valor extraído da guia (R$ 15.500,00).',
      },
    ],
  })

  // 4) VALOR_ATIPICO — honorário ~10x acima da média dos demais honorários.
  const honorariosNormais = [6200, 7800, 5400, 8900]
  for (const valor of honorariosNormais) {
    await criarSolicitacao({
      tipoFluxo: 'RC_HONORARIOS_NF',
      escritorioId: 'escritorio-gama',
      criadoPorId: 'seed-escritorio-gama',
      status: 'PAGO',
      formaPagamento: 'TED',
      dataDocumento: dataAleatoria(2025, 0, 2026, 9, 11),
      dataPagamento: dataAleatoria(2025, 0, 2026, 9, 11),
      linhas: [
        { pastaProjuris: pastaAleatoria(), area: 'CÍVEL', motivo: 'CONDENAÇÃO/CUSTAS', valorPrincipal: valor, valorJurosCorrecao: 0 },
      ],
      mapa: ctx.mapa,
      ano: 2026,
      anexos: [{ tipo: 'NF', caminho: 'demo-pdfs/nf-1.pdf', nomeArquivo: 'nf-honorarios-1.pdf' }],
    })
  }
  await criarSolicitacao({
    tipoFluxo: 'RC_HONORARIOS_NF',
    escritorioId: 'escritorio-gama',
    criadoPorId: 'seed-escritorio-gama',
    status: 'EM_CONFERENCIA',
    formaPagamento: 'TED',
    dataDocumento: new Date(2026, 8, 15),
    linhas: [
      { pastaProjuris: pastaAleatoria(), area: 'CÍVEL', motivo: 'CONDENAÇÃO/CUSTAS', valorPrincipal: 72000, valorJurosCorrecao: 0 },
    ],
    mapa: ctx.mapa,
    ano: 2026,
    anexos: [{ tipo: 'NF', caminho: 'demo-pdfs/nf-2.pdf', nomeArquivo: 'nf-honorarios-2.pdf' }],
    alertas: [
      {
        lancamentoIndex: 0,
        codigo: 'VALOR_ATIPICO',
        severidade: 'AMARELO',
        mensagem: 'Honorário de R$ 72.000,00 está muito acima da média recente (~R$ 7.075,00) para Cível/Condenação-Custas.',
      },
    ],
  })

  // 5) SALDO_ADIANTAMENTO — baixa maior que o saldo adiantado ao escritório.
  await criarSolicitacao({
    tipoFluxo: 'ANEXO_V_ADIANTAMENTO',
    escritorioId: 'escritorio-beta',
    criadoPorId: 'seed-escritorio-beta',
    status: 'PAGO',
    formaPagamento: 'TED',
    dataDocumento: new Date(2026, 6, 1),
    dataPagamento: new Date(2026, 6, 5),
    linhas: [
      { pastaProjuris: pastaAleatoria(), area: 'CONSUMIDOR', motivo: 'ACORDO', valorPrincipal: 10000, valorJurosCorrecao: 0 },
    ],
    mapa: ctx.mapa,
    ano: 2026,
  })
  await criarSolicitacao({
    tipoFluxo: 'ANEXO_V_BAIXA',
    escritorioId: 'escritorio-beta',
    criadoPorId: 'seed-escritorio-beta',
    status: 'EM_CONFERENCIA',
    formaPagamento: 'TED',
    dataDocumento: new Date(2026, 8, 1),
    linhas: [
      { pastaProjuris: pastaAleatoria(), area: 'CONSUMIDOR', motivo: 'ACORDO', valorPrincipal: 15000, valorJurosCorrecao: 0 },
    ],
    mapa: ctx.mapa,
    ano: 2026,
    alertas: [
      {
        lancamentoIndex: 0,
        codigo: 'SALDO_ADIANTAMENTO',
        severidade: 'VERMELHO',
        mensagem: 'Baixa de R$ 15.000,00 é maior que o saldo adiantado ao Escritório Beta (R$ 10.000,00).',
      },
    ],
  })
}

async function main() {
  console.log('→ limpando solicitações anteriores (cascata para lançamentos/anexos/alertas)...')
  await prisma.solicitacao.deleteMany()

  console.log('→ cadastro de referência (de-para, fornecedores, escritórios, usuários)...')
  const ctx = await seedReferencia()

  console.log('→ ~185 solicitações/lançamentos aleatórios (determinísticos)...')
  await seedSolicitacoesAleatorias(ctx)

  console.log('→ 5 casos propositais para a demo...')
  await seedCasosPropositais(ctx)

  const total = await prisma.lancamento.count()
  console.log(`✔ seed concluído — ${total} lançamentos.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
