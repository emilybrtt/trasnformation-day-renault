// Testes do scripts/trello.mjs com um Trello falso em memória (sem rede).
// Rodar: node --test scripts/__tests__/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main, codeFromBranch, cardMatchesCode } from '../trello.mjs';

const BOARD = '6ac97e82108abc0c42a17958';
const EMILY = '6a0f9048a85b4c07e0ed98cf';

function fakeTrello() {
  const state = {
    lists: [
      { id: 'L_TODO', name: 'To Do' },
      { id: 'L_DOING', name: 'Doing' },
      { id: 'L_DONE', name: 'Done' },
      { id: 'L_REVIEW', name: 'Review' },
    ],
    cards: [
      { id: 'C_B1', name: 'B1 · [BACK] Setup do repositório', idList: 'L_TODO', idMembers: [], dueComplete: false },
      { id: 'C_B10', name: 'B10 · [BACK] IA: leitura da guia', idList: 'L_TODO', idMembers: [], dueComplete: false },
      { id: 'C_F9', name: 'F9 · [FRONT] Exportar Figma', idList: 'L_TODO', idMembers: [EMILY], dueComplete: false },
    ],
    comments: [],
    calls: [],
  };
  const json = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });

  const fetchImpl = async (url, { method }) => {
    const u = new URL(url);
    const p = u.pathname.replace('/1', '');
    const q = Object.fromEntries(u.searchParams);
    state.calls.push(`${method} ${p}`);
    assert.equal(q.key, 'k'); assert.equal(q.token, 't');

    if (method === 'GET' && p === `/boards/${BOARD}/cards`) return json(state.cards);
    if (method === 'GET' && p === `/boards/${BOARD}/lists`) return json(state.lists);
    let m;
    if ((m = /^\/cards\/(\w+)\/idMembers$/.exec(p)) && method === 'POST') {
      state.cards.find((c) => c.id === m[1]).idMembers.push(q.value); return json([]);
    }
    if ((m = /^\/cards\/(\w+)\/actions\/comments$/.exec(p)) && method === 'POST') {
      state.comments.push({ card: m[1], text: q.text }); return json({});
    }
    if ((m = /^\/cards\/(\w+)$/.exec(p)) && method === 'PUT') {
      const c = state.cards.find((x) => x.id === m[1]);
      if (q.idList) c.idList = q.idList;
      if (q.dueComplete) c.dueComplete = q.dueComplete === 'true';
      return json(c);
    }
    return json({ message: 'not found' }, 404);
  };
  return { state, fetchImpl };
}

const silent = { log() {}, warn() {}, error() {} };
const env = { TRELLO_KEY: 'k', TRELLO_TOKEN: 't' };

test('codeFromBranch extrai o código do card', () => {
  assert.equal(codeFromBranch('feat/B6-api-solicitacoes'), 'B6');
  assert.equal(codeFromBranch('feat/b10-extracao'), 'B10');
  assert.equal(codeFromBranch('fix/F10-form'), 'F10');
  assert.equal(codeFromBranch('feat/B1'), 'B1');
  assert.equal(codeFromBranch('main'), null);
  assert.equal(codeFromBranch('feature-sem-padrao'), null);
});

test('cardMatchesCode não confunde B1 com B10', () => {
  assert.ok(cardMatchesCode('B1 · [BACK] Setup', 'B1'));
  assert.ok(!cardMatchesCode('B10 · [BACK] IA', 'B1'));
  assert.ok(cardMatchesCode('B10 · [BACK] IA', 'B10'));
});

test('start: atribui a Emily e move para Doing', async () => {
  const { state, fetchImpl } = fakeTrello();
  assert.equal(await main(['start', 'B1'], env, fetchImpl, silent), 0);
  const card = state.cards.find((c) => c.id === 'C_B1');
  assert.deepEqual(card.idMembers, [EMILY]);
  assert.equal(card.idList, 'L_DOING');
  // B10 intacto
  assert.equal(state.cards.find((c) => c.id === 'C_B10').idList, 'L_TODO');
});

test('start: não duplica membro já atribuído', async () => {
  const { state, fetchImpl } = fakeTrello();
  assert.equal(await main(['start', 'F9'], env, fetchImpl, silent), 0);
  assert.deepEqual(state.cards.find((c) => c.id === 'C_F9').idMembers, [EMILY]);
  assert.ok(!state.calls.some((c) => c.includes('idMembers')));
});

test('review: move para Review e comenta o PR', async () => {
  const { state, fetchImpl } = fakeTrello();
  assert.equal(await main(['review', 'b10', '--pr', 'https://github.com/x/y/pull/7'], env, fetchImpl, silent), 0);
  assert.equal(state.cards.find((c) => c.id === 'C_B10').idList, 'L_REVIEW');
  assert.match(state.comments[0].text, /pull\/7/);
});

test('done: move para Done, marca concluído e comenta', async () => {
  const { state, fetchImpl } = fakeTrello();
  assert.equal(await main(['done', 'B1', '--pr', 'https://github.com/x/y/pull/1'], env, fetchImpl, silent), 0);
  const card = state.cards.find((c) => c.id === 'C_B1');
  assert.equal(card.idList, 'L_DONE');
  assert.equal(card.dueComplete, true);
  assert.match(state.comments[0].text, /Merge feito/);
});

test('card inexistente: erro (1) normalmente, aviso (0) em modo soft', async () => {
  const { fetchImpl } = fakeTrello();
  assert.equal(await main(['start', 'B99'], env, fetchImpl, silent), 1);
  assert.equal(await main(['start', 'B99'], { ...env, TRELLO_SOFT: '1' }, fetchImpl, silent), 0);
});

test('sem credenciais: falha, ou pula em modo soft', async () => {
  const { fetchImpl, state } = fakeTrello();
  assert.equal(await main(['done', 'B1'], {}, fetchImpl, silent), 1);
  assert.equal(await main(['done', 'B1'], { TRELLO_SOFT: '1' }, fetchImpl, silent), 0);
  assert.equal(state.calls.length, 0);
});

test('aceita coluna "In Progress" no lugar de "Doing"', async () => {
  const { state, fetchImpl } = fakeTrello();
  state.lists[1].name = 'In Progress';
  assert.equal(await main(['start', 'B1'], env, fetchImpl, silent), 0);
  assert.equal(state.cards.find((c) => c.id === 'C_B1').idList, 'L_DOING');
});

test('comando inválido retorna 2', async () => {
  assert.equal(await main(['mover', 'B1'], env, async () => {}, silent), 2);
});
