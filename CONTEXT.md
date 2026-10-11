# Contexto do negócio — GAVVE (Jurídico Renault Geely do Brasil)

> Cópia da seção 1 do briefing do Transformation Day (Insper, equipe "Esquadrão Raposa –
> GAVVE"). Fonte da verdade para regras de negócio; em caso de divergência com os
> arquivos de `docs/refs/` (removidos do repo, só locais), os arquivos de referência
> prevalecem — ver `docs/REFS_RESUMO.md`.

## Problema

A analista do Jurídico (Natiele) recebe pedidos de pagamento dos escritórios parceiros
por e-mail e planilha. Ela confere tudo à mão, copia e cola os mesmos dados na planilha
de controle e no portal SSC/LBS (onde abre o chamado de pagamento), monta à mão o Excel
de rateio contábil e gera relatórios mensais em tabelas dinâmicas. Uma única prestação
de contas real (22/09) teve 187 linhas e R$ 1.513.365,90 digitadas manualmente.
Comprovantes de pagamento não ficam guardados em lugar nenhum. O Projuris não é usado
na operação: o nº da pasta Projuris serve só como referência do processo, no lugar do
nome da parte (LGPD).

## Perfis

- `ESCRITORIO` — o escritório parceiro, que cria solicitações
- `ANALISTA` — a Natiele, que confere, aprova, abre o chamado e registra o pagamento
- `GESTOR` — vê dashboards e usa o assistente de IA

## Fluxos (`tipoFluxo`)

- `ANEXO_V_ADIANTAMENTO`, `ANEXO_V_BAIXA` (prestação de contas), `ANEXO_V_REEMBOLSO` →
  via Anexo V no portal SSC
- `RC_HONORARIOS_NF` → honorários pagos com Nota Fiscal (PDF obrigatório)
- `RBS_DD_GUIA` → condenação ou acordo pago por guia/boleto judicial (PDF da guia
  obrigatório)

## De-para contábil

(Área + Motivo → Centro de custo, Conta, Ordem Interna). A Ordem Interna é chamada de
"zedoa" e muda a cada ano.

| Área | Motivo | Centro de custo | Conta | Ordem Interna |
|---|---|---|---|---|
| CONSUMIDOR | PROJETO SAC | GI85032 | 681554 | ZDOA00429016 |
| CONSUMIDOR | ACORDO | GI85032 | 681554 | ZDOA00429018 |
| CONSUMIDOR | CONDENAÇÃO/CUSTAS | GI85032 | 681554 | ZDOA00003018 |
| CÍVEL | CONDENAÇÃO/CUSTAS | GI85163 | 681554 | ZDOA00003018 |
| REDE | CONDENAÇÃO/CUSTAS | GI85162 | 681554 | ZDOA00003018 |
| TRABALHISTA PIF/PDV | CONDENAÇÃO | GI85031 | 681580 | ZDOACONPIF24 |
| (qualquer) | JUROS E CORREÇÃO | **GI85030** | **686242** | herda a do principal |

- Motivos do dropdown: Condenação, Acordo, Acordo Projeto SAC, Custas Processuais,
  Multa, Depósito Judicial, Seguro garantia, Perícia, Honorários, Outros. Motivos como
  "Custas", "Multa", "Depósito Judicial" etc. seguem a linha CONDENAÇÃO/CUSTAS da área.
- "Juros e Correção" não é um motivo: é um campo de valor de cada lançamento
  (`valorJurosCorrecao`).
- Os dados contábeis nunca são digitados pelo usuário: o servidor sempre os calcula
  pelo de-para.

## Principal + juros

Cada lançamento tem `valorPrincipal` e `valorJurosCorrecao`. O valor dos juros vem da
guia ou do cálculo judicial, não é uma % fixa.

## Excel de rateio

Formato exato do arquivo real (confira em `docs/refs/RATEIO CONTABILIDADE PRESTACAO DE
CONTAS ACC 23.09.xlsx`, fora do repositório — só local):

- Aba `Planilha1`, cabeçalho na linha 1, colunas A–P: `CHAVE DE LANÇAMENTO | DEB/CRED |
  CONTA | REFERENCIA | ELEMENTO PEP | ORDEM INTERNA | CENTRO DE CUSTO | TIPO DE
  ATIVIDADE | VALOR | MOEDA | TEXTO CAB. DOCUMENTO | DT LANÇAMENTO | DT DO DOCUMENTO |
  ATRIBUIÇÃO | NUMERO DO ATIVO | TEXTO MÊS DE REFERENCIA`
- Por lançamento:
  - linha 40/Deb do principal: conta, ordem interna e centro de custo do de-para;
    ATRIBUIÇÃO = nº da pasta; TEXTO MÊS = motivo
  - se houver juros, linha 40/Deb com conta 686242, centro de custo GI85030, a mesma
    ordem interna do principal e TEXTO MÊS = "Juros e Correção"
- No final, uma linha 31/Cred com a soma de todos os débitos:
  - Anexo V / baixa de adiantamento → conta 108067, REFERENCIA e TEXTO CAB. =
    `Baixa de adiantamento <escritório>`
  - RBS_DD → conta = código SAP do fornecedor (ex.: 40761 = TRT 9ª Região)
- Datas como texto `dd.mm.aaaa`. Valores com 2 casas decimais. Soma dos débitos =
  crédito, senão erro 422.
- Exemplo real (RBS_DD):
  ```
  40 Deb 681580 ref 541047 ZDOACONPIF24 GI85031 557380,92
  40 Deb 686242 ref 541047 ZDOACONPIF24 GI85030 208582,40
  31 Cred 40761 765963,32
  ```

## Chamado RBS_DD no portal SSC

Campos na ordem da tela (confira em `docs/refs/Abertura de chamado para pagamento de
condenações Jurídico.pdf`, fora do repositório — só local):

- Empresa Aprovadora `0483` · Empresa Consumidora `0483` · Fornecedor (código SAP –
  nome – CNPJ)
- Nome do Solicitante `Pagamentos Jurídico`
- Identificação do Documento · Data do Documento · Data de Pagamento · Moeda `BRL` ·
  Valor Total
- Forma de Pagamento (`Boleto`) · Motivo da demanda
- Natureza de gasto `0007 - Acts and…`
- Observação
- Classificação `Despesas administrativas (Centro de Custo)` · Descrição · Alocação
  `0007 - 622700 - CUSTOS DE ATOS E LITÍGIOS` · CeCu Aprovador `GI52000` · CeCu
  Consumidor · ZEDOA · Conta Contábil · Pagamento possui rateio? (`Sim` se houver juros)
- Título `<Motivo> <dd/mm do pagamento>`
- Anexos: guia + rateio.xlsx

Os valores fixos ficam em uma tabela/arquivo de configuração (`configuracaoChamado`),
não no código.

## Integração LBS/SAP

É **simulada** (mock). Nunca automatizar o portal `portalssc.renault.br` nem tentar
contornar captcha.

## Dados e LGPD

Os códigos contábeis deste documento são reais e podem ser usados. Valores, nomes de
escritórios, números de pasta e pessoas usados em código, seed, testes e documentação
são sempre fictícios.
