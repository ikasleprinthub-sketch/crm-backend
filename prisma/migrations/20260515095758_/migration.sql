-- AlterTable
ALTER TABLE "task_sop_steps" ADD COLUMN     "completedById" TEXT;

-- AddForeignKey
ALTER TABLE "task_sop_steps" ADD CONSTRAINT "task_sop_steps_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
