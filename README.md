# GAVVE — Pagamentos do Jurídico (Renault Geely do Brasil)

MVP para o desafio Transformation Day (Insper, equipe "Esquadrão Raposa – GAVVE").
Contexto completo de negócio em [`CONTEXT.md`](./CONTEXT.md).

> B1–B14 e F9–F12 implementados e mergeados — ver `docs/DECISOES.md` para decisões
> tomadas ao longo do caminho e `docs/TRELLO_PENDENTE.md` para o status de cada card.

## Estrutura

```
apps/
  api/        # Node 20 + TypeScript + Express
  web/        # React + Vite + TypeScript + Tailwind
packages/
  shared/     # schemas zod compartilhados entre api e web
docs/
  design/     # referência visual (Portal Pagamentos Jurídico.html — atual; front-renault.html arquivado, ver FRONT_INVENTARIO.md)
  refs/       # documentos reais da Renault — NUNCA versionado (.gitignore)
scripts/      # automação (Trello)
e2e/          # testes Playwright (Fase D)
```

## Como rodar

Requisitos: Node 20+, Docker (para o Postgres).

```bash
npm install
cp .env.example .env
npm run dev
```

Isso sobe o Postgres (docker-compose), o emulador do Firebase Auth, a API
(`http://localhost:3000`) e o front (`http://localhost:5173`) juntos. Nenhuma
credencial é necessária: Auth usa o emulador, storage é em disco local, e a IA usa um
provider mock determinístico.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | sobe docker, emulador do Firebase, api e web juntos |
| `npm run build` | build de todos os workspaces |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces |
| `npm test` | vitest (unitários + API) |
| `npm run test:scripts` | testes dos scripts de automação (Node test runner) |
| `npm run test:e2e` | Playwright |
| `npm run db:migrate` | prisma migrate dev |
| `npm run db:deploy` | prisma migrate deploy (usado no CI) |
| `npm run db:seed` | popula o banco com dados fictícios de demonstração |
| `npm run demo:reset` | recria a base demo do zero |

## Dados de demonstração

```bash
npm run db:seed        # ~200 lançamentos fictícios, determinísticos, com 5 casos
                        # propositais (duplicidade, de-para ausente, divergência de
                        # valor, honorário atípico, saldo de adiantamento excedido)
npm run demo:gerar-pdfs  # regera os PDFs fictícios em docs/demo-pdfs/ (já versionados)
npm run demo:reset      # db:deploy + db:seed, recriando a base do zero
```

## Login demo

Com o emulador do Firebase Auth rodando (`npm run dev` já sobe ele), crie os usuários
de demonstração com:

```bash
npm run auth:seed-users
```

> ⚠️ O emulador guarda os usuários **em memória** — toda vez que ele reinicia (ex.:
> você para e dá `npm run dev` de novo), rode `auth:seed-users` de novo. É rápido e
> idempotente; a tela de login tem botões de atalho para cada perfil (não precisa
> digitar e-mail/senha).

| E-mail | Senha | Perfil |
|---|---|---|
| escritorio@demo.gavve | demo1234 | ESCRITORIO |
| analista@demo.gavve | demo1234 | ANALISTA |
| gestor@demo.gavve | demo1234 | GESTOR |

## Roteiro da demo

Com `npm run dev` rodando e os usuários demo criados, o roteiro abaixo cobre os 3
fluxos de pagamento (F12) e é exatamente o que `e2e/demo.spec.ts` automatiza
(screenshots em [`docs/screenshots/`](./docs/screenshots/)):

1. **Escritório** cria uma solicitação **RBS_DD (guia)**: anexa uma guia de
   recolhimento (PDF) → a IA extrai pasta/valor/nº do documento automaticamente →
   confere e completa pasta `14945`, área `TRABALHISTA PIF/PDV`, motivo `CONDENAÇÃO`
   → os dados contábeis (centro de custo/conta/ordem interna) aparecem calculados
   pelo servidor → envia para conferência.
2. **Analista** abre a fila, vê o alerta de **duplicidade** (essa combinação de
   pasta/valor já existe no seed propositalmente) → resolve com uma justificativa →
   aprova → baixa o `rateio.xlsx` gerado → envia ao LBS/SAP (mock) → registra o
   pagamento com um comprovante em PDF.
3. **Escritório** volta à solicitação e vê o botão "Baixar comprovante" disponível.
4. Cobertura mais leve dos outros dois fluxos: **ANEXO_V — Adiantamento**
   (aprovado → chamado Portal SSC mock → pago) e **RC_HONORARIOS** (aprovado → RC no
   SAP mock → NF no Portal 0800 mock → pagamento programado no SAP mock → pago).

Para rodar o roteiro sozinho: `npm run test:e2e` (ou `npx playwright test` com a API
e o front já no ar).

## Ligar o Gemini real

Por padrão a extração de PDF e o chat do assistente usam um provider mock
determinístico (sem credenciais). Para usar o Gemini de verdade:

1. Gere uma chave em [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. No `.env`, defina:
   ```
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=<sua chave>
   ```
3. Reinicie `npm run dev` (ou só a API). Sem `GEMINI_API_KEY`, o app cai de volta no
   mock automaticamente — não trava nem exige a chave.

## Deploy

O deploy real nunca foi executado (o desafio roda 100% local) — está preparado e
documentado em [`docs/DEPLOY.md`](./docs/DEPLOY.md): Cloud Run (API) + Firebase
Hosting (front) + Cloud SQL (Postgres), com um `Dockerfile` pronto em `apps/api/`
(`docker build -f apps/api/Dockerfile -t gavve-api .` a partir da raiz).

## Variáveis de ambiente

Ver [`.env.example`](./.env.example). Tudo tem um padrão que funciona localmente sem
nenhuma credencial real; `GEMINI_API_KEY` ativa o provider de IA real (Gemini) quando
presente, senão usa o mock.
