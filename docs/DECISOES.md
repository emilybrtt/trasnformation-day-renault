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

## B7 — motor de validações (2026-10-11)

- **Novo campo `Lancamento.valorTotalInformado` (opcional).** O e-mail real (B6)
  mostra o escritório digitando **três** valores independentes: principal, juros e
  total — exatamente o tipo de transcrição que pode ficar inconsistente. Decidi usar
  esse campo (quando informado) para `SOMA_DIVERGENTE` (VERMELHO, checagem interna:
  "o que você digitou não soma") e manter `DIVERGENCIA_VALOR_DOC` (AMARELO) como a
  comparação contra o valor que a IA extraiu do PDF (`Anexo.dadosExtraidos`, B10) —
  são duas fontes de verdade diferentes (o que o usuário digitou vs. o documento),
  por isso duas regras com severidades diferentes.
- **Tolerância de centavos com arredondamento explícito.** Comparar valores
  monetários como `number` direto (`Math.abs(a - b) > 0.01`) dá falso positivo por
  erro de ponto flutuante (ex.: `110.01 - 110` não é exatamente `0.01` em IEEE754).
  A função `diferenca()` arredonda os dois valores a centavos antes de subtrair.
- **Semáforo da solicitação agora considera alertas sem lançamento específico.**
  `SALDO_ADIANTAMENTO` e o `CAMPO_OBRIGATORIO` de anexo ausente são alertas da
  solicitação como um todo (`lancamentoId: null`) — se só olhasse o semáforo dos
  lançamentos, um VERMELHO desses ficaria invisível na lista/detalhe. Criei
  `semaforoDaSolicitacao(lancamentos, alertasSemLancamento)` para isso (B6 usava só
  `piorSemaforo` dos lançamentos).
- **`validarEAtualizarAlertas` é "recompute total".** A cada chamada (hoje, só no
  `enviar`), apaga todos os alertas **ainda abertos** da solicitação e grava os
  recém-calculados; alertas já **resolvidos** (histórico) nunca são tocados. Isso
  evita duplicar alertas se a solicitação for devolvida e reenviada várias vezes.
- **`VALOR_ATIPICO` exige amostra mínima de 3** lançamentos comparáveis
  (área+motivo) para calcular média/desvio — com menos dados, a regra não dispara
  (evita marcar como atípico algo só porque é o primeiro registro daquele tipo).
- **Teste por regra**, todos de integração real contra o Postgres
  (`apps/api/src/services/__tests__/validacoes.test.ts`), como pedia o card.

## B8 — Excel de rateio (2026-10-11)

- **Correção de monorepo: `@types/node` duplicado.** `apps/api` e `apps/web` fixavam
  `@types/node@^24.13.3`, mas alguma dependência transitiva (provavelmente do
  `firebase-tools`/`vite`) já tinha puxado uma versão `^26` para a raiz — o npm não
  conseguia dedupar e instalava **duas** cópias. Isso virou dois tipos globais
  `Buffer`/`Uint8Array` incompatíveis entre si (erro só apareceu agora porque o B8 foi
  o primeiro card a usar uma lib — `exceljs` — cujos `.d.ts` referenciam `Buffer`
  diretamente). Corrigido fixando todos em `^20.14.0` (a major do Node usada em
  dev/CI) e adicionando `overrides["@types/node"]` na raiz para garantir uma única
  cópia. Confirmado com `rm -rf node_modules && npm install` do zero.
- **`exceljs` + TypeScript 6 ainda têm uma pequena divergência de tipagem residual**
  no `Workbook.xlsx.load(buffer)` (o `.d.ts` do exceljs não usa o `Buffer` genérico
  que esta versão do TS exige) — um `@ts-expect-error` pontual e comentado no teste,
  já que o valor é idêntico em runtime.
