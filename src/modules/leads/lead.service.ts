import { prisma } from "../../lib/prisma";
import { LeadStatus } from "@prisma/client";

// CREATE LEAD
export const createLead = async (data: any) => {
  const leadNo = `L-${Date.now()}`;

  // Find existing client by business name (case-insensitive) or create one
  let client = await prisma.client.findFirst({
    where: { businessName: { equals: data.leadName, mode: 'insensitive' } },
  });
  if (!client) {
    client = await prisma.client.create({
      data: { businessName: data.leadName },
    });
  }

  return prisma.lead.create({
    data: {
      leadNo,
      date: new Date(),
      clientId: client.id,
      sourceId: data.sourceId,
      leadName: data.leadName,
      contactName: data.contactName,
      contactNumber: data.contactNumber,
      email: data.email,
      departmentId: data.departmentId,
      taskTypeId: data.taskTypeId,
      remarks: data.remarks,
    },
  });
};

// GET LEADS
export const getLeads = async () => {
  return prisma.lead.findMany({
    include: {
      source: true,
      department: true,
      taskType: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

// GET SINGLE LEAD
export const getLeadById = async (id: string) => {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      source: true,
      department: true,
      taskType: true,
      tasks: true,
    },
  });
};

// UPDATE LEAD
export const updateLead = async (id: string, data: any) => {
  return prisma.lead.update({
    where: { id },
    data,
  });
};

// DELETE LEAD
export const deleteLead = async (id: string) => {
  return prisma.lead.delete({
    where: { id },
  });
};

// 🔥 CONVERT LEAD → TASK (MOST IMPORTANT)
export const convertLeadToTask = async (leadId: string, user: any) => {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) throw new Error("Lead not found");

  if (lead.status === "CONVERTED") {
    throw new Error("Lead already converted");
  }

  // 🔥 STEP 1: UPDATE LEAD STATUS
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: LeadStatus.CONVERTED },
  });

  // 🔥 STEP 2: CREATE TASK
  const taskNo = `T-${Date.now()}`;

  const task = await prisma.task.create({
    data: {
      taskNo,
      leadId: lead.id,
      departmentId: lead.departmentId,
      taskTypeId: lead.taskTypeId,
      remarks: lead.remarks,
      contactName: lead.contactName,
      contactNumber: lead.contactNumber,
      email: lead.email,

      // Assign default (IMPORTANT)
      assignedToId: user.id,
    },
  });

  // 🔥 STEP 3: CREATE SOP STEPS
  const template = await prisma.sOPTemplate.findUnique({
    where: { taskTypeId: lead.taskTypeId },
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

  // Activity Log
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      taskId: task.id,
      action: "LEAD_CONVERTED",
      message: `Lead ${lead.leadName} converted`,
    },
  });

  return task;
};
