# Prompt para o Claude Code — MVP "GAVVE" (Transformation Day Renault)

AVISO ANTES DO PROMPT: vou estar fora e sem o Trello configurado.
- Rode tudo com TRELLO_SOFT=1. Ignore o passo 4 do bootstrap (não pare por falta de credenciais do Trello).
- Os comandos `node scripts/trello.mjs ...` vão só avisar e seguir. Para cada card, anote em docs/TRELLO_PENDENTE.md
  (código, status final e link do PR), para eu atualizar o board depois.
- Não pare para me perguntar nada: decida, registre em docs/DECISOES.md e siga.
- Se a proteção da main não puder ser configurada via gh api, siga mesmo assim, respeitando o fluxo de PR + checks.
- Se o gh/GitHub falhar de vez, trabalhe com branches locais: rode todas as checagens e faça o merge local na main, um card por vez,
  e registre isso no TRELLO_PENDENTE.md.

---

Você vai construir, de ponta a ponta, o MVP de uma plataforma de **pagamentos do Jurídico da Renault Geely do Brasil** para o desafio Transformation Day (Insper, equipe "Esquadrão Raposa – GAVVE"). Ao final, o front que já existe em `./front-renault.html` deve estar **integrado e funcionando** com o backend que você vai criar.

Trabalhe em **fases**, na ordem abaixo, e **um card do Trello por vez**, seguindo o fluxo da seção 0.1. **Não pare entre cards para pedir permissão**, a menos que algo bloqueie de verdade. Se houver ambiguidade, escolha a opção mais simples que atenda aos critérios de aceite, registre a decisão em `docs/DECISOES.md` e siga.

## 0.0 Bootstrap (uma única vez, antes de tudo)

1. Confira que existem `.github/workflows/ci.yml`, `scripts/trello.mjs` e `scripts/__tests__/trello.test.mjs`. **Não altere a lógica deles** sem necessidade. Se precisar, explique em `docs/DECISOES.md`.
2. Crie o `.gitignore` (node_modules, dist, .env*, exceto .env.example, playwright-report, `docs/refs/`, uploads locais) **antes do primeiro commit**. Rode `git status` e confirme que nada de `docs/refs/` aparece.
3. Faça o commit inicial **direto na `main`** (`chore: bootstrap`) com o `.gitignore`, o workflow, os scripts e o `front-renault.html` movido para `docs/design/front-renault.html`. Depois faça `git push`.
4. Teste o acesso ao Trello: `node scripts/trello.mjs code-from-branch feat/B1-x` deve imprimir `B1`. Se `TRELLO_KEY`/`TRELLO_TOKEN` não estiverem no ambiente, **pare e me peça**.
5. Configure a proteção da `main` via `gh api`:
   - exigir os status checks **"Guardas"**, **"Lint, tipos, testes e build"** e **"E2E (Playwright)"**
   - **sem** exigir revisão aprovada
   - **sem** exigir o job "Auto-merge + Trello"

   Confira também se *Workflow permissions* está em "Read and write". Se não tiver permissão de admin para isso, me diga exatamente o que configurar e siga.

## 0.1 Fluxo obrigatório para CADA card (B1…B14, F9…F11)

Os cards já existem no board **"Transformation Day - Renault"** (id `6ac97e82108abc0c42a17958`), com o código no início do título (ex.: `B6 · [BACK] ...`). Colunas: **To Do → Doing → Review → Done**.

1. **Começar:**
   ```bash
   git checkout main && git pull
   git checkout -b feat/<CODIGO>-<slug-curto>     # ex.: feat/B6-api-solicitacoes
   node scripts/trello.mjs start <CODIGO>         # atribui à Emily e move para Doing
   ```
2. **Implementar** só o escopo daquele card, **com testes** (as regras de negócio do card precisam de teste automatizado). Commits pequenos no padrão `feat(<CODIGO>): ...`.
3. **Checar localmente**, tudo verde antes de abrir o PR:
   ```bash
   npm run lint && npm run typecheck && npm run test:scripts && npm test && npm run build && npm run test:e2e
   ```
4. **Abrir o PR:**
   ```bash
   git push -u origin HEAD
   gh pr create --base main --fill --title "<CODIGO> · <título do card>"
   ```
   - O corpo do PR traz: o que foi feito, como testar, os critérios de aceite do card marcados ✅/❌ e o link do card
   - O CI move o card para **Review** sozinho quando o PR é aberto. Se o job "Trello → Review" falhar, rode `node scripts/trello.mjs review <CODIGO> --pr <url>`
