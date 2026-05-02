import { AttendanceStatus, PermissionStatus, PermissionType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { createNotification } from '../notifications/notifications.service';

function getTodayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

function isLateCheckIn(time: Date): boolean {
  const cutoff = new Date(time);
  cutoff.setHours(10, 0, 0, 0);
  return time > cutoff;
}

export async function checkIn(userId: string) {
  const today = getTodayDate();

  if (isSunday(today)) throw new AppError('Cannot check in on Sunday', 400);

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (existing?.checkIn) throw new AppError('Already checked in today', 400);

  const now = new Date();
  const late = isLateCheckIn(now);

  return prisma.attendance.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today, checkIn: now, status: late ? 'LATE' : 'PRESENT' },
    update: { checkIn: now, status: late ? 'LATE' : 'PRESENT' },
  });
}

export async function checkOut(userId: string, dayCompletion?: string) {
  const today = getTodayDate();

  const record = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (!record?.checkIn) throw new AppError('Must check in before checking out', 400);
  if (record.checkOut) throw new AppError('Already checked out today', 400);

  const now = new Date();
  const totalHours = (now.getTime() - record.checkIn.getTime()) / 3_600_000;

  let status: AttendanceStatus = record.status;
  if (totalHours < 4 && status !== 'LEAVE') status = 'HALF_DAY';

  return prisma.attendance.update({
    where: { userId_date: { userId, date: today } },
    data: {
      checkOut: now,
      totalHours: parseFloat(totalHours.toFixed(2)),
      dayCompletion: dayCompletion ?? record.dayCompletion,
      status,
    },
  });
}

export async function submitMorningPlan(userId: string, morningPlan: string) {
  const today = getTodayDate();

  const record = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (!record?.checkIn) throw new AppError('Must check in before submitting morning plan', 400);

  return prisma.attendance.update({
    where: { userId_date: { userId, date: today } },
    data: { morningPlan },
  });
}

export async function getTodayAttendance(userId: string) {
  const today = getTodayDate();

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (existing) return existing;

  return prisma.attendance.create({
    data: {
      userId,
      date: today,
      status: isSunday(today) ? 'SUNDAY' : 'NOT_MARKED',
    },
  });
}

export async function getMyAttendance(userId: string, month?: number, year?: number) {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);

  return prisma.attendance.findMany({
    where: { userId, date: { gte: start, lte: end } },
    orderBy: { date: 'desc' },
  });
}

export async function applyPermission(
  userId: string,
  permissionType: PermissionType,
  reason: string,
  dateStr?: string,
) {
  const target = dateStr ? new Date(dateStr) : new Date();
  target.setHours(0, 0, 0, 0);

  const record = await prisma.attendance.upsert({
    where: { userId_date: { userId, date: target } },
    create: {
      userId,
      date: target,
      status: 'NOT_MARKED',
      permission: 'PENDING',
      permissionType,
      permissionReason: reason,
    },
    update: { permission: 'PENDING', permissionType, permissionReason: reason },
  });

  // Notify manager and Superadmins
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    const recipients = new Set<string>();
    
    // 1. Add direct manager if exists
    if (user.managerId) recipients.add(user.managerId);
    
    // 2. Add all Superadmins and Admins (Leads)
    const admins = await prisma.user.findMany({
      where: { 
        role: { in: ['SUPER_ADMIN', 'ADMIN'] },
        status: 'ACTIVE' 
      },
      select: { id: true }
    });
    admins.forEach(a => recipients.add(a.id));

    // Notify the employee (requester)
    await createNotification({
      userId:  userId,
      title:   'Request Submitted',
      message: `Your request for ${permissionType.replace(/_/g, ' ')} on ${target.toDateString()} has been sent for approval.`,
      type:    'PERMISSION_SENT',
      link:    '/attendance',
    });

    // Send notifications to all recipients except the requester themselves
    for (const recipientId of recipients) {
      if (recipientId === userId) continue;
      
      await createNotification({
        userId:  recipientId,
        title:   'Approval Required',
        message: `${user.name} has requested a ${permissionType.replace(/_/g, ' ')} for ${target.toDateString()}. Please review and approve.`,
        type:    'PERMISSION_REQUEST',
        link:    '/attendance?tab=permissions',
      });
    }
  }

  return record;
}

