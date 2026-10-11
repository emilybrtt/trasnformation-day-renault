#!/usr/bin/env node
/**
 * Automação do board "Transformation Day - Renault" no Trello.
 *
 * Uso:
 *   node scripts/trello.mjs start  <CODIGO>              # atribui a responsável e move para "Doing"
 *   node scripts/trello.mjs review <CODIGO> --pr <url>   # move para "Review" e comenta o link do PR
 *   node scripts/trello.mjs done   <CODIGO> --pr <url>   # move para "Done", marca como concluído e comenta
 *   node scripts/trello.mjs code-from-branch <branch>    # imprime o código do card (ex.: feat/B6-api -> B6)
 *
 * <CODIGO> é o prefixo do título do card: B1..B14, F1..F11, D1..D4, P1..P9.
 *
 * Variáveis de ambiente:
 *   TRELLO_KEY, TRELLO_TOKEN   (obrigatórias para start/review/done)
 *   TRELLO_BOARD_ID            (padrão: board do projeto)
 *   TRELLO_MEMBER_ID           (padrão: Emily de Britto)
 *   TRELLO_SOFT=1              (sem credenciais ou card não encontrado → só avisa e sai com código 0)
 */

const API = 'https://api.trello.com/1';
const DEFAULT_BOARD_ID = '6ac97e82108abc0c42a17958';
const DEFAULT_MEMBER_ID = '6a0f9048a85b4c07e0ed98cf'; // emilydebritto

// Nomes aceitos para cada coluna (o board usa "Doing", mas aceitamos "In Progress" também)
const LIST_ALIASES = {
  doing: ['doing', 'in progress', 'em andamento', 'fazendo'],
  review: ['review', 'em revisão', 'em revisao', 'code review'],
  done: ['done', 'concluído', 'concluido', 'feito'],
};

export class TrelloError extends Error {}

export function codeFromBranch(branch) {
  const m = /^(?:feat|fix|chore|refactor|test|docs)\/([A-Za-z]\d{1,2})(?:[-_/]|$)/.exec(branch ?? '');
  return m ? m[1].toUpperCase() : null;
}

export function cardMatchesCode(name, code) {
  // "B6 · [BACK] ..." — o código precisa ser seguido de separador (evita B1 casar com B10)
  return new RegExp(`^${code}\\s*[·\\-–:|]`, 'i').test(name.trim());
}

export function createClient({ key, token, boardId, fetchImpl = globalThis.fetch }) {
  const auth = `key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;

  async function call(method, path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = `${API}${path}?${auth}${qs ? `&${qs}` : ''}`;
    const res = await fetchImpl(url, { method, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new TrelloError(`Trello ${method} ${path} → ${res.status} ${body}`.trim());
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function findCard(code) {
    const cards = await call('GET', `/boards/${boardId}/cards`, { fields: 'name,idList,idMembers,url' });
    const matches = cards.filter((c) => cardMatchesCode(c.name, code));
    if (matches.length === 0) throw new TrelloError(`Card "${code}" não encontrado no board`);
    if (matches.length > 1) throw new TrelloError(`Mais de um card com o código "${code}": ${matches.map((c) => c.name).join(' | ')}`);
    return matches[0];
  }

  async function findList(kind) {
    const lists = await call('GET', `/boards/${boardId}/lists`, { fields: 'name' });
    const aliases = LIST_ALIASES[kind];
    const list = lists.find((l) => aliases.includes(l.name.trim().toLowerCase()));
    if (!list) throw new TrelloError(`Coluna "${kind}" não encontrada (procurei: ${aliases.join(', ')})`);
    return list;
  }

  return {
    call,
    findCard,
    findList,
    async start(code, memberId) {
      const card = await findCard(code);
      if (!card.idMembers?.includes(memberId)) {
        await call('POST', `/cards/${card.id}/idMembers`, { value: memberId });
      }
      const list = await findList('doing');
      await call('PUT', `/cards/${card.id}`, { idList: list.id, pos: 'top' });
      return { card, list };
    },
    async review(code, prUrl) {
      const card = await findCard(code);
      const list = await findList('review');
      await call('PUT', `/cards/${card.id}`, { idList: list.id, pos: 'top' });
      if (prUrl) await call('POST', `/cards/${card.id}/actions/comments`, { text: `🔀 PR aberto: ${prUrl}` });
      return { card, list };
    },
    async done(code, prUrl) {
      const card = await findCard(code);
      const list = await findList('done');
      await call('PUT', `/cards/${card.id}`, { idList: list.id, pos: 'top', dueComplete: 'true' });
      await call('POST', `/cards/${card.id}/actions/comments`, {
        text: `✅ Merge feito${prUrl ? `: ${prUrl}` : ''} — checagens do CI aprovadas.`,
      });
      return { card, list };
    },
  };
}

function parseArgs(argv) {
  const [cmd, arg, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--pr') opts.pr = rest[++i];
  }
  return { cmd, arg, opts };
}

export async function main(argv = process.argv.slice(2), env = process.env, fetchImpl = globalThis.fetch, log = console) {
  const { cmd, arg, opts } = parseArgs(argv);
  const soft = env.TRELLO_SOFT === '1';

  if (cmd === 'code-from-branch') {
    const code = codeFromBranch(arg);
    if (!code) {
      log.error(`Branch "${arg}" não segue o padrão feat/<CODIGO>-descricao`);
      return 1;
    }
    log.log(code);
    return 0;
  }

  if (!['start', 'review', 'done'].includes(cmd) || !arg) {
    log.error('Uso: trello.mjs <start|review|done> <CODIGO> [--pr <url>] | code-from-branch <branch>');
    return 2;
  }

  if (!env.TRELLO_KEY || !env.TRELLO_TOKEN) {
    const msg = 'TRELLO_KEY/TRELLO_TOKEN não definidos';
    if (soft) { log.warn(`⚠️ ${msg} — pulando atualização do Trello`); return 0; }
    log.error(msg);
    return 1;
  }

  const client = createClient({
    key: env.TRELLO_KEY,
    token: env.TRELLO_TOKEN,
    boardId: env.TRELLO_BOARD_ID || DEFAULT_BOARD_ID,
    fetchImpl,
  });

  try {
    const code = arg.toUpperCase();
    const memberId = env.TRELLO_MEMBER_ID || DEFAULT_MEMBER_ID;
    const { card, list } =
      cmd === 'start' ? await client.start(code, memberId)
      : cmd === 'review' ? await client.review(code, opts.pr)
      : await client.done(code, opts.pr);
    log.log(`✔ ${card.name} → ${list.name}`);
    return 0;
  } catch (err) {
    if (soft) { log.warn(`⚠️ ${err.message}`); return 0; }
    log.error(err.message);
    return 1;
  }
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('trello.mjs');
if (isDirectRun) {
  main().then((code) => process.exit(code));
}