5. **Esperar o CI:** `gh pr checks --watch`.
   - Se algo falhar, corrija na mesma branch e dê push (o CI roda de novo)
   - Quando todos os checks passam, o job **"Auto-merge + Trello"** faz o squash merge, apaga a branch e move o card para **Done**
6. **Confirmar:**
   - `gh pr view --json state` deve retornar `MERGED`
   - se o card não estiver em Done, rode `node scripts/trello.mjs done <CODIGO> --pr <url>`
7. Só então volte ao passo 1 com o próximo card.

**Ordem dos cards:** B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9 → B10 → B12 → B11 → B13 → F9 → F10 → F11 → B14.

A Fase A (inventário) e a Fase D (e2e final) **não têm card**. Use as branches `chore/inventario-front-refs` e `test/e2e-roteiro-demo`, com o mesmo fluxo de PR e auto-merge (o script ignora o Trello para branches sem código).

**Nunca:**
- dar push direto na `main` depois do bootstrap
- usar `--admin` para burlar a proteção
- desabilitar ou pular um check para conseguir mergear
- marcar no Trello um card como Done cujo PR não foi mergeado

Ao terminar cada card, mostre 3 linhas: o que entrou, o link do PR e o status do card.

## 0. Regras gerais (valem para tudo)

- **Stack obrigatória (homologada pela Renault):**
  - React + Vite + TypeScript + Tailwind
  - Node.js 20 + TypeScript + Express
  - PostgreSQL 16 + Prisma
  - Firebase Auth
  - Google Cloud (Cloud Run, Cloud Storage, Vertex AI/Gemini)
  - Recharts
  - Não introduza outras plataformas (nada de Supabase, n8n, Vercel etc.)
- **Tem que rodar 100% local, sem nenhuma credencial**, com um único `npm run dev`:
  - Postgres via `docker-compose`
  - **Firebase Auth Emulator** para login
  - **Armazenamento local em disco** como fallback do Cloud Storage
  - **Provider de IA "mock"** (respostas determinísticas) quando `GEMINI_API_KEY` não existir
  - Para todo serviço externo, crie uma interface com implementação real + mock, escolhida por variável de ambiente
- **Dados:** os códigos contábeis abaixo são reais e podem ser usados. **Valores, nomes de escritórios, números de pasta e pessoas devem ser fictícios** (LGPD + termo de confidencialidade). Nunca commite segredos. `.env.example` com todas as variáveis, sem valores.
- **`docs/refs/` contém documentos reais da Renault, com dados pessoais** (nomes de pessoas, números de processo, valores). Regras:
  - adicione `docs/refs/` ao `.gitignore` **antes do primeiro commit**
  - leia esses arquivos só para entender **estrutura e formato**
  - **nunca** copie nomes, CPFs/CNPJs de pessoas, números de processo ou valores reais para código, seed, testes, fixtures, prints ou documentação. Use sempre equivalentes fictícios no mesmo formato
- **Integração com LBS/SAP é SIMULADA** (mock). Não tente automatizar o portal `portalssc.renault.br` nem contornar captcha.
- Textos de UI em **português do Brasil**. Moeda `pt-BR`/BRL, datas `dd/mm/aaaa`.
- A validação de entrada fica em **schemas zod em `packages/shared`**, usados pelo back e pelo front.
- Testes com **vitest** (+ supertest na API). Prioridade: regras de negócio (de-para, validações, rateio, permissões).

## 1. Contexto do negócio (leia com atenção e copie para `CONTEXT.md` na raiz)

**Problema.** A analista do Jurídico (Natiele) recebe pedidos de pagamento dos escritórios parceiros por e-mail e planilha. Ela confere tudo à mão, **copia e cola** os mesmos dados na planilha de controle e no portal SSC/LBS (onde abre o chamado de pagamento), monta à mão o **Excel de rateio contábil** e gera relatórios mensais em tabelas dinâmicas. Uma única prestação de contas real (22/09) teve **187 linhas e R$ 1.513.365,90** digitadas manualmente. **Comprovantes de pagamento não ficam guardados em lugar nenhum.** O Projuris **não** é usado na operação: o nº da pasta Projuris serve só como referência do processo, no lugar do nome da parte (LGPD).

