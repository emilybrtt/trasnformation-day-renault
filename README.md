# GAVVE — Pagamentos do Jurídico (Renault Geely do Brasil)

MVP para o desafio Transformation Day (Insper, equipe "Esquadrão Raposa – GAVVE").
Contexto completo de negócio em [`CONTEXT.md`](./CONTEXT.md).

> Em construção card a card (B1…B14, F9…F11) — ver `docs/DECISOES.md` para decisões
> tomadas ao longo do caminho. Este README é atualizado conforme os cards avançam; a
> versão completa (login demo, roteiro da demo, deploy) chega na Fase D.

## Estrutura

```
apps/
  api/        # Node 20 + TypeScript + Express
  web/        # React + Vite + TypeScript + Tailwind
packages/
  shared/     # schemas zod compartilhados entre api e web
docs/
  design/     # referência visual (front-renault.html original)
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

## Login demo

Com o emulador do Firebase Auth rodando (`npm run dev` já sobe ele), crie os usuários
de demonstração uma vez com:

```bash
npm run auth:seed-users
```

| E-mail | Senha | Perfil |
|---|---|---|
| escritorio@demo.gavve | demo1234 | ESCRITORIO |
| analista@demo.gavve | demo1234 | ANALISTA |
| gestor@demo.gavve | demo1234 | GESTOR |

## Variáveis de ambiente

Ver [`.env.example`](./.env.example). Tudo tem um padrão que funciona localmente sem
nenhuma credencial real; `GEMINI_API_KEY` ativa o provider de IA real (Gemini) quando
presente, senão usa o mock.
