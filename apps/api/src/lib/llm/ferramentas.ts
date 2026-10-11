/** Catálogo das ferramentas parametrizadas do assistente (B11) — a única forma de
 * o assistente ler dados: nunca SQL livre, nunca texto gerado "do nada" pelo LLM.
 * O LLM (Mock ou Gemini) só escolhe QUAL ferramenta chamar e COM QUAIS parâmetros;
 * quem executa a consulta é sempre `services/agente.ts`. */

export interface ParametroFerramenta {
  tipo: 'string' | 'number'
  descricao: string
  enum?: readonly string[]
}

export interface DeclaracaoFerramenta {
  nome: string
  descricao: string
  parametros: Record<string, ParametroFerramenta>
}

export interface MensagemAgente {
  papel: 'usuario' | 'assistente'
  texto: string
}

export interface EscolhaFerramenta {
  ferramenta: string
  parametros: Record<string, unknown>
}

export const DECLARACOES_FERRAMENTAS: DeclaracaoFerramenta[] = [
  {
    nome: 'totalPago',
    descricao: 'Total realizado (pago) no período, opcionalmente filtrado por ano, área ou motivo.',
    parametros: {
      ano: { tipo: 'number', descricao: 'Ano de referência (filtra por dataPagamento)' },
      area: { tipo: 'string', descricao: 'Área do lançamento (ex.: CÍVEL, CONSUMIDOR)' },
      motivo: { tipo: 'string', descricao: 'Motivo do lançamento (ex.: CONDENAÇÃO, ACORDO)' },
    },
  },
  {
    nome: 'comparativoAnual',
    descricao:
      'Compara o total realizado entre dois anos, do início do ano até um mês-limite opcional (cumulativo), ' +
      'opcionalmente filtrado por área ou motivo.',
    parametros: {
      anoA: { tipo: 'number', descricao: 'Primeiro ano a comparar' },
      anoB: { tipo: 'number', descricao: 'Segundo ano a comparar' },
      mesFim: { tipo: 'number', descricao: 'Mês final do período (1-12); default 12 (ano inteiro)' },
      area: { tipo: 'string', descricao: 'Área do lançamento' },
      motivo: { tipo: 'string', descricao: 'Motivo do lançamento' },
    },
  },
  {
    nome: 'mediaHonorarios',
    descricao: 'Soma e média de honorários (RC_HONORARIOS_NF) realizados, agrupados por área ou por ano.',
    parametros: {
      agruparPor: { tipo: 'string', descricao: 'Agrupamento', enum: ['area', 'ano'] },
      ano: { tipo: 'number', descricao: 'Restringe ao ano informado' },
    },
  },
  {
    nome: 'realizadoAteMes',
    descricao:
      'Total realizado num intervalo de meses de um ano, agrupado por mês, ordem interna, área ou motivo.',
    parametros: {
      ano: { tipo: 'number', descricao: 'Ano de referência' },
      mesInicio: { tipo: 'number', descricao: 'Mês inicial (1-12); default 1' },
      mesFim: { tipo: 'number', descricao: 'Mês final (1-12); default 12' },
      agruparPor: { tipo: 'string', descricao: 'Agrupamento', enum: ['mes', 'ordemInterna', 'area', 'motivo'] },
    },
  },
  {
    nome: 'topPastas',
    descricao: 'As pastas Projuris com maior valor total realizado.',
    parametros: {
      limite: { tipo: 'number', descricao: 'Quantidade de pastas a devolver; default 5' },
      ano: { tipo: 'number', descricao: 'Restringe ao ano informado' },
    },
  },
  {
    nome: 'pendencias',
    descricao: 'Lista as solicitações atualmente com semáforo AMARELO ou VERMELHO (pendências em aberto).',
    parametros: {},
  },
]