**Perfis:**
- `ESCRITORIO` — o escritório parceiro, que cria solicitações
- `ANALISTA` — a Natiele, que confere, aprova, abre o chamado e registra o pagamento
- `GESTOR` — vê dashboards e usa o assistente de IA

**Fluxos (tipoFluxo):**
- `ANEXO_V_ADIANTAMENTO`, `ANEXO_V_BAIXA` (prestação de contas), `ANEXO_V_REEMBOLSO` → via Anexo V no portal SSC
- `RC_HONORARIOS_NF` → honorários pagos com Nota Fiscal (PDF obrigatório)
- `RBS_DD_GUIA` → condenação ou acordo pago por guia/boleto judicial (PDF da guia obrigatório)

**De-para contábil** (Área + Motivo → Centro de custo, Conta, Ordem Interna). A Ordem Interna é chamada de "zedoa" e muda a cada ano.

| Área | Motivo | Centro de custo | Conta | Ordem Interna |
|---|---|---|---|---|
| CONSUMIDOR | PROJETO SAC | GI85032 | 681554 | ZDOA00429016 |
| CONSUMIDOR | ACORDO | GI85032 | 681554 | ZDOA00429018 |
| CONSUMIDOR | CONDENAÇÃO/CUSTAS | GI85032 | 681554 | ZDOA00003018 |
| CÍVEL | CONDENAÇÃO/CUSTAS | GI85163 | 681554 | ZDOA00003018 |
| REDE | CONDENAÇÃO/CUSTAS | GI85162 | 681554 | ZDOA00003018 |
| TRABALHISTA PIF/PDV | CONDENAÇÃO | GI85031 | 681580 | ZDOACONPIF24 |
| (qualquer) | JUROS E CORREÇÃO | **GI85030** | **686242** | herda a do principal |

- Motivos do dropdown: Condenação, Acordo, Acordo Projeto SAC, Custas Processuais, Multa, Depósito Judicial, Seguro garantia, Perícia, Honorários, Outros. Motivos como "Custas", "Multa", "Depósito Judicial" etc. seguem a linha CONDENAÇÃO/CUSTAS da área.
- "Juros e Correção" **não** é um motivo: é um campo de valor de cada lançamento (`valorJurosCorrecao`).
- Os dados contábeis **nunca** são digitados pelo usuário: o servidor sempre os calcula pelo de-para.

**Principal + juros.** Cada lançamento tem `valorPrincipal` e `valorJurosCorrecao`. O valor dos juros vem da guia ou do cálculo judicial, **não** é uma % fixa.

**Excel de rateio** (o formato exato do arquivo real; confira em `docs/refs/RATEIO CONTABILIDADE PRESTACAO DE CONTAS ACC 23.09.xlsx`):
- Aba `Planilha1`, cabeçalho na linha 1, colunas A–P: `CHAVE DE LANÇAMENTO | DEB/CRED | CONTA | REFERENCIA | ELEMENTO PEP | ORDEM INTERNA | CENTRO DE CUSTO | TIPO DE ATIVIDADE | VALOR | MOEDA | TEXTO CAB. DOCUMENTO | DT LANÇAMENTO | DT DO DOCUMENTO | ATRIBUIÇÃO | NUMERO DO ATIVO | TEXTO MÊS DE REFERENCIA`
- Por lançamento:
  - linha **40/Deb** do principal: conta, ordem interna e centro de custo do de-para; ATRIBUIÇÃO = nº da pasta; TEXTO MÊS = motivo
  - se houver juros, linha **40/Deb** com conta 686242, centro de custo GI85030, a mesma ordem interna do principal e TEXTO MÊS = "Juros e Correção"
- No final, **uma linha 31/Cred** com a soma de todos os débitos:
  - Anexo V / baixa de adiantamento → conta **108067**, REFERENCIA e TEXTO CAB. = `Baixa de adiantamento <escritório>`
  - RBS_DD → conta = **código SAP do fornecedor** (ex.: 40761 = TRT 9ª Região)
- Datas como texto `dd.mm.aaaa`. Valores com 2 casas decimais. **Soma dos débitos = crédito**, senão erro 422.
- Exemplo real (RBS_DD):
  ```
  40 Deb 681580 ref 541047 ZDOACONPIF24 GI85031 557380,92
  40 Deb 686242 ref 541047 ZDOACONPIF24 GI85030 208582,40
  31 Cred 40761 765963,32
  ```