export async function getPendingPermissions(requesterId: string, requesterRole: string) {
  if (requesterRole === 'MANAGER') {
    const team = await prisma.user.findMany({ where: { managerId: requesterId, status: 'ACTIVE' } });
    const ids = team.map((m) => m.id);
    return prisma.attendance.findMany({
      where: { userId: { in: ids }, permission: 'PENDING' },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { date: 'desc' },
    });
  }

  // Admins can see all but they shouldn't approve other Admins (per user request)
  // So for Admin role, we filter out other Admins
  if (requesterRole === 'ADMIN') {
    return prisma.attendance.findMany({
      where: { 
        permission: 'PENDING',
        user: { role: { in: ['MANAGER', 'EMPLOYEE'] } }
      },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { date: 'desc' },
    });
  }

  // Super Admin sees everything
  return prisma.attendance.findMany({
    where: { permission: 'PENDING' },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { date: 'desc' },
  });
}

export async function approvePermission(id: string, approverId: string) {
  const record = await prisma.attendance.findUnique({ 
    where: { id },
    include: { user: { select: { role: true } } }
  });
  if (!record) throw new AppError('Record not found', 404);
  if (record.permission !== 'PENDING') throw new AppError('Permission is not pending', 400);

  // Check if approver is allowed
  const approver = await prisma.user.findUnique({ where: { id: approverId } });
  if (!approver) throw new AppError('Approver not found', 404);

  // Rule: Admin requests can only be approved by Super Admin
  if (record.user.role === 'ADMIN' && approver.role !== 'SUPER_ADMIN') {
    throw new AppError('Only Super Admins can approve Admin leave requests', 403);
  }

  let status: AttendanceStatus = record.status;
  if (record.permissionType === 'HALF_DAY') status = 'HALF_DAY';
  else if (record.permissionType === 'LEAVE') status = 'LEAVE';
  else if (record.permissionType === 'LATE_PERMISSION' && status === 'LATE') status = 'PRESENT';

  const updated = await prisma.attendance.update({
    where: { id },
    data: { permission: 'APPROVED', permissionApprovedById: approverId, status },
  });

  // Notify employee
  const typeStr = (record.permissionType || 'permission').replace('_', ' ').toLowerCase();
  const dateStr = record.date instanceof Date ? record.date.toDateString() : new Date(record.date).toDateString();

  await createNotification({
    userId:  record.userId,
    title:   'Permission Approved',
    message: `Your request for ${typeStr} on ${dateStr} has been approved.`,
    type:    'PERMISSION_APPROVED',
    link:    '/attendance',
  });

  return updated;
}

export async function rejectPermission(id: string, approverId: string) {
  const record = await prisma.attendance.findUnique({ 
    where: { id },
    include: { user: { select: { role: true } } }
  });
  if (!record) throw new AppError('Record not found', 404);
  if (record.permission !== 'PENDING') throw new AppError('Permission is not pending', 400);

  // Check if approver is allowed
  const approver = await prisma.user.findUnique({ where: { id: approverId } });
  if (!approver) throw new AppError('Approver not found', 404);

  // Rule: Admin requests can only be rejected by Super Admin
  if (record.user.role === 'ADMIN' && approver.role !== 'SUPER_ADMIN') {
    throw new AppError('Only Super Admins can reject Admin leave requests', 403);
  }

  const updated = await prisma.attendance.update({
    where: { id },
    data: { permission: 'REJECTED', permissionApprovedById: approverId },
  });

  // Notify employee
  const typeStr = (record.permissionType || 'permission').replace('_', ' ').toLowerCase();
  const dateStr = record.date instanceof Date ? record.date.toDateString() : new Date(record.date).toDateString();

  await createNotification({
    userId:  record.userId,
    title:   'Permission Rejected',
    message: `Your request for ${typeStr} on ${dateStr} has been rejected.`,
    type:    'PERMISSION_REJECTED',
    link:    '/attendance',
  });

  return updated;
}

