-- CreateEnum
CREATE TYPE "RecurrenceInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "isAutomated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "recurring_task_configs" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "interval" "RecurrenceInterval" NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_task_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recurring_task_configs_leadId_key" ON "recurring_task_configs"("leadId");

-- AddForeignKey
ALTER TABLE "recurring_task_configs" ADD CONSTRAINT "recurring_task_configs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_configs" ADD CONSTRAINT "recurring_task_configs_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