**Chamado RBS_DD no portal SSC** (campos na ordem da tela; confira em `docs/refs/Abertura de chamado para pagamento de condenações Jurídico.pdf`):
- Empresa Aprovadora `0483` · Empresa Consumidora `0483` · Fornecedor (código SAP – nome – CNPJ)
- Nome do Solicitante `Pagamentos Jurídico`
- Identificação do Documento · Data do Documento · Data de Pagamento · Moeda `BRL` · Valor Total
- Forma de Pagamento (`Boleto`) · Motivo da demanda
- Natureza de gasto `0007 - Acts and…`
- Observação
- Classificação `Despesas administrativas (Centro de Custo)` · Descrição · Alocação `0007 - 622700 - CUSTOS DE ATOS E LITÍGIOS` · CeCu Aprovador `GI52000` · CeCu Consumidor · ZEDOA · Conta Contábil · Pagamento possui rateio? (`Sim` se houver juros)
- Título `<Motivo> <dd/mm do pagamento>`
- Anexos: guia + rateio.xlsx

Os valores fixos ficam em uma tabela/arquivo de configuração, não no código.

**Arquivos de referência em `docs/refs/`** (leia todos na Fase A; o que estiver neles **prevalece** sobre este prompt quando houver conflito de formato ou de campos):

| Arquivo | O que é | O que extrair |
|---|---|---|
| `RATEIO CONTABILIDADE PRESTACAO DE CONTAS ACC 23.09.xlsx` | Planilha padrão que os escritórios preenchem na prestação de contas = o formato do Excel de rateio. Abas: `Planilha1` (lançamentos), `Base de dados` (oculta: listas de motivos, centros de custo, contas) e `DADOS CONTABEIS` (de-para) | Ordem e nome exatos das colunas, formato das datas e dos valores, as **validações de dados** já existentes (chaves permitidas, valor > 0 com 2 casas, data ≥ 2019), as listas e o de-para |
| `Abertura de chamado para pagamento de condenações Jurídico.pdf` | Passo a passo do chamado RBS_DD no portal SSC, com prints | Todos os campos do formulário do chamado, na ordem; valores fixos; regra do título; anexos exigidos; exemplo de rateio com principal + juros |
| `Formulário de pagamento - … .eml` | **E-mail real** de um escritório pedindo um pagamento (o gatilho atual do fluxo) | Quais campos o escritório informa hoje, como informa e quais anexos manda → o **formulário "Nova solicitação"** precisa cobrir todos esses campos (ou derivá-los). Abra o .eml com um parser MIME (ex.: `mailparser`) e inspecione também os anexos |
| `PAGAMENTOS APRESENTAÇÃO RAP.pptx` | Apresentação antiga com os **relatórios que a gestão usa** | Liste cada slide: título, tipo de gráfico/tabela, métricas, agrupamentos (área, motivo, ordem interna, mês, ano) e filtros → os **dashboards (B12/F6) e as ferramentas do assistente (B11) precisam reproduzir esses relatórios**. Use `python-pptx` ou converta para texto |

## 2. Fase A — Inspeção do front e das referências (não escreva código ainda)

0. Leia os 4 arquivos de `docs/refs/` e escreva `docs/REFS_RESUMO.md` **só com estrutura, sem dados pessoais**:
   - colunas do rateio e validações
   - campos do chamado RBS_DD
   - campos do e-mail de solicitação → como cada um vira um campo do formulário (tabela "campo no e-mail → campo no sistema → origem: usuário / IA / de-para / fixo")
   - lista dos relatórios do PPTX → em qual endpoint e dashboard cada um vai entrar
   - **divergências** entre as referências e este prompt, e qual versão você seguiu
1. Leia `front-renault.html` inteiro. Liste em `docs/FRONT_INVENTARIO.md`:
   - as telas/seções existentes e quais perfis elas atendem
   - os componentes visuais que se repetem
   - as interações e os dados mockados (o que está hard-coded)
   - os assets externos (fontes, CDNs, imagens)
   - os IDs/classes que identificam cada tela
