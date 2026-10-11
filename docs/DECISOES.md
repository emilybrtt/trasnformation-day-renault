# Decisões técnicas

Registro de decisões tomadas de forma autônoma durante a construção do MVP, conforme
instrução do briefing ("decida, registre aqui e siga").

## Bootstrap (2026-10-11)

- **Ambiente sem Node.js/Java.** O sistema não tinha Node nem Java instalados. Instalei
  Node 20 LTS via `nvm` (escopo do usuário, sem sudo) e Java 21 Temurin (JDK portátil
  da Adoptium, também sem sudo), ambos com symlinks em `~/.local/bin` (já no PATH).
  Validei localmente que `npx firebase emulators:exec --only auth --project demo-gavve
  "..."` funciona igual ao CI.
- **Trello em modo soft.** `TRELLO_KEY`/`TRELLO_TOKEN` não estão configurados no
  ambiente e o usuário avisou que vai configurar o board depois. Rodo tudo com
  `TRELLO_SOFT=1`: os comandos `node scripts/trello.mjs ...` avisam e seguem sem
  bloquear. Para cada card, o código, status final e link do PR vão para
  `docs/TRELLO_PENDENTE.md`, para atualização manual do board depois. O passo 4 do
  bootstrap (testar `code-from-branch`) foi pulado por instrução explícita.
- **Repositório já existente.** O diretório de trabalho real é
  `trasnformation-day-renault/` (dentro de `Insper/4-semestre/renault/`), já com `.git`
  inicializado, remoto `origin` apontando para `github.com/emilybrtt/trasnformation-day-renault`
  (público, vazio) e os arquivos-base do briefing (`ci.yml`, `scripts/trello.mjs`,
  `scripts/__tests__/trello.test.mjs`, `docs/refs/*`, `frontend/front-renault.html`).
  Não alterei a lógica de `ci.yml` nem de `scripts/trello.mjs`.
- **Reorganização da estrutura inicial.** As pastas placeholder `backend/` (vazia) e
  `frontend/` (só com o HTML) foram removidas. `front-renault.html` foi movido para
  `docs/design/front-renault.html` (referência visual intacta, versionada). A estrutura
  de monorepo (`apps/api`, `apps/web`, `packages/shared`) será criada no card B1, como
  pede o briefing.
- **Proteção da `main`.** Configurada com sucesso via `gh api` (tinha permissão de
  admin): exige os checks "Guardas", "Lint, tipos, testes e build" e
  "E2E (Playwright)", sem revisão aprovada obrigatória, sem exigir o job
  "Auto-merge + Trello", sem force-push e sem deleção da branch. *Workflow
  permissions* do repositório também configurado para "Read and write"
  (`default_workflow_permissions: write`, `can_approve_pull_request_reviews: true`).

## B2 — infra local e adaptadores (2026-10-11)

- **`LlmProvider` mínimo no B2.** A interface criada agora só tem `gerarTexto(prompt)`.
  Os métodos estruturados (`extrair` para PDFs no B10, function calling no B11) são
  adicionados à mesma interface quando esses cards chegarem, sem quebrar o Mock/Gemini
  já existentes.
- **URL do storage local é um placeholder.** `LocalDiskStorage.obterUrl` devolve
  `/arquivos/<chave>`; a rota Express que de fato serve esse caminho (autenticada)
  é implementada no B13.
- **`create-users.ts` recusa rodar sem o emulador.** Por segurança, o script só
  executa com `FIREBASE_AUTH_EMULATOR_HOST` definido — nunca cria usuários num projeto
  Firebase real por engano. UID fixo (`demo-escritorio`, `demo-analista`,
  `demo-gestor`) para o script ser idempotente.
- **`escritorioId` do usuário demo é um placeholder.** O escritório real (`Escritório
  Alfa`) só existe a partir do seed do B4; por ora o claim usa o id textual
  `escritorio-alfa`, que será o mesmo id usado no seed para não precisar recriar o
  usuário depois.
- **Testes do `create-users.ts` dependem do Auth Emulator.** Ficam com `skipIf` quando
  `FIREBASE_AUTH_EMULATOR_HOST` não está definido (dev sem emulador rodando) e correm
  de verdade no CI e em `npm run test:emulated` (script novo, só uma conveniência local
  equivalente ao que o CI já faz).
