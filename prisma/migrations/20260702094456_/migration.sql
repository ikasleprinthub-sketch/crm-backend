-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONVERTED', 'HOLD_BY_LEAD', 'NOT_RESPONDED', 'DROPPED', 'AWAITING_CONFIRMATION', 'MEETING_SCHEDULED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_YET_STARTED', 'DATA_NOT_RECEIVED', 'WORK_IN_PROGRESS', 'PENDING_FOR_APPROVAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('REGULAR', 'IMPORTANT', 'URGENT');

-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('ON_TIME', 'LATE', 'VERY_LATE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('NOT_MARKED', 'PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'SUNDAY');

-- CreateEnum
CREATE TYPE "PermissionStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PermissionType" AS ENUM ('HALF_DAY', 'LEAVE', 'LATE_PERMISSION');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('AADHAR', 'PAN', 'GST', 'PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurrenceInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "managerId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "requestedById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "description" TEXT,
    "slaDays" INTEGER NOT NULL DEFAULT 3,
    "defaultPriority" "Priority" NOT NULL DEFAULT 'REGULAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources_of_lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_of_lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "leadNo" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sourceId" TEXT NOT NULL,
    "leadName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactNumber" TEXT,
    "email" TEXT,
    "departmentId" TEXT NOT NULL,
    "taskTypeId" TEXT NOT NULL,
    "remarks" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "taskNo" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "taskTypeId" TEXT NOT NULL,
    "remarks" TEXT,
    "contactName" TEXT,
    "contactNumber" TEXT,
    "email" TEXT,
    "assignedToId" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_YET_STARTED',
    "priority" "Priority" NOT NULL DEFAULT 'REGULAR',
    "startDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isAutomated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sop_templates" (
    "id" TEXT NOT NULL,
    "taskTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sop_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sop_steps" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "assignedRole" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "deadlineHours" INTEGER NOT NULL DEFAULT 0,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "sop_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_sop_steps" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "assignedRole" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "deadlineHours" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_sop_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "action" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'NOT_MARKED',
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "totalHours" DOUBLE PRECISION,
    "morningPlan" TEXT,
    "afternoonPlan" TEXT,
    "dayCompletion" TEXT,
    "permission" "PermissionStatus" NOT NULL DEFAULT 'NONE',
    "permissionType" "PermissionType",
    "permissionReason" TEXT,
    "remarks" TEXT,
    "permissionApprovedById" TEXT,
    "checkInStatus" "CheckInStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "color" TEXT DEFAULT 'blue',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

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
    "clientId" TEXT,
    "uploadedById" TEXT,
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
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_audit_logs" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "oldStatus" "AttendanceStatus",
    "newStatus" "AttendanceStatus",
    "oldCheckIn" TIMESTAMP(3),
    "newCheckIn" TIMESTAMP(3),
    "oldCheckOut" TIMESTAMP(3),
    "newCheckOut" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_correction_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "date" DATE NOT NULL,
    "requestedStatus" "AttendanceStatus" NOT NULL,
    "requestedCheckIn" TIMESTAMP(3),
    "requestedCheckOut" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_correction_requests_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sources_of_lead_name_key" ON "sources_of_lead"("name");

-- CreateIndex
CREATE UNIQUE INDEX "leads_leadNo_key" ON "leads"("leadNo");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_taskNo_key" ON "tasks"("taskNo");

-- CreateIndex
CREATE UNIQUE INDEX "sop_templates_taskTypeId_key" ON "sop_templates"("taskTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_userId_date_key" ON "attendance"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_task_configs_leadId_key" ON "recurring_task_configs"("leadId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources_of_lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "task_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "task_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sop_templates" ADD CONSTRAINT "sop_templates_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "task_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sop_steps" ADD CONSTRAINT "sop_steps_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "sop_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_sop_steps" ADD CONSTRAINT "task_sop_steps_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_sop_steps" ADD CONSTRAINT "task_sop_steps_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_permissionApprovedById_fkey" FOREIGN KEY ("permissionApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_configs" ADD CONSTRAINT "recurring_task_configs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_configs" ADD CONSTRAINT "recurring_task_configs_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
