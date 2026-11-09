-- CreateTable
CREATE TABLE "CategoryBudget" (
    "category" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryBudget_pkey" PRIMARY KEY ("category")
);