2. Faça um **mapa tela → endpoint(s)** da API que você vai criar (seção 3).
3. Compare com a lista de telas esperada (seção 4.2). Liste o que **falta** no HTML e o que **sobra**.
4. Decida a estratégia de integração e registre em `docs/DECISOES.md`:
   - **Padrão (preferido):** migrar o HTML para `apps/web` em React + TypeScript + Tailwind, **preservando o visual pixel a pixel**. Extraia cores, fontes e espaçamentos do HTML para tokens no `tailwind.config.ts`, quebre em componentes reutilizáveis e mantenha o `front-renault.html` original intacto em `docs/design/` (versionado) como referência visual.
   - **Fallback**, só se a migração for inviável (por exemplo, HTML gerado com posicionamento absoluto em tudo): manter o HTML como app estático em `apps/web-static/` e integrar com um `api.js` modular (fetch + auth + render).
5. Telas que faltarem no HTML devem ser criadas seguindo **o mesmo estilo visual** do HTML.

## 3. Fase B — Backend (cards B1 a B14)

### B1 · Monorepo
- npm workspaces: `apps/api`, `apps/web`, `packages/shared`
- `docker-compose.yml` com Postgres 16
- ESLint + Prettier, `README.md` com o passo a passo
- `CONTEXT.md` (seção 1) e `CLAUDE.md` com estas regras
- Scripts na raiz. **Todos exigidos pelo CI; crie-os já no B1**, mesmo que alguns comecem como stub:

  | Script | O que faz |
  |---|---|
  | `dev` | sobe docker, emulador do Firebase, api e web juntos |
  | `build` | build de todos os workspaces |
  | `lint` | ESLint |
  | `typecheck` | `tsc --noEmit` em todos os workspaces |
  | `test` | vitest (unitários + API) |
  | `test:scripts` | `node --test scripts/__tests__/*.test.mjs` |
  | `test:e2e` | `playwright test --pass-with-no-tests` |
  | `db:migrate` | prisma migrate dev |
  | `db:deploy` | prisma migrate deploy (usado no CI) |
  | `db:seed` | seed; no-op até o B4 |
  | `demo:reset` | recria a base demo |

- `firebase-tools` e `@playwright/test` como devDependencies
- `firebase.json` com o emulador de Auth na porta 9099 (o CI usa `firebase emulators:exec --only auth`)
- O **CI precisa ficar verde já no PR do B1**

### B2 · Infra local + adaptadores
- **Auth:** Firebase Auth Emulator + script `scripts/create-users.ts` que cria `escritorio@demo.gavve`, `analista@demo.gavve` e `gestor@demo.gavve` (senha `demo1234`) com custom claims `perfil` e `escritorioId`
- **Storage:** interface `Storage` com `LocalDiskStorage` (padrão) e `GcsStorage`
- **IA:** interface `LlmProvider` com `MockLlm` (padrão) e `GeminiProvider` (via `@google/genai`, modelo Flash, ativado por `GEMINI_API_KEY` ou credenciais Vertex)

### B3 · Prisma schema
**Tabelas:**
- `usuarios`(firebaseUid, nome, email, perfil, escritorioId?)
- `escritorios`(nome, cnpj)
- `fornecedores`(codigoSap, nome, cnpj)
- `deParaContabil`(area, motivo, centroCusto, contaContabil, ordemInterna?, ano, ativo), com `@@unique([area, motivo, ano])`
- `solicitacoes`(tipoFluxo, escritorioId, fornecedorId?, criadoPorId, status, numeroChamado?, numeroDocumentoLbs?, dataDocumento, dataPrevistaPagamento?, dataPagamento?, formaPagamento, valorTotal, observacao, timestamps)
- `lancamentos`(solicitacaoId, pastaProjuris — **não é única**, area, motivo, valorPrincipal, valorJurosCorrecao, centroCusto, contaContabil, ordemInterna, semaforo)
- `anexos`(solicitacaoId, tipo GUIA|NF|RATEIO_XLSX|COMPROVANTE|OUTRO, caminho, nomeArquivo, dadosExtraidos Json?)
- `alertas`(solicitacaoId, lancamentoId?, codigo, severidade AMARELO|VERMELHO, mensagem, resolvidoPorId?, resolvidoEm?, justificativa?)
- `comentarios`
- `historico`(entidade, entidadeId, acao, usuarioId, diff Json, createdAt)
- `configuracaoChamado` (os valores fixos do RBS_DD)

**Enums:**
- status: `RASCUNHO | ENVIADO | EM_CONFERENCIA | DEVOLVIDO | APROVADO | CHAMADO_ABERTO | PAGO | CANCELADO`
- formaPagamento: `BOLETO | TED | DEPOSITO_JUDICIAL`

