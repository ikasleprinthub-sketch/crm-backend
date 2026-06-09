import { prisma } from '../../lib/prisma';
import { Role } from '@prisma/client';

export interface PerformanceStats {
  userId: string;
  userName: string;
  role: Role;
  attendanceRate: number;
  taskCompletionRate: number;
  leadConversionRate: number;
  performanceScore: number;
}

export interface AttendanceAnalytics {
  date: string;
  present: number;
  absent: number;
  late: number;
}

export async function getAttendanceTrends(days: number = 30): Promise<AttendanceAnalytics[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const attendance = await prisma.attendance.findMany({
    where: {
      date: { gte: startDate },
    },
    select: {
      date: true,
      status: true,
      checkInStatus: true,
    },
    orderBy: { date: 'asc' },
  });

  const trendsMap = new Map<string, AttendanceAnalytics>();

  attendance.forEach((record) => {
    const dStr = record.date.toISOString().split('T')[0];
    if (!trendsMap.has(dStr)) {
      trendsMap.set(dStr, { date: dStr, present: 0, absent: 0, late: 0 });
    }
    const trend = trendsMap.get(dStr)!;
    if (record.status === 'PRESENT' || record.status === 'HALF_DAY') trend.present++;
    if (record.checkInStatus === 'LATE' || record.checkInStatus === 'VERY_LATE') trend.late++;
    if (record.status === 'ABSENT') trend.absent++;
  });

  return Array.from(trendsMap.values());
}

export async function getGlobalPerformance(): Promise<PerformanceStats[]> {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', NOT: { role: 'SUPER_ADMIN' } },
    select: { id: true, name: true, role: true },
  });

  const statsPromises = users.map(async (user) => {
    // 1. Attendance Metrics
    const totalDays = await prisma.attendance.count({ where: { userId: user.id, NOT: { status: 'NOT_MARKED' } } });
    const presentDays = await prisma.attendance.count({ where: { userId: user.id, status: { in: ['PRESENT', 'HALF_DAY'] } } });
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    // 2. Task Metrics
    const totalTasks = await prisma.task.count({ where: { assignedToId: user.id } });
    const completedTasks = await prisma.task.count({ where: { assignedToId: user.id, status: 'COMPLETED' } });
    const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // 3. Lead Metrics
    // Note: Lead conversion usually tracked by the person but we need to check if specific users are "Sales" or if we track by activity log
    // For now, let's look at all leads created or handled by user if applicable. 
    // In this schema, Leads are not directly "assigned" but Tasks are assigned. 
    // We can assume Leads related to the Tasks assigned to user.
    const leads = await prisma.lead.count({ where: { tasks: { some: { assignedToId: user.id } } } });
    const convertedLeads = await prisma.lead.count({ where: { status: 'CONVERTED', tasks: { some: { assignedToId: user.id } } } });
    const leadConversionRate = leads > 0 ? (convertedLeads / leads) * 100 : 0;

    // 4. Score Calculation (Weighted: Att 30%, Task 40%, Lead 30%)
    const performanceScore = (attendanceRate * 0.3) + (taskCompletionRate * 0.4) + (leadConversionRate * 0.3);

    return {
      userId: user.id,
      userName: user.name,
      role: user.role,
      attendanceRate: Math.round(attendanceRate),
      taskCompletionRate: Math.round(taskCompletionRate),
      leadConversionRate: Math.round(leadConversionRate),
      performanceScore: Math.round(performanceScore),
    };
  });

  return Promise.all(statsPromises);
}
