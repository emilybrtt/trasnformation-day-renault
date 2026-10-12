# Roteiro único da demo — Pagamentos Jurídico (GAVVE)

> Roteiro de referência para o Transformation Day. Vale tanto para a aplicação real
> (`apps/web` + `apps/api`) quanto para o plano B — o HTML autocontido em
> `docs/design/Portal Pagamentos Jurídico.html` (cópia para envio em
> `Portal Pagamentos Jurídico - v2.html`, na raiz). As duas sessões devem seguir os
> mesmos passos, na mesma ordem, para a demo ficar idêntica em qualquer um dos dois.
>
> Dados fictícios, jan/2025–out/2026. "Hoje" na demo é **11/10/2026**.

## Como abrir

- **Plano B (HTML)**: abra `Portal Pagamentos Jurídico - v2.html` direto no navegador
  (duplo clique ou `file://`). Funciona 100% offline — não depende de rede, API nem
  banco. O único recurso online é a fonte do Google Fonts e o assistente de IA (que
  degrada graciosamente para "indisponível" sem conexão/sem permissão).
- **Aplicação real**: `npm run dev`, acessar `http://localhost:5173`, login com os
  3 perfis de teste (ver `apps/web`).

## Visão geral: 3 perfis, 1 fluxo

| Perfil | O que faz | Tela inicial |
|---|---|---|
| Escritório parceiro | Envia requisições de pagamento e acompanha o status | "Início" (hero + histórico) |
| Operador (Pagamentos Jurídico / Natiele) | Confere, valida ou devolve, abre o chamado/Anexo V/RC e registra o pagamento | "Fila de validação" |
| Dono do fluxo | Olha KPIs, budget, relatórios e regras contábeis; usa o assistente de IA | "Painel" |

No HTML, os 3 perfis são escolhidos na tela de login (cards "Escritório parceiro" /
"Operador" / "Dono do fluxo"). Sair e voltar ao login não perde os dados da sessão
(tudo em memória, reseta só ao recarregar a página).

## Os 3 fluxos de pagamento (`tipoFluxo`)

Escolhidos pelo escritório no bloco 01 do formulário (tipo de pedido), e refinados
pela forma de pagamento no bloco 03. A tela do operador mostra um selo (badge) com o
fluxo e filtra a fila por ele.

| Fluxo | Quando | Caminho | Badge |
|---|---|---|---|
| **ANEXO_V** | Prestação de contas (baixa de adiantamento), ou pagamento pontual com depósito judicial/transferência | Preenchido no Anexo V do Portal SSC | `Anexo V` |
| **RC_HONORARIOS** | Honorários com nota fiscal | RC aberta no SAP → NF enviada no Portal 0800 → pagamento no SAP | `RC honorários` |
| **RBS_DD** | Pagamento pontual por guia/boleto judicial (condenação, acordo, custas, depósito) | Chamado aberto no Portal SSC (WDD/RBS_DD), com Excel de rateio e campos prontos para copiar | `RBS_DD` |

Na tela "Pacote SSC" do operador, os 3 passos (envio/abertura → chamado ou Anexo V ou
NF 0800 → pagamento) mudam de nome e de campo conforme o fluxo da requisição
selecionada. As integrações (API de pagamentos, chamado SSC, SAP) são sempre
simuladas, com um atraso de ~1 segundo e números de protocolo fictícios.

## Roteiro passo a passo (~8–10 min)

### 1. Escritório envia (perfil Escritório parceiro)
1. Login → "Escritório parceiro".
2. Tela "Início": mostra pendências, valor pago em 2026 e próximo vencimento.
3. "Nova requisição" → "Preencher com exemplo" (ou preencher à mão) para mostrar os
   5 blocos: tipo de pedido → processo → pagamento (recebedor + forma de pagamento,
   que decide o fluxo) → dados contábeis (de-para automático, nunca digitado) →
   justificativa e anexos.
4. Mostrar o painel lateral (resumo, total, checklist dos 5 blocos) e o lançamento
   contábil calculado em tempo real (débito = crédito).
5. Enviar. Voltar ao histórico e mostrar o novo item com status "Pendente" e o selo
   do fluxo.

