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

## B3 — schema Prisma (2026-10-11)

- **De-para fica congelado no lançamento.** `Lancamento.centroCusto/contaContabil/
  ordemInterna` são denormalizados (calculados pelo servidor a partir de
  `DeParaContabil` no momento do envio) em vez de sempre recalculados via join. Isso
  preserva o valor histórico aplicado mesmo se o de-para mudar no ano seguinte.
- **`ConfiguracaoChamado` sem versionamento por ano.** Os campos fixos do chamado
  RBS_DD (Empresa Aprovadora, Natureza de gasto etc.) não variam por ano no contexto
  do negócio (diferente da "zedoa" do de-para) — uma única config ativa é suficiente.
- **IDs:** `cuid()` para a maioria das tabelas; `Usuario.firebaseUid` é a própria
  chave primária (é o identificador natural do Firebase Auth).
- **Migração gerada e testada localmente** com Postgres real via `docker compose`
  (`prisma migrate dev --name init`) e também `prisma migrate deploy` contra um banco
  limpo (`gavve_test`), replicando exatamente o que o CI faz.

## B4 — seed de demonstração (2026-10-11)

- **`Lancamento.centroCusto`/`contaContabil` passaram a ser opcionais** (nova
  migration `20261011152225_lancamento_contabil_opcional`), para representar o caso
  "sem de-para encontrado" (`DE_PARA_INEXISTENTE`) sem violar NOT NULL. `ordemInterna`
  já era opcional desde o B3.
- **De-para de 2026 é extrapolado ficticiamente.** O briefing só dá uma tabela sem
  coluna de ano. Segui 2025 com os códigos reais do briefing e, para 2026, troquei os
  2 últimos caracteres da ordem interna por "26" (ex.: `ZDOA00429016` → `ZDOA00429026`,
  `ZDOACONPIF24` → `ZDOACONPIF26`) só para a demo mostrar a "zedoa" mudando de ano —
  não é um código real da Renault para 2026.
- **Seed é determinístico (RNG com seed fixa) e "recria do zero".** `db:seed` apaga
  todas as `Solicitacao` (cascata) antes de regerar — assim `demo:reset` sempre produz
  os mesmos ~197 lançamentos, incluindo os 5 casos propositais, o que ajuda a manter
  screenshots/roteiro de demo estáveis (Fase D). O cadastro de referência (de-para,
  fornecedores, escritórios, usuários) usa upsert por chave fixa, então sobrevive a
  reexecuções sem duplicar.
- **Fornecedores fictícios claramente marcados "(DEMO)"/"(FICTÍCIO)"** para não
  parecerem tribunais reais com CNPJs errados. CNPJs fictícios gerados com dígito
  verificador válido (algoritmo padrão), para não quebrar uma eventual validação de
  CNPJ futura.
- **Usuários "seed-escritorio-beta/gama" não têm login real no Firebase** — só
  existem no Postgres para satisfazer a FK `criadoPorId` dos lançamentos históricos
  desses escritórios fictícios. Só os 3 usuários demo (`demo-escritorio`,
  `demo-analista`, `demo-gestor`) têm conta de verdade no Auth Emulator (criada pelo
  `scripts/create-users.ts` do B2).
- **Interpretação dos valores por motivo** (briefing não detalha todas as
  combinações): `ACORDO`/`PROJETO SAC` → R$ 3.000–110.000 com juros de 1–60%;
  `CONDENAÇÃO/CUSTAS` → 50% das vezes como "custas" (R$ 2–5.000, sem juros) e 50%
  como "condenação" (R$ 3.000–150.000, com juros de 1–60%); `CONDENAÇÃO` (PIF/PDV) →
  mesma faixa de condenação.
- **Normalização dos motivos do dropdown** (ex.: "Multa", "Depósito Judicial" →
  bucket CONDENAÇÃO/CUSTAS da área) fica para o B6/B7 — o seed só usa os 6
  pares área+motivo canônicos da tabela de de-para, para os lançamentos aleatórios
  resolverem de verdade.
- **PDFs fictícios em `docs/demo-pdfs/`** (3 guias + 2 NFs, gerados com `pdfkit` via
  `npm run demo:gerar-pdfs`) usam labels em português fixas ("Beneficiário:", "Valor:"
  etc.) — o extrator do B10 (`MockLlm`) vai depender desse formato exato por regex.
  Os valores de `guia-1.pdf` e `guia-2.pdf` foram escolhidos para coincidir com os
  casos propositais 1 e 3 do seed.
- **`tsconfig.scripts.json` novo** — os scripts `.ts` fora dos workspaces
  (`scripts/*.ts`, `apps/api/prisma/seed.ts`) não eram cobertos por `npm run
  typecheck` até agora (gap que já existia desde o B2 com `create-users.ts`); agora
  `npm run typecheck` também roda `tsc -p tsconfig.scripts.json` sobre eles.

