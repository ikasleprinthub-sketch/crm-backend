import { prisma } from "../../lib/prisma";
import { TaskStatus } from "@prisma/client";

// CREATE TASK
export const createTask = async (data: any, user: any) => {
  if (!data.leadId) throw new Error("Lead is required");

  const taskNo = `T-${Date.now()}`;

  const task = await prisma.task.create({
    data: {
      taskNo,
      leadId: data.leadId,
      departmentId: data.departmentId,
      taskTypeId: data.taskTypeId,
      remarks: data.remarks,
      contactName: data.contactName,
      contactNumber: data.contactNumber,
      email: data.email,
      assignedToId: data.assignedToId,
    },
  });

  // 🔥 AUTO CREATE SOP STEPS
  const template = await prisma.sOPTemplate.findUnique({
    where: { taskTypeId: data.taskTypeId },
    include: { steps: true },
  });

  if (template) {
    const sopSteps = template.steps.map((step: any) => ({
      taskId: task.id,
      title: step.title,
      order: step.order,
    }));

    await prisma.taskSOPStep.createMany({
      data: sopSteps,
    });
  }

  return task;
};

// GET TASKS (ROLE BASED)
export const getTasks = async (user: any) => {
  if (user.role === "ADMIN") {
    return prisma.task.findMany({
      include: { assignedTo: true, lead: true },
    });
  }

  if (user.role === "MANAGER") {
    return prisma.task.findMany({
      where: {
        assignedTo: {
          managerId: user.id,
        },
      },
      include: { assignedTo: true },
    });
  }

  if (user.role === "EMPLOYEE") {
    return prisma.task.findMany({
      where: { assignedToId: user.id },
    });
  }
};

// UPDATE TASK STATUS
export const updateTaskStatus = async (taskId: string, status: any, user: any) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { sopSteps: true },
  });

  if (!task) throw new Error("Task not found");

  // 🔥 VALIDATION: SOP MUST COMPLETE
  if (status === "COMPLETED") {
    const incomplete = task.sopSteps.some((s: any) => !s.isCompleted);
    if (incomplete) {
      throw new Error("Complete all SOP steps first");
    }

    // Manager approval
    if (user.role !== "MANAGER" && user.role !== "ADMIN") {
      throw new Error("Only manager/admin can complete");
    }
  }

  return prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      ...(status === "WORK_IN_PROGRESS" && { startDate: new Date() }),
      ...(status === "COMPLETED" && { completionDate: new Date() }),
    },
  });
};

// ASSIGN TASK
export const assignTask = async (taskId: string, assignedToId: string, user: any) => {
  if (user.role === "MANAGER") {
    const employee = await prisma.user.findUnique({
      where: { id: assignedToId },
    });

    if (!employee || employee.managerId !== user.id) {
      throw new Error("You can assign only your team");
    }
  }

  return prisma.task.update({
    where: { id: taskId },
    data: { assignedToId },
  });
};

// UPDATE SOP STEP
export const updateSOPStep = async (stepId: string) => {
  return prisma.taskSOPStep.update({
    where: { id: stepId },
    data: {
      isCompleted: true,
      completedAt: new Date(),
    },
  });
};