### 2. Semáforo da analista (perfil Operador)
1. Login → "Operador". Tela "Fila de validação": pipeline por etapa (Novos, Em
   análise, Devolvidos, Validados, No SSC, Pagos) e filtros por empresa, área,
   motivo, escritório **e fluxo**.
2. Abrir uma requisição "Nova" → tela de validação: conferência com a guia/NF,
   dados informados, lançamento contábil, histórico.
3. Marcar os 5 itens da conferência → "Validado" (ou simular uma devolução: marcar
   "Não validado", escolher o motivo, escrever a mensagem — volta pro escritório em
   vermelho com o motivo).

### 3. Chamado / Anexo V / rateio (perfil Operador → "Pacote SSC")
1. Abrir a requisição validada na fila do SSC. Mostrar o passo 01 (envio à API/abertura
   da RC, já simulado) e o passo 02, que muda conforme o fluxo:
   - **RBS_DD**: copiar os campos para o chamado SSC, baixar o Excel de rateio e a
     guia, registrar o nº do chamado (formato `2026-000000`).
   - **ANEXO_V**: mesma mecânica, mas para o Anexo V do portal SSC (nº `AV-000000`).
   - **RC_HONORARIOS**: enviar a NF no Portal 0800 (protocolo `0800-000000`); a RC
     já foi aberta no SAP no passo 01.
2. Depois de confirmar (~1s de "enviando…" simulado), o passo 03 libera.

### 4. Pagamento e comprovante
1. Passo 03: informar o documento LBS, a data e anexar o comprovante (qualquer PDF).
2. Confirmar pagamento (~1s simulado) → status fica "Pago" em verde para o escritório,
   com o comprovante disponível para download na requisição.

### 5. Dashboard (perfil Dono do fluxo)
1. Login → "Dono do fluxo". Tela "Painel".
2. Filtros: período (mês / ano até o mês), empresa, motivo, **tipo de fluxo**,
   **escritório** e áreas.
3. KPIs: real pago, variação vs. ano anterior, nº de solicitações pagas, % sem
   devolução, tempo médio (ciclo) até o pagamento, e o painel "funil por status"
   com as pendências por semáforo (verde/amarelo/vermelho) da fila viva do portal.
4. Gráficos: budget × real por área, realizado mensal (ano × ano anterior), acordos
   × condenações, depósito judicial × seguro garantia, honorários fixos × variáveis
   (com zedoa), recompra de veículos, qualidade por escritório, **por tipo de
   fluxo**, **por motivo**, e a **tabela por ordem interna (zedoa)**.
5. Botão "Gerar relatório →" abre a tela de relatórios (mensal/anual) com os mesmos
   filtros, KPIs, tabela por área e por motivo, e **exportação para Excel** (baixa um
   `.xls` de verdade, além do botão de copiar para colar).
6. Telas "Budget" (editar budget por área/ano) e "Regras" (de-para contábil:
   área + motivo → centro de custo, conta, zedoa).

### 6. Assistente de IA
1. Botão flutuante no canto inferior direito (ícone de balão).
2. Perguntas sugeridas ("Quais áreas estão acima do budget em 2026?", etc.) ou
   pergunta livre. Responde só com os números do painel e da fila viva — nunca
   inventa valores. Se o ambiente não permitir IA (ex.: fora do runtime do Claude,
   ou sem permissão), mostra aviso e some normalmente; o resto da demo não depende
   dele.

## Dados fictícios

- Fila viva do portal (perfis Escritório/Operador): ~15 requisições fictícias,
  datadas entre set/2026 e out/2026, cobrindo os 3 fluxos e os principais status.
- Base do dashboard (perfil Dono do fluxo): série sintética jan/2024–out/2026 (2024
  serve de base de comparação; o período de análise principal é jan/2025–out/2026),
  por área, motivo e fluxo, com budget anual por área.
- Nenhum nome, CPF/CNPJ ou nº de processo real — ver `CONTEXT.md` e `docs/refs/`
  (não versionado).

## Se algo falhar durante a demo

- O HTML (plano B) não depende de rede, servidor nem banco — é o fallback seguro se
  a aplicação real cair. Basta abrir o arquivo local.
- Qualquer "falha" simulada já faz parte do roteiro (ex.: status "Falha na API" na
  fila do operador, com botão "Reenviar") — útil até como talking point de
  resiliência, não como bug.
