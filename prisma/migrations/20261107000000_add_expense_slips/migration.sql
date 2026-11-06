-- CreateTable
CREATE TABLE "ExpenseSlip" (
    "id" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" VARCHAR(20) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'THB',
    "paidDate" DATE NOT NULL,
    "paidTime" VARCHAR(5),
    "payee" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "note" TEXT,
    "subscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveConnection" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "encryptedRefreshToken" TEXT NOT NULL,
    "folderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseSlip_driveFileId_key" ON "ExpenseSlip"("driveFileId");

-- CreateIndex
CREATE INDEX "ExpenseSlip_paidDate_idx" ON "ExpenseSlip"("paidDate");

-- AddForeignKey
ALTER TABLE "ExpenseSlip" ADD CONSTRAINT "ExpenseSlip_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
