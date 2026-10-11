# Resumo dos arquivos de referência (`docs/refs/`)

> **Fase A abreviada.** A Fase A completa (ler os 4 arquivos a fundo antes de
> escrever qualquer código) não foi feita como uma etapa isolada no início do
> projeto — o trabalho avançou card a card e este resumo foi escrito "just in time"
> no B6, quando o formulário de solicitação precisou dos campos reais do e-mail.
> O `.xlsx` de rateio e o `.pdf` do chamado já tinham sido suficientemente cobertos
> pela seção 1 do `CONTEXT.md` (copiada do briefing) para os cards B3/B4; o `.pptx`
> de relatórios ainda não foi aberto — isso fica para o B12. Nenhum dado real foi
> copiado para este arquivo: só estrutura e nomes de campo, nunca nomes de pessoas,
números de processo, CPF/CNPJ ou valores reais.

## `.eml` — Formulário de pagamento (campo no e-mail → campo no sistema → origem)

| Campo no e-mail | Campo no sistema | Origem |
|---|---|---|
| RT (número do processo) | — | **Não armazenado como texto livre.** Só a pasta Projuris identifica o processo (LGPD) |
| Reclamante / Reclamada (nomes das partes) | — | **Não armazenado** (LGPD — é exatamente o motivo de usar a pasta Projuris no lugar do nome, já descrito no `CONTEXT.md`) |
| Projuris (nº da pasta) | `Lancamento.pastaProjuris` | usuário |
| Data para pagamento | `Solicitacao.dataPrevistaPagamento` | usuário |
| Data de envio do comprovante | anexo `COMPROVANTE` (B13) | usuário |
| Verbas que compõem a condenação (texto livre, motivo do dano moral etc.) | `Solicitacao.observacao` | usuário |
| Tipo da ação (TRAB/RAT) | `Lancamento.tipoAcao` *(novo campo, B6)* | usuário |
| Forma de pagamento (Guia/Depósito Judicial/transferência/adiantamento) | `Solicitacao.formaPagamento` (BOLETO/DEPOSITO_JUDICIAL/TED) + `tipoFluxo` (adiantamento vira `ANEXO_V_ADIANTAMENTO`) | usuário |
| Valor TOTAL do pagamento | `Solicitacao.valorTotal` | calculado (soma principal+juros) |
| Valor dos juros e correção monetária | `Lancamento.valorJurosCorrecao` | usuário / IA |
| Valor principal sem juros | `Lancamento.valorPrincipal` | usuário / IA |
| Valor provisão na pasta Projuris | `Lancamento.valorProvisaoProjuris` *(novo campo, B6, informativo)* | usuário |
| Tipo do pagamento (acordo/condenação/custas/recurso/depósito) | `Lancamento.motivo` | usuário (dropdown) |
| Cargo do reclamante, período imprescrito, abatimento de depósito recursal, apólice de seguro garantia, liberação de valores | — | **Fora do escopo do MVP** — são detalhes jurídicos que não alimentam o fluxo de pagamento/contábil; ficam só no e-mail/processo, não no sistema |
| PIF/PDV (Sim/Não) | `Lancamento.area` = `TRABALHISTA PIF/PDV` quando "Sim" | usuário |
| SIBEL (conforme BENNER) | — | **Fora do escopo** — código de outro sistema interno (Benner), sem equivalente no de-para contábil deste MVP |

**Divergência com o `CONTEXT.md`:** a lista real de "tipo do pagamento" no e-mail
(acordo/condenação/custas processuais/recurso/depósito) não é idêntica à lista de
motivos do dropdown do briefing (Condenação, Acordo, Acordo Projeto SAC, Custas
Processuais, Multa, Depósito Judicial, Seguro garantia, Perícia, Honorários,
Outros). Decisão: manter a lista do `CONTEXT.md` como canônica no formulário (B6),
já que é a que tem de-para mapeado; "recurso" sem de-para específico cai em
`DE_PARA_INEXISTENTE` se escolhido, o que está correto (alerta B7).
