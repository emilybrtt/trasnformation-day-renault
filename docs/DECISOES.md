# Decisões técnicas

Registro de decisões tomadas de forma autônoma durante a construção do MVP, conforme
instrução do briefing ("decida, registre aqui e siga").

## Bootstrap (2026-10-11)

- **Ambiente sem Node.js/Java.** O sistema não tinha Node nem Java instalados. Instalei
  Node 20 LTS via `nvm` (escopo do usuário, sem sudo) e symlinks em `~/.local/bin`
  (já no PATH). O Java (necessário para o Firebase Auth Emulator) será resolvido do
  mesmo jeito (JDK portátil, sem sudo) quando o B2 precisar dele.
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
- **Proteção da `main`.** Tentada via `gh api` no bootstrap, exigindo os checks
  "Guardas", "Lint, tipos, testes e build" e "E2E (Playwright)", sem exigir revisão
  aprovada e sem exigir o job "Auto-merge + Trello". Resultado registrado abaixo
  (seção atualizada após a tentativa).