export async function getTeamAttendance(managerId: string, dateStr?: string) {
  const target = dateStr ? new Date(dateStr) : new Date();
  target.setHours(0, 0, 0, 0);

  const team = await prisma.user.findMany({ where: { managerId, status: 'ACTIVE' } });
  const ids = team.map((m) => m.id);

  return prisma.attendance.findMany({
    where: { userId: { in: ids }, date: target },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
}

export async function getAllAttendance(dateStr?: string, month?: number, year?: number) {
  let where: Record<string, unknown> = {};

  if (dateStr) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    where.date = d;
  } else if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    where.date = { gte: start, lte: end };
  } else {
    const today = getTodayDate();
    where.date = today;
  }

  return prisma.attendance.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: [{ date: 'desc' }, { user: { name: 'asc' } }],
  });
}

export async function adminOverride(
  id: string,
  data: {
    status?: AttendanceStatus;
    checkIn?: string | null;
    checkOut?: string | null;
    permission?: PermissionStatus;
    remarks?: string;
  },
) {
  const record = await prisma.attendance.findUnique({ where: { id } });
  if (!record) throw new AppError('Record not found', 404);

  const update: Record<string, unknown> = {};
  if (data.status) update.status = data.status;
  if (data.permission) update.permission = data.permission;
  if (data.remarks !== undefined) update.remarks = data.remarks;
  if (data.checkIn !== undefined) update.checkIn = data.checkIn ? new Date(data.checkIn) : null;
  if (data.checkOut !== undefined) update.checkOut = data.checkOut ? new Date(data.checkOut) : null;

  const ci = (update.checkIn as Date | null) ?? record.checkIn;
  const co = (update.checkOut as Date | null) ?? record.checkOut;
  if (ci && co) {
    update.totalHours = parseFloat(((co.getTime() - ci.getTime()) / 3_600_000).toFixed(2));
  }

  return prisma.attendance.update({ where: { id }, data: update });
}

export async function autoMarkAttendance() {
  const today = getTodayDate();
  const sunday = isSunday(today);

  const users = await prisma.user.findMany({ where: { status: 'ACTIVE' } });

  return Promise.all(
    users.map((u) =>
      prisma.attendance.upsert({
        where: { userId_date: { userId: u.id, date: today } },
        create: { userId: u.id, date: today, status: sunday ? 'SUNDAY' : 'NOT_MARKED' },
        update: {},
      }),
    ),
  );
}

export async function getDashboardStats(role: string, userId: string) {
  const today = getTodayDate();
  const base: Record<string, unknown> = { date: today };

  if (role === 'MANAGER') {
    const team = await prisma.user.findMany({ where: { managerId: userId, status: 'ACTIVE' } });
    base.userId = { in: team.map((t) => t.id) };
  }

  const [present, absent, late, halfDay, pendingPermissions, approvedPermissions] =
    await Promise.all([
      prisma.attendance.count({ where: { ...base, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { ...base, status: 'ABSENT' } }),
      prisma.attendance.count({ where: { ...base, status: 'LATE' } }),
      prisma.attendance.count({ where: { ...base, status: 'HALF_DAY' } }),
      prisma.attendance.count({ where: { permission: 'PENDING' } }),
      prisma.attendance.count({ where: { ...base, permission: 'APPROVED' } }),
    ]);

  return { present, absent, late, halfDay, pendingPermissions, approvedPermissions };
}
