# CLAUDE.md — regras do projeto GAVVE

Leia `CONTEXT.md` antes de qualquer alteração de regra de negócio.

## Stack obrigatória (homologada pela Renault)

- React + Vite + TypeScript + Tailwind (`apps/web`)
- Node.js 20 + TypeScript + Express (`apps/api`)
- PostgreSQL 16 + Prisma
- Firebase Auth
- Google Cloud (Cloud Run, Cloud Storage, Vertex AI/Gemini)
- Recharts
- Não introduza outras plataformas (nada de Supabase, n8n, Vercel etc.)

## Regras gerais

- Tudo roda 100% local, sem nenhuma credencial, com `npm run dev`: Postgres via
  docker-compose, Firebase Auth Emulator, storage em disco local, IA mock quando
  `GEMINI_API_KEY` não existir. Todo serviço externo tem interface + implementação
  real + mock, escolhida por variável de ambiente.
- Valores, nomes de escritórios, números de pasta e pessoas em código/seed/testes são
  sempre fictícios. Nunca commitar segredos. `.env.example` sempre atualizado, sem
  valores reais.
- `docs/refs/` nunca é versionado (está no `.gitignore` e o CI falha se aparecer no
  `git ls-files`). Contém documentos reais da Renault com dados pessoais — leia só
  para entender estrutura/formato, nunca copie nomes, CPFs/CNPJs, nº de processo ou
  valores reais para fora dele.
- Integração com LBS/SAP é sempre simulada (mock). Nunca automatizar
  `portalssc.renault.br`.
- Textos de UI em português do Brasil. Moeda `pt-BR`/BRL, datas `dd/mm/aaaa`.
- Validação de entrada em schemas zod em `packages/shared`, usados pelo back e pelo
  front.
- Testes com vitest (+ supertest na API). Prioridade: regras de negócio (de-para,
  validações, rateio, permissões).
- Preenchimento contábil (de-para) é sempre calculado no servidor, nunca digitado pelo
  usuário.

## Fluxo de trabalho (Trello + PR)

- Um card por vez, branch `feat/<CODIGO>-<slug>`, commits `feat(<CODIGO>): ...`.
- `node scripts/trello.mjs start|review|done <CODIGO>` — não altere a lógica deste
  script. Em ambientes sem `TRELLO_KEY`/`TRELLO_TOKEN`, rode com `TRELLO_SOFT=1`
  (avisa e segue) e registre o pendente em `docs/TRELLO_PENDENTE.md`.
- PR com `gh pr create --base main --fill`, título `<CODIGO> · <título do card>`.
- Nunca dar push direto na `main` depois do bootstrap, nunca usar `--admin` para
  burlar a proteção da branch, nunca pular um check para mergear.
- Decisões tomadas sem confirmação do usuário vão para `docs/DECISOES.md`, com o
  porquê.
