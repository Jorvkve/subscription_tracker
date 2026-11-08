-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "telegramAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "telegramErrorCode" VARCHAR(100),
ADD COLUMN     "telegramSentAt" TIMESTAMP(3);
