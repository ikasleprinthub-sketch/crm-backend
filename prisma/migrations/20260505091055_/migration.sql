-- AlterTable
ALTER TABLE "sop_steps" ADD COLUMN     "assignedRole" "Role" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "deadlineHours" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "task_sop_steps" ADD COLUMN     "assignedRole" "Role" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "deadlineHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dueAt" TIMESTAMP(3);