**Regras:**
- Valores monetários em `Decimal(14,2)`
- `valorTotal` = Σ(principal + juros)
- Registrar `dataPagamento` ⇒ status PAGO

### B4 · Seed (`db:seed` idempotente; `demo:reset` recria tudo)
- De-para da seção 1 (anos 2025 e 2026) e as configurações do chamado
- Fornecedor `40761 – TRIBUNAL REGIONAL DO TRABALHO DA 9ª REGIÃO – 03141166000116` + 3 tribunais fictícios
- Escritórios fictícios: Escritório Alfa, Beta e Gama
- **~200 lançamentos** de jan/2025 a out/2026, imitando a distribuição real:
  - condenações e acordos com juros de 1% a 60% do principal
  - custas de R$ 2 a R$ 5.000
  - acordos de R$ 3.000 a R$ 110.000
  - pastas aleatórias de 5 dígitos
  - status variados
- **Casos propositais para a demo:**
  - (1) a mesma pasta com o mesmo par 4.410,64 + 4.589,36 lançado 3 vezes → DUPLICIDADE
  - (2) Área + Motivo sem de-para → VERMELHO
  - (3) valor digitado diferente do documento → AMARELO
  - (4) honorário 10x acima da média → VALOR_ATIPICO
  - (5) baixa maior que o saldo adiantado → VERMELHO
- Gere também, em `docs/demo-pdfs/`, **3 guias de boleto judicial e 2 NFs de honorários fictícias em PDF** (pdfkit ou similar), com beneficiário, CNPJ, nº do processo, vencimento e valor, para testar a extração e gravar o vídeo

### B5 · Autenticação e permissões
- Middleware `auth` (verifyIdToken do firebase-admin, funciona com o emulador) → `req.user`
- Middleware `exige(...perfis)`
- `GET /me`
- O escritório só vê dados do próprio escritório (filtro **no servidor**; recurso de outro escritório → 404)
- Escrita grava `historico`

| Ação | ESCRITORIO | ANALISTA | GESTOR |
|---|---|---|---|
| criar/editar em RASCUNHO/DEVOLVIDO | só o próprio escritório | ✅ | ❌ |
| ver solicitações | as próprias | todas | todas (leitura) |
| aprovar/devolver/resolver alerta/chamado/pagamento | ❌ | ✅ | ❌ |
| dashboards e assistente | ❌ | ✅ | ✅ |

### B6 · API principal
- `GET /listas`
- `GET /de-para?area=&motivo=`
- Os campos da solicitação devem cobrir **tudo o que o escritório informa hoje no e-mail** (`docs/refs/*.eml`), conforme a tabela do `REFS_RESUMO.md`
- `POST /solicitacoes` · `PATCH /solicitacoes/:id` · `GET /solicitacoes` (filtros status, escritorio, semaforo, tipo, busca por pasta; paginação) · `GET /solicitacoes/:id`
- `POST /solicitacoes/:id/enviar` → roda B7
- `POST /solicitacoes/:id/aprovar` → bloqueia se houver VERMELHO aberto
- `POST /solicitacoes/:id/devolver` (comentário obrigatório)
- `POST /solicitacoes/:id/chamado`
- `POST /solicitacoes/:id/pagamento`
- `POST /alertas/:id/resolver` (justificativa obrigatória)
- Máquina de estados com 409 para transição inválida
- O preenchimento contábil é sempre feito no servidor

### B7 · Motor de validações → semáforo
| Código | Regra | Severidade |
|---|---|---|
| CAMPO_OBRIGATORIO | RC sem NF, RBS_DD sem guia, pasta vazia | VERMELHO |
| DE_PARA_INEXISTENTE | Área + Motivo sem de-para no ano | VERMELHO |
| SOMA_DIVERGENTE | principal + juros ≠ valor do documento (tolerância de R$ 0,01) | VERMELHO |
| SALDO_ADIANTAMENTO | baixa > saldo adiantado do escritório | VERMELHO |
| DUPLICIDADE | mesma pasta + mesmo principal + mesmo motivo nos últimos 180 dias, ou mesmo nº de documento | AMARELO |
| DIVERGENCIA_VALOR_DOC | valor digitado ≠ valor extraído pela IA | AMARELO |
| VALOR_ATIPICO | > média + 3σ do motivo/área | AMARELO |

