-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('WEB', 'TELEGRAM');

-- AlterTable
ALTER TABLE "ExpenseSlip" ADD COLUMN     "source" "ExpenseSource" NOT NULL DEFAULT 'WEB',
ALTER COLUMN "driveFileId" DROP NOT NULL,
ALTER COLUMN "fileName" DROP NOT NULL,
ALTER COLUMN "contentType" DROP NOT NULL,
ALTER COLUMN "sizeBytes" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TelegramUpdate" (
    "updateId" BIGINT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramUpdate_pkey" PRIMARY KEY ("updateId")
);

-- CreateIndex
CREATE INDEX "ExpenseSlip_source_createdAt_idx" ON "ExpenseSlip"("source", "createdAt");