## B5 — autenticação e permissões (2026-10-11)

- **Escopo por escritório é uma função pura, não um middleware de rota.** A
  `escritorioId` de um recurso (ex.: uma `Solicitacao`) só é conhecida depois de
  buscá-lo no banco, então `podeAcessarEscritorio(usuario, escritorioId)` é chamada
  dentro do handler da rota (B6+) e devolve 404 — nunca 403 — quando nega, para não
  revelar que o recurso existe.
- **Testes de integração reais, não mocks, para `auth`.** Em vez de mockar
  `verifyIdToken`, os testes trocam um custom token (Admin SDK) por um ID token de
  verdade via o endpoint REST do Auth Emulator
  (`identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken`) — o mesmo
  middleware que roda em produção é exercitado de ponta a ponta. Helper em
  `apps/api/src/test-helpers/emulatorAuth.ts`.
- **Histórico (`registrarHistorico`) é só a função utilitária neste card.** B6+ chama
  isso em cada escrita de negócio; B5 entrega e testa a função, não tem ainda quem
  chamar de verdade.
- **`GET /me`** é a única rota de negócio deste card — só para validar o middleware
  de ponta a ponta; as rotas de `/solicitacoes` chegam no B6.

## B6 — API principal de solicitações (2026-10-11)

- **Fase A abreviada, feita "just in time" no B6.** Li o `.eml` real agora (só
  estrutura, nenhum dado real copiado) e escrevi `docs/REFS_RESUMO.md`. O `.pptx` de
  relatórios ainda não foi aberto — fica para o B12.
- **Dois campos novos no `Lancamento`** (`tipoAcao`, `valorProvisaoProjuris`,
  opcionais) vieram direto do e-mail real. Nome do reclamante, cargo, período
  imprescrito, abatimento de depósito recursal, apólice de seguro garantia e o
  código "SIBEL/BENNER" foram conscientemente **deixados de fora** — ou são dado
  pessoal que a pasta Projuris já existe para evitar guardar (LGPD), ou são detalhe
  jurídico que não alimenta o fluxo de pagamento/contábil deste MVP.
- **`POST /enviar` pula o estado `ENVIADO` e vai direto para `EM_CONFERENCIA`.** O
  enum mantém `ENVIADO` (dado de demonstração no seed já o usa), mas a transição real
  da API não passa por ele — o texto do briefing diz "enviar → roda B7", e B7 (motor
  de validação, ainda não implementado) é o que de fato prepara a solicitação para a
  fila do analista. Quando o B7 existir, ele entra nesse mesmo endpoint.
- **404, não 403, para recurso de outro escritório** — função pura
  `podeAcessarEscritorio` (B5) chamada em cada handler depois de buscar o recurso,
  como o B5 já previa.
- **`aprovar` bloqueia tanto por `Alerta` vermelho aberto quanto por
  `Lancamento.semaforo = VERMELHO` direto.** Como o motor de validação (B7) ainda não
  cria as linhas de `Alerta` automaticamente, o B6 já marca o semáforo do lançamento
  como VERMELHO quando não há de-para (`DE_PARA_INEXISTENTE`) — e `aprovar` respeita
  os dois sinais, não só o `Alerta`. Isso evita abrir um buraco de regra até o B7
  chegar.
- **Código de status HTTP:** 409 só para transição de estado inválida (ex.: aprovar
  uma solicitação que não está em `EM_CONFERENCIA`); 422 para a regra de negócio
  "vermelho aberto bloqueia aprovação"; 400 para erro de validação do zod
  (`ZodError`) ou corpo faltando (ex.: comentário/justificativa vazios).
- **`PATCH` substitui todos os lançamentos quando `linhas` é enviado** (apaga e
  recria dentro de uma transação), em vez de tentar diff por id — mais simples para
  o MVP e combina com a tela "tabela de várias linhas" do front, que reenvia a
  tabela inteira a cada edição.
- **Semáforo da solicitação é sempre derivado** (pior entre os lançamentos),
  calculado em memória nas respostas de leitura — não existe coluna
  `Solicitacao.semaforo` (só `Lancamento.semaforo`, que é persistido). O filtro
  `semaforo` em `GET /solicitacoes` por isso é aplicado em memória, não no SQL —
  aceitável na escala do MVP (~200 registros).

- **Correção de CI no B6:** `packages/shared` precisava de `npm run build` antes de
  qualquer workspace poder importar `@gavve/shared` (seu `main`/`types` apontam para
  `dist/`). Isso passou despercebido até o B6 porque foi o primeiro card a de fato
  importar o pacote de um outro workspace — localmente eu tinha buildado manualmente
  sem perceber que o `npm ci` do CI não faria isso. Corrigido com um `postinstall: "npm
  run build"` em `packages/shared/package.json` (mesmo padrão já usado no
  `prisma generate` do `apps/api`). Confirmei localmente com `rm -rf node_modules && npm
  ci` do zero.