- **REFERENCIA vs ATRIBUIÇÃO.** No exemplo do briefing ("40 Deb 681580 ref 541047
  ZDOACONPIF24 GI85031...") o "ref" é um número diferente da pasta Projuris — mapeei
  `REFERENCIA = numeroDocumentoLbs` (quando existir) e `ATRIBUIÇÃO = pastaProjuris`,
  já que o briefing só confirma explicitamente que "ATRIBUIÇÃO = nº da pasta".
- **TEXTO CAB. DOCUMENTO / REFERENCIA da linha de crédito (31/Cred) no RBS_DD** não
  têm um valor explícito no briefing (só o caso Anexo V/baixa de adiantamento diz
  "REFERENCIA e TEXTO CAB. = Baixa de adiantamento `<escritório>`"). Para RBS_DD usei
  `TEXTO CAB. DOCUMENTO = "Pagamento <nome do fornecedor>"` e `REFERENCIA =
  numeroDocumentoLbs` — uma extrapolação razoável, documentada aqui para o caso de
  o SSC esperar outro formato.
- **DT LANÇAMENTO = data de pagamento (ou hoje, se ainda não paga); DT DO DOCUMENTO =
  `dataDocumento`.** Não especificado explicitamente no briefing; essa é a leitura
  mais natural dos nomes dos campos SAP.
- **O rateio é salvo como anexo a cada geração** (substitui o anterior — só fica um
  `RATEIO_XLSX` por solicitação), via `StorageProvider` do B2; a rota é só para
  `ANALISTA` (consistente com a tela "Chamado pronto" do front, seção 4.2).
- **Teste de fixture** reconstrói exatamente o exemplo numérico do próprio briefing
  (seção B9: pasta 14945, R$ 557.380,92 + R$ 208.582,40 = R$ 765.963,32, conta
  681580/686242, GI85031/GI85030, ZDOACONPIF24) — não veio de `docs/refs/`, é o
  exemplo genérico que já estava no prompt.

## B9 — chamado pronto + envio simulado (2026-10-11)

- **"CeCu Consumidor", "ZEDOA" e "Conta Contábil" vêm do lançamento, não da
  configuração fixa.** O briefing lista "CeCu Aprovador `GI52000`" com valor fixo,
  mas não dá um valor fixo para "CeCu Consumidor" — faz sentido, já que esse é
  justamente o centro de custo que o de-para resolve por Área+Motivo (varia por
  lançamento). Mesma lógica para ZEDOA (= `ordemInterna`) e Conta Contábil. Quando a
  solicitação tem mais de um lançamento com de-para diferente, uso o **primeiro**
  lançamento — simplificação para o MVP, documentada aqui.
- **"Descrição" (entre Classificação e Alocação) não tem valor fixo no briefing** —
  usei `observacao` da solicitação como descrição, caindo para a lista de motivos se
  estiver vazia.
- **"Motivo da demanda" e o título (`<Motivo> <dd/mm>`)** usam o motivo do primeiro
  lançamento (ou a lista de motivos únicos, se houver mais de um).
- **`IntegracaoLbs`/`MockLbs` não tem (e não deve ter) implementação real** — a
  integração com o portal SSC/LBS é sempre simulada, por regra explícita do
  briefing. A interface existe só por organização/testabilidade.
- **`LBS_MOCK_DELAY_MS`** (variável de ambiente, não documentada no `.env.example`
  por ser só para teste) permite encurtar o delay de 1,5s do mock nos testes
  automatizados sem mudar o comportamento em produção/demo.
- **`POST /integracoes/lbs/enviar/:id` reaproveita `abrirChamado` do B6**: o
  "envio simulado" só gera o número e delega a transição de estado (`APROVADO` →
  `CHAMADO_ABERTO`) para a função que já existia, sem duplicar a regra.

## B10 — extração de PDFs por IA (2026-10-11)

- **Troquei `pdf-parse` por `pdfjs-dist` direto.** `pdf-parse` está sem manutenção
  desde 2019 e embute um `pdf.js` de 2017 tão antigo que nem lê os PDFs gerados pelo
  `pdfkit` atual do B4 — falha com "bad XRef entry" mesmo num PDF trivial sem
  nenhum conteúdo especial (reproduzi fora dos testes para confirmar que não era
  bug meu). `pdfjs-dist` (o pdf.js de verdade, mantido pela Mozilla) lê os mesmos
  arquivos sem problema.
- **Bug de regex pego pelo próprio teste:** o extrator do `MockLlm` usava
  `${label}:\s*(.+)` sem ancorar `^` no início da linha — "Prestador:" batia como
  substring dentro de "CNPJ do prestador:" e devolvia o CNPJ no lugar do nome.
  Corrigido com `^${label}:` + flag `m`.
- **`LlmProvider.extrairDocumento`** devolve `GuiaExtraida | NfExtraida` conforme o
  `tipo`; `MockLlm` lê o PDF com `pdfjs-dist` + regex (determinístico, sem
  credencial); `GeminiProvider` envia o PDF em base64 como `inlineData` +
  instrução, pedindo `responseMimeType: 'application/json'`.
- **Timeout de 20s com fallback "manual":** se a extração falhar ou exceder o
  tempo, a rota não quebra — devolve `sucesso: false` e `dadosExtraidos: {}`, o
  arquivo já foi salvo no storage, e o usuário preenche os campos manualmente
  (como o front já previa: "✨ preenchido pela IA, confira").
- **Sugestão de fornecedor por CNPJ** compara o CNPJ extraído (normalizado,
  só dígitos) contra `Fornecedor.cnpj`. Testei com um PDF fictício gerado no próprio
  teste (CNPJ só de teste) em vez de reaproveitar o CNPJ real do TRT 9ª Região do
  `guia-1.pdf` — evita colidir com o fornecedor do seed (B4), que usa o mesmo CNPJ
  real.

## B12 — dashboards (2026-10-11)

- **Abri o `.pptx` do RAP (só estrutura, sem copiar valores).** 9 slides, 8 gráficos
  (quase todos de barra). Mapeamento completo em `docs/REFS_RESUMO.md`. Só um slide
  ficou fora do escopo: "Devoluções Anuais — Recompra de veículos" (processo de
  recompra de veículos, não é pagamento do Jurídico).
- **Endpoint extra do card:** `GET /dashboard/honorarios-anual` — cobre "Histórico
  Honorários Anual" e "Honorários variáveis anual", reaproveitando
  `mediaHonorarios('ano', ...)` (que já devolve soma e média).
- **Funções de serviço em `apps/api/src/services/dashboards.ts`**, puras (recebem
  filtros, devolvem dados), para o B11 reusar como ferramentas do assistente.
- **"Realizado" = status PAGO pela `dataPagamento`**, em todos os endpoints exceto
  `/dashboard/funil` (que precisa ver todos os status, inclusive o "vazamento" para
  DEVOLVIDO/CANCELADO).
- **Agregação em memória (JS), não SQL `GROUP BY` entre tabelas relacionadas** — meso
  padrão já usado desde o B6/B7, aceitável na escala do MVP (~200 registros).

## B11 — assistente de relatórios (2026-10-11)

- **`LlmProvider` ganha `escolherFerramenta`, não um `responderMensagem` que já devolve
  texto final.** O modelo (Mock ou Gemini) só decide **qual** das 6 ferramentas
  chamar e **com quais parâmetros** — quem executa a consulta e monta o texto da
  resposta é sempre `services/agente.ts`, nunca o LLM. Isso é o que garante "sem SQL
  livre" do card: o LLM nunca vê o banco, só a lista fixa de ferramentas.
- **`GeminiProvider.escolherFerramenta` usa function calling de verdade** (`tools:
  [{ functionDeclarations }]` + `res.functionCalls`), não um prompt pedindo JSON. O
  `MockLlm` cobre o mesmo contrato com roteamento por palavras-chave/regex
  (anos com 4 dígitos, nomes de mês, "1º/2º/3º/4º trimestre", "amarelo"/"vermelho"
  etc.) — determinístico e testável sem nenhuma credencial, exigido pelas 4 perguntas
  de exemplo do card.
- **`services/dashboards.ts` (B12) ganhou `totalRealizado`, `topPastas` e
  `pendencias`** para o B11 reutilizar como pedia o card, em vez de duplicar as
  queries em `services/agente.ts` — este só formata `{ texto, visual }` em cima do
  que o dashboard já calcula.
- **Histórico limitado a 6 mensagens é truncamento no servidor (`slice(-6)`), não
  validação que rejeita payloads maiores.** O schema compartilhado
  (`enviarMensagemAgenteSchema`) aceita até 50 mensagens de histórico (só para não
  aceitar payload arbitrariamente grande) — o cliente pode manter uma conversa mais
  longa; o servidor só considera as últimas 6 ao decidir a ferramenta.
- **`realizadoAteMes` é o nome da ferramenta do briefing, mas o parâmetro aceita um
  intervalo `mesInicio..mesFim`, não só um "até".** A pergunta de exemplo "realizado
  por ordem interna do 3º trimestre" não é cumulativa desde janeiro — é só
  julho-setembro — então o parâmetro mais simples que atende os dois casos (cumulativo
  "até setembro" e um trimestre isolado) é um intervalo, com `mesInicio` default 1.
- **`comparativoAnual` compara os dois anos no mesmo intervalo de meses** (ex.:
  jan-set em ambos), não ano inteiro vs. parcial — é a leitura mais natural de
  "até setembro, comparado com 2025" para uma comparação justa.

## B13 — anexos (2026-10-11)

- **`GET /arquivos/*` é a rota que o B2 deixou como placeholder** em
  `LocalDiskStorage.obterUrl` (`/arquivos/<chave>`). Só exige estar autenticado —
  não checa o escritório do dono do arquivo, porque a própria chave (sempre com um
  `cuid`/`randomUUID`) funciona como credencial, exatamente como uma signed URL do
  GCS: quem tem a chave acessa, quem não tem não adivinha. O controle de acesso por
  escritório de verdade é feito uma camada acima, em `GET /anexos/:id/download`.
- **`GET /anexos/:id/download` só redireciona (302) para `storage.obterUrl(...)`**,
  nunca faz proxy do conteúdo — para o GCS isso já cai na signed URL (pedida pelo
  card); para o local, cai no `/arquivos/*` acima. Um único código de rota cobre os
  dois provedores do card.
- **Anexo não guarda `contentType`.** Para não alterar o schema (o modelo só tem
  `nomeArquivo`), o Content-Type do download é inferido pela extensão do nome do
  arquivo (`lib/contentType.ts`) — suficiente para os formatos que o MVP usa
  (PDF, PNG/JPEG, XLSX).
- **Upload de anexo aceita PDF, PNG e JPEG** (`lib/upload.ts`, 10 MB) — guias/NFs
  são sempre PDF, mas um comprovante de pagamento às vezes é print/foto do banco.
- **Notificação só é criada quando o pagamento vem com comprovante anexado.**
  `POST /solicitacoes/:id/pagamento` virou multipart (campo `comprovante`
  opcional); continua aceitando o JSON puro de antes (o B9 já tinha testes assim)
  porque o `multer.single(...)` não altera `req.body` quando o request não é
  multipart. Sem comprovante, nenhuma `Notificacao` é criada — o comportamento do
  B9 para esse fluxo não muda.
- **`GET /notificacoes` não tem paginação nem filtro de "lida"** — o card só pede
  listar; ESCRITORIO vê só as próprias, ANALISTA/GESTOR veem de todos (mesma regra
  de escopo do B12). Marcar como lida fica para um card futuro, se vier a ser
  pedido.

## F9 — front, base + Escritório (2026-10-11)

- **F9/F10/F11 não têm escopo detalhado no prompt** (só "Fase C — cards F9 a
  F11", sem descrição por card, diferente de B1-B14) e o board do Trello não
  está acessível (modo soft). Dividi por papel, na mesma ordem da seção 4.2 do
  briefing: **F9 = base (router/auth/http) + Login + telas de Escritório**,
  F10 = Analista, F11 = Gestor + Assistente IA. ANALISTA/GESTOR que logarem
  antes do F10/F11 veem uma tela "Em construção" em vez de 404/crash.
- **Visual "reaproveitado" como tokens, não como cópia do CSS do mockup.**
  `docs/design/front-renault.html` é uma página estática com HTML montado via
  template string em JS vanilla (`render()`/`renderSummary()` etc.), não um
  componente reusável. Extraí a paleta de cores e as 3 fontes (Lexend/Fira
  Sans/IBM Plex Mono) para custom properties em `index.css` e componentes
  Tailwind próprios (`bg-[var(--accent)]` etc.) — mesma identidade visual, sem
  portar 1700 linhas de CSS bespoke (clip-path, skew etc.) nem a estrutura
  `#pt`/`#dono` pensada para JS vanilla.
- **`firebase` (client SDK) fixado em `11.10.0`, não a major mais recente.**
  A partir da v12/v13 atual, `@firebase/app` passou a exigir `node >=24.12` nos
  `engines` do seu `package.json` — incompatível com o Node 20 que o CLAUDE.md
  e o `ci.yml` mandam para o projeto. A v11 ainda aceita `node >=18`. (O aviso
  `EBADENGINE` que ainda aparece no `npm install` vem de um sub-dependente
  opcional do pacote de compatibilidade do Firestore/Storage, que este projeto
  nem importa — confirmado que `npm run build`, o dev server do Vite e o
  bundle de `firebase/auth` funcionam normalmente no Node 20.)
- **Duas pequenas rotas novas na API, fora do escopo original do B-series,
  só leitura de referência:** `GET /fornecedores` (autocomplete do campo
  "fornecedor" do passo 2) e reaproveitamento do `GET /de-para` que já existia
  (B4/B6) para o painel "Dados contábeis (automático)". Mesma categoria de
  `GET /listas`; cobertas por teste novo (`routes/__tests__/listas.test.ts`,
  que também passou a cobrir `/listas` e `/de-para`, sem teste dedicado até
  agora).
- **"Nova solicitação" sempre termina enviando (criar + `POST .../enviar` em
  sequência), não oferece "salvar como rascunho".** O briefing descreve o
  wizard como "revisão e **envio**"; like a tela de rascunho/edição (`PATCH`)
  já existe na API desde o B6 para quando for necessária, mas não é o foco
  deste fluxo de criação.
- **O PDF da guia/NF é enviado duas vezes** (uma para `/extracao`, assim que
  selecionado, para a IA preencher os campos; outra para
  `/solicitacoes/:id/anexos` depois que a solicitação é criada, já que o B13
  não tem uma rota para "anexar pelo `chave` que já existe no storage"). Gasta
  um pouco mais de storage local à toa, mas evita abrir uma nova rota só para
  isso — se vier a importar no overhead de upload, dá para revisitar.
- **"Linha do tempo de status" no Detalhe é derivada da posição no enum
  `StatusSolicitacao`, sem timestamp de cada etapa.** Não existe endpoint
  público de histórico (a tabela `Historico` é só auditoria interna, nunca
  exposta via API) — mostrar "em qual status já passou" é a leitura mais
  simples que ainda é informativa, sem precisar abrir uma rota nova.
- **Comentários do Detalhe são só leitura.** A única forma de criar um
  `Comentario` hoje é `devolverSolicitacao` (B6) — não existe (nem o briefing
  pede) um campo livre de "adicionar comentário"; a tela só lista o que já
  existe (o motivo de cada devolução).
- **Rascunho salvo automaticamente (debounce 2s) é só no `localStorage` do
  navegador**, não contra o status `RASCUNHO` no servidor — evita ficar
  criando/atualizando uma `Solicitacao` real a cada 2s enquanto o usuário só
  está digitando nos passos 1-2 do wizard (antes de existir um `id`).
