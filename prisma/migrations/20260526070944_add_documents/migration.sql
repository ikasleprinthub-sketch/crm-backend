/*
  Warnings:

  - You are about to drop the column `eveningPlan` on the `attendance` table. All the data in the column will be lost.
  - You are about to drop the column `nightPlan` on the `attendance` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('AADHAR', 'PAN', 'GST', 'PHOTO', 'OTHER');

-- AlterTable
ALTER TABLE "attendance" DROP COLUMN "eveningPlan",
DROP COLUMN "nightPlan";

-- CreateTable
CREATE TABLE "lead_documents" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "originalName" TEXT NOT NULL,
    "savedName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_documents" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "savedName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
