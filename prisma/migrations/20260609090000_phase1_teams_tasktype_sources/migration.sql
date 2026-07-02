-- Phase 1: Teams, Task Types, Lead Sources - Add new fields to existing tables

-- AlterTable departments
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex for departments code
CREATE UNIQUE INDEX IF NOT EXISTS "departments_code_key" ON "departments"("code");

-- AlterTable task_types
ALTER TABLE "task_types" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "task_types" ADD COLUMN IF NOT EXISTS "slaDays" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "task_types" ADD COLUMN IF NOT EXISTS "defaultPriority" "Priority" NOT NULL DEFAULT 'REGULAR';
ALTER TABLE "task_types" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "task_types" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable sources_of_lead
ALTER TABLE "sources_of_lead" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "sources_of_lead" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "sources_of_lead" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "sources_of_lead" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