- Semáforo do lançamento = pior alerta aberto. O da solicitação = pior entre os lançamentos.
- Mensagens amigáveis em português, ex.: "Possível duplicidade: a pasta 14945 já tem R$ 4.410,64 (Condenação) em 22/09."
- **Teste unitário para cada regra.**

### B8 · `GET /solicitacoes/:id/rateio.xlsx`
- Gera com exceljs no formato **exato** da seção 1 e salva como anexo `RATEIO_XLSX`
- Teste comparando com uma fixture e um teste de débito = crédito
- Abra `docs/refs/RATEIO CONTABILIDADE PRESTACAO DE CONTAS ACC 23.09.xlsx` para conferir a ordem das colunas e o formato

### B9 · Chamado pronto + envio simulado
- `GET /solicitacoes/:id/chamado` → JSON com os campos do RBS_DD na ordem da tela
- `POST /integracoes/lbs/enviar/:id` → interface `IntegracaoLbs` + `MockLbs`: espera 1,5 s, devolve `BR-xxxxxx`, grava o nº e muda o status para CHAMADO_ABERTO

### B10 · `POST /extracao` (multipart, tipo GUIA|NF)
- Salva no Storage → `LlmProvider.extrair()` com saída estruturada em JSON schema:
  - GUIA: beneficiarioNome, beneficiarioCnpj, numeroProcesso, nossoNumero, numeroDocumento, dataDocumento, dataVencimento, valor, linhaDigitavel
  - NF: numeroNf, cnpjPrestador, nomePrestador, dataEmissao, valorServico, valorLiquido, descricao
- Sugere o fornecedor pelo CNPJ
- Só PDF, até 10 MB, timeout de 20 s com fallback
- O `MockLlm` lê o texto dos PDFs de `docs/demo-pdfs/` (pdf-parse + regex) para a demo funcionar sem chave
- Logar os tokens gastos quando for o Gemini real

### B11 · `POST /agente/mensagem`
- Assistente de relatórios com **function calling** sobre ferramentas parametrizadas, **sem SQL livre**:
  - `totalPago`, `comparativoAnual`, `mediaHonorarios`, `realizadoAteMes`, `topPastas`, `pendencias`
- Devolve `{ texto, visual?: { tipo: 'barra'|'linha'|'tabela', dados } }`
- Histórico limitado a 6 mensagens
- O `MockLlm` faz roteamento por palavras-chave para as ferramentas
- Precisam funcionar:
  1. "Quanto pagamos de condenações em 2026 até setembro, comparado com 2025?"
  2. "Qual a média de honorários por área este ano?"
  3. "Quais solicitações estão em amarelo ou vermelho agora?"
  4. "Gere o realizado por ordem interna do 3º trimestre"

### B12 · Dashboards
- `/dashboard/kpis`, `/realizado-mensal?ano=`, `/por-area`, `/por-motivo`, `/por-ordem-interna`, `/media-honorarios?agruparPor=`, `/funil`, `/export.xlsx`
- **Mais um endpoint para cada relatório do `PAGAMENTOS APRESENTAÇÃO RAP.pptx` que não estiver coberto acima.** Crie um dashboard "Relatório RAP" que reproduz os slides com os dados do seed
- Filtros: de, ate, area, motivo, escritorio
- "Realizado" = PAGO, pela dataPagamento
- **Reutilize as mesmas funções de query nas ferramentas do B11**

### B13 · Anexos
- Upload, listagem e download (URL assinada no GCS; rota protegida no storage local)
- Ao registrar o pagamento com comprovante → notificação para o escritório (tabela `notificacoes` + `GET /notificacoes`)

### B14 · Deploy (preparar, não executar)
- `apps/api/Dockerfile`
- `firebase.json` para Hosting
- `.github/workflows/deploy.yml` acionado só manualmente (`workflow_dispatch`): build da imagem, `gcloud run deploy` e `firebase deploy`, usando secrets que ainda não existem. **Não** mexa no `ci.yml`
- Uma nota em `docs/DEPLOY.md`: na Renault, o equivalente seria o GitLab CI (que é homologado)
- `docs/DEPLOY.md` com os comandos `gcloud run deploy ... --region southamerica-east1` e `firebase deploy --only hosting`, Secret Manager e Cloud SQL
- **Não** rode nada que crie recursos na nuvem

