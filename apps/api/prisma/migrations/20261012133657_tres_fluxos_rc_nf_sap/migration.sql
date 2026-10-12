-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusSolicitacao" ADD VALUE 'RC_CRIADO';
ALTER TYPE "StatusSolicitacao" ADD VALUE 'NF_LANCADA';
ALTER TYPE "StatusSolicitacao" ADD VALUE 'PAGAMENTO_PROGRAMADO';

-- AlterTable
ALTER TABLE "Solicitacao" ADD COLUMN     "numeroDocumentoSap" TEXT,
ADD COLUMN     "numeroRc" TEXT,
ADD COLUMN     "protocoloNf" TEXT;
