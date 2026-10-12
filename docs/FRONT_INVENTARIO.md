# Inventário do front — `front-renault.html` (F9) vs. `Portal Pagamentos Jurídico.html` (F9b)

> O F9 foi construído com base em `docs/design/front-renault.html` (mockup antigo).
> A professora pediu correções e o Vitor entregou uma versão nova e mais completa:
> `Portal Pagamentos Jurídico.html` (raiz do repo → movido para `docs/design/` por
> este card). Este documento registra as diferenças e o que foi ajustado em
> `apps/web` versus o que fica para os cards F12/F10/F11 (que já vão reconstruir boa
> parte dessas telas do zero, agora como React).

## Visão geral

| | `front-renault.html` (antigo) | `Portal Pagamentos Jurídico.html` (novo) |
|---|---|---|
| Linhas | 1759 | 1931 |
| Tema | só claro | claro + escuro (`prefers-color-scheme` e `data-theme`) |
| Telas do Escritório | hero + wizard simples | hero com 4 variações por status + wizard de 5 blocos bem mais rico |
| Telas do Analista/Gestor | genéricas | 4 views dedicadas: `painel`, `relatorios`, `budget`, `regras` |
| Assistente IA | não existia | widget de chat flutuante (`#ast`), com bolha, input e botão flutuante |
| Paleta | `--ok`/`--bad` mais saturados | tons mais acinzentados (`--ok:#2F6A50`, `--bad:#A23B30`) + paleta dark completa |

## Diferenças que afetam o que já existe em `apps/web` (ajustadas neste card)

- **Paleta de cores** (`--ok`, `--bad`, `--off` novo) atualizada em `index.css` para
  bater com o mockup novo. Modo escuro **não** foi implementado agora (o app não
  tem toggle de tema ainda — fica para quando houver demanda real de uso).
- **Login**: o mockup novo mantém a mesma estrutura (marca à esquerda, formulário à
  direita) — nenhuma mudança estrutural necessária em `Login.tsx`, só a paleta.
- **Botão "Preencher com exemplo"** no topo do formulário de nova requisição (novo
  no mockup) — não adicionado agora porque depende de dados de exemplo específicos
  dos 3 fluxos (F12).

## Diferenças estruturais importantes, deixadas para F12/F10/F11 (fora do escopo deste card)

Essas exigem decisão de produto/negócio, não só visual — registradas aqui para
quem for implementar F12 não perder o contexto:

1. **O mockup novo tem 3 "tipos de pedido" na tela de nova requisição**, não os
   mesmos nomes do `tipoFluxo` do backend:
   - `pontual` (condenação/acordo/custas/recurso/depósito) → o mockup rotula o
     `path` como "Anexo V", mas a *forma de pagamento* escolhida no bloco 3
     (guia/boleto, depósito judicial ou transferência) é o que decide se cai em
     `RBS_DD_GUIA` (quando é guia) ou `ANEXO_V_*` (quando não é) — **o tipoFluxo
     real parece ser derivado da combinação tipo+forma de pagamento, não escolhido
     diretamente.** Isso é mais sutil do que "o escritório escolhe o tipo em cards"
     do jeito que o briefing original do F12 descreve: precisa decidir se o card
     inicial já é o `tipoFluxo` final ou só a "família" (Anexo V/RC/RBS_DD) e a
     forma de pagamento refina depois.
   - `prestacao` (prestação de contas / baixa de adiantamento) → `ANEXO_V_BAIXA`.
   - `nf` (honorários fixos/variáveis, com NF) → `RC_HONORARIOS_NF`.
2. **De-para com área/motivo mais detalhado que o `CONTEXT.md`:** o mockup tem
   `AREAS` agrupadas em `Corporate` (Consumidor, Rede, Cível, Tributário,
   Societário), `Labor` (Trabalhista) e `PIF/PDV` (Trabalhista PIF/PDV) — duas
   áreas novas (Tributário, Societário) e uma camada de "macro-área" que não existe
   no `DeParaContabil` atual (B3/B4). Tem também um de-para de conta contábil POR
   MOTIVO (`CONTA`) além do de área+motivo — mais granular que o seed atual.
3. **Lista de "órgãos recebedores" (fornecedores) maior e com propósito mais amplo**
   que o `Fornecedor` do schema: inclui bancos para depósito judicial (BB, CEF),
   Receita Federal (DARF) e "o próprio escritório" — hoje `Fornecedor` só cobre
   tribunais. F12 provavelmente precisa expandir o cadastro de fornecedores ou
   tratar banco/RFB como um tipo de recebedor separado.
4. **Campos novos no formulário** não mapeados 1:1 no schema atual: `macro-área`
   (acima de área), `tipo de ação` (já existe como `Lancamento.tipoAcao`, bate),
   `verbas que compõem o valor` (mapeável a `observacao`), `órgão recebedor` com
   lista própria (acima), `forma de pagamento` com 3 opções incluindo
   transferência bancária + dados bancários do beneficiário (banco/agência/conta/
   CPF-CNPJ — **não existe no schema hoje**), `precisa de estorno?` (não existe),
   `atribuição` (free text, diferente de `pastaProjuris` — o mockup usa
   "Referência" para o que parece ser `pastaProjuris`/`numeroDocumentoLbs` e
   "Atribuição" como um texto curto separado tipo "COND TRAB OUT/26").
5. **Telas do Analista (`view-painel`) e do Gestor (`view-relatorios`,
   `view-budget`, `view-regras`)** são todas novas — ainda não existe nenhuma tela
   de Analista/Gestor em `apps/web` (só Escritório, do F9). Ficam para F10/F11.
6. **Linha do tempo da solicitação** no mockup novo tem 3 passos nomeados:
   "envio à API de pagamentos" → "abrir chamado no portal SSC" → "registrar o
   pagamento" — hoje `DetalheSolicitacao.tsx` não tem essa linha do tempo
   detalhada ainda (fica para F10, já considerando os 3 fluxos do F12, cada um com
   nomes de passo diferentes conforme a integração: SSC/SAP+0800/RBS_DD).
7. **Assistente de IA** como widget de chat flutuante, com atalho rápido — a
   integração real com `POST /agente/mensagem` (B11) é o F11.

## Decisão

Mover `Portal Pagamentos Jurídico.html` para `docs/design/` como a referência
visual **atual** (o `front-renault.html` antigo fica arquivado, não é mais a fonte
da verdade, mas não foi removido — ainda documenta decisões já tomadas no F9).