## 4. Fase C — Front (cards F9 a F11) integrado ao `front-renault.html`

### 4.1 Base
- `apps/web`: React Router, TanStack Query, react-hook-form + zodResolver (schemas de `packages/shared`), Recharts
- Client HTTP com o interceptor que injeta o `Authorization: Bearer <idToken>`
- Rotas protegidas por perfil, a partir do `GET /me`

### 4.2 Telas esperadas
Reaproveite o visual do HTML. Crie no mesmo estilo as telas que faltarem.

- **Login:** e-mail/senha + "Entrar como Escritório / Analista / Gestor" (atalho para a demo)
- **Escritório:**
  - Início (cards: em conferência, devolvidas, pagas no mês, saldo de adiantamento)
  - **Nova solicitação em 3 passos:**
    1. tipo de pagamento em cards amigáveis
    2. upload do PDF → "✨ preenchido pela IA, confira" + campos (pasta com autocomplete, área, motivo, principal, juros, datas, nº do documento, fornecedor) + **painel "Dados contábeis (automático)" travado**, que se atualiza ao escolher Área + Motivo + validação inline + tabela de várias linhas para prestação de contas
    3. revisão e envio
  - Detalhe com linha do tempo de status, comentários e "Baixar comprovante"
- **Analista:**
  - **Fila de conferência com semáforo:** contadores 🔴🟡🟢, filtros, "Aprovar todas as verdes"
  - Detalhe com o painel de alertas (resolver com justificativa), visualizador de PDF, aprovar/devolver e histórico
  - **Chamado pronto:** campos com botão "Copiar", download do rateio.xlsx com prévia das linhas 40/31 e selo "Débitos = Crédito ✓", botão "Enviar ao LBS/SAP"
  - Pagamentos: registrar o nº do documento, a data e o comprovante
  - Configurações → De-para
- **Gestor:** galeria de dashboards → dashboard com KPIs + gráficos + filtros + exportar Excel
- **Assistente IA:** chat com perguntas sugeridas e gráficos ou tabelas embutidos na resposta

### 4.3 Integração
- Troque **todo dado mockado** do HTML por chamadas reais à API
- Garanta loading, erro e vazio em todas as telas, e toasts nas ações
- Máscaras de moeda (BRL) e data (dd/mm/aaaa)
- Rascunho salvo automaticamente (debounce de 2 s)

## 5. Fase D — Verificação final

1. `npm run demo:reset && npm run dev` sobe tudo do zero, sem credenciais.
2. Escreva e rode um teste **end-to-end com Playwright** (`e2e/demo.spec.ts`) que percorre o roteiro da demo:
   - escritório sobe a guia fictícia → IA preenche → dados contábeis aparecem → envia
   - analista vê a 🟡 de duplicidade → resolve → aprova → baixa o rateio.xlsx (confere débito = crédito) → envia ao LBS (recebe BR-xxxxxx) → registra o pagamento com comprovante
   - escritório vê "Comprovante disponível"
   - gestor abre o dashboard e faz a pergunta 1 ao assistente → aparece um gráfico
3. Tire screenshots de cada passo para `docs/screenshots/`. Elas servem para o vídeo e para o slide.
4. Atualize o `README.md` com: como rodar, logins demo, roteiro da demo, como ligar o Gemini real e como fazer o deploy.
5. Me entregue um resumo final com:
   - checklist de B1–B14 e F9–F11 (feito / parcial / pendente)
   - os desvios em relação a este prompt e o motivo
   - riscos conhecidos para a demo

## 6. Critérios de pronto

- `npm run lint && npm test` passam; o e2e passa
- Cada card B1–B14 e F9–F11 tem **um PR mergeado pelo CI**, e o card está em **Done**, atribuído à Emily, com o comentário do link do PR
- Nenhum commit direto na `main` além do bootstrap
- O roteiro da demo roda em < 5 min sem erro, com dados fictícios
- O rateio.xlsx gerado abre no Excel com as **mesmas colunas** do arquivo de referência
- Nenhum segredo e nenhum dado real de processo no repositório. `docs/refs/` está no `.gitignore`, e `git log -p | grep` pelos nomes e números reais das referências não encontra nada
- Os relatórios do PPTX estão reproduzidos no dashboard, e todos os campos do e-mail de solicitação são cobertos pelo formulário
- O visual do front continua fiel ao `front-renault.html`
