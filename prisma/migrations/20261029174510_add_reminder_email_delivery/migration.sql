-- CreateEnum
CREATE TYPE "ReminderEmailStatus" AS ENUM ('NOT_QUEUED', 'PENDING', 'SENDING', 'SENT', 'ERROR', 'SKIPPED');

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "emailAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "emailErrorCode" VARCHAR(100),
ADD COLUMN     "emailMessageId" TEXT,
ADD COLUMN     "emailSentAt" TIMESTAMP(3),
ADD COLUMN     "emailStatus" "ReminderEmailStatus" NOT NULL DEFAULT 'NOT_QUEUED';
