-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ESCRITORIO', 'ANALISTA', 'GESTOR');

-- CreateEnum
CREATE TYPE "TipoFluxo" AS ENUM ('ANEXO_V_ADIANTAMENTO', 'ANEXO_V_BAIXA', 'ANEXO_V_REEMBOLSO', 'RC_HONORARIOS_NF', 'RBS_DD_GUIA');

-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('RASCUNHO', 'ENVIADO', 'EM_CONFERENCIA', 'DEVOLVIDO', 'APROVADO', 'CHAMADO_ABERTO', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('BOLETO', 'TED', 'DEPOSITO_JUDICIAL');

-- CreateEnum
CREATE TYPE "TipoAnexo" AS ENUM ('GUIA', 'NF', 'RATEIO_XLSX', 'COMPROVANTE', 'OUTRO');

-- CreateEnum
CREATE TYPE "Severidade" AS ENUM ('AMARELO', 'VERMELHO');

-- CreateEnum
CREATE TYPE "Semaforo" AS ENUM ('VERDE', 'AMARELO', 'VERMELHO');

-- CreateTable
CREATE TABLE "Usuario" (
    "firebaseUid" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "escritorioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("firebaseUid")
);

-- CreateTable
CREATE TABLE "Escritorio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escritorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "codigoSap" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeParaContabil" (
    "id" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "centroCusto" TEXT NOT NULL,
    "contaContabil" TEXT NOT NULL,
    "ordemInterna" TEXT,
    "ano" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeParaContabil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solicitacao" (
    "id" TEXT NOT NULL,
    "tipoFluxo" "TipoFluxo" NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'RASCUNHO',
    "numeroChamado" TEXT,
    "numeroDocumentoLbs" TEXT,
    "dataDocumento" TIMESTAMP(3) NOT NULL,
    "dataPrevistaPagamento" TIMESTAMP(3),
    "dataPagamento" TIMESTAMP(3),
    "formaPagamento" "FormaPagamento" NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lancamento" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "pastaProjuris" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "valorPrincipal" DECIMAL(14,2) NOT NULL,
    "valorJurosCorrecao" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "centroCusto" TEXT NOT NULL,
    "contaContabil" TEXT NOT NULL,
    "ordemInterna" TEXT,
    "semaforo" "Semaforo" NOT NULL DEFAULT 'VERDE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anexo" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "tipo" "TipoAnexo" NOT NULL,
    "caminho" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "dadosExtraidos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "lancamentoId" TEXT,
    "codigo" TEXT NOT NULL,
    "severidade" "Severidade" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "resolvidoPorId" TEXT,
    "resolvidoEm" TIMESTAMP(3),
    "justificativa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comentario" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Historico" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "diff" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoChamado" (
    "id" TEXT NOT NULL,
    "empresaAprovadora" TEXT NOT NULL,
    "empresaConsumidora" TEXT NOT NULL,
    "nomeSolicitante" TEXT NOT NULL,
    "naturezaGasto" TEXT NOT NULL,
    "classificacao" TEXT NOT NULL,
    "alocacao" TEXT NOT NULL,
    "ceCuAprovador" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoChamado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_escritorioId_idx" ON "Usuario"("escritorioId");

-- CreateIndex
CREATE UNIQUE INDEX "Escritorio_cnpj_key" ON "Escritorio"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_codigoSap_key" ON "Fornecedor"("codigoSap");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_cnpj_key" ON "Fornecedor"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "DeParaContabil_area_motivo_ano_key" ON "DeParaContabil"("area", "motivo", "ano");

-- CreateIndex
CREATE INDEX "Solicitacao_escritorioId_idx" ON "Solicitacao"("escritorioId");

-- CreateIndex
CREATE INDEX "Solicitacao_status_idx" ON "Solicitacao"("status");

-- CreateIndex
CREATE INDEX "Lancamento_solicitacaoId_idx" ON "Lancamento"("solicitacaoId");

-- CreateIndex
CREATE INDEX "Lancamento_pastaProjuris_idx" ON "Lancamento"("pastaProjuris");

-- CreateIndex
CREATE INDEX "Anexo_solicitacaoId_idx" ON "Anexo"("solicitacaoId");

-- CreateIndex
CREATE INDEX "Alerta_solicitacaoId_idx" ON "Alerta"("solicitacaoId");

-- CreateIndex
CREATE INDEX "Alerta_lancamentoId_idx" ON "Alerta"("lancamentoId");

-- CreateIndex
CREATE INDEX "Comentario_solicitacaoId_idx" ON "Comentario"("solicitacaoId");

-- CreateIndex
CREATE INDEX "Historico_entidade_entidadeId_idx" ON "Historico"("entidade", "entidadeId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("firebaseUid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_resolvidoPorId_fkey" FOREIGN KEY ("resolvidoPorId") REFERENCES "Usuario"("firebaseUid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("firebaseUid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("firebaseUid") ON DELETE RESTRICT ON UPDATE CASCADE;
