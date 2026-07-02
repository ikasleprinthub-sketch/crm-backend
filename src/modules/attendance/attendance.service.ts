import { AttendanceStatus, PermissionStatus, PermissionType, CheckInStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { createNotification } from '../notifications/notifications.service';
import { getConfig } from '../config/config.service';
import { emitGlobal } from '../../lib/socket';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getTodayDate(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

async function getCheckInStatus(time: Date): Promise<CheckInStatus> {
  const startTimeStr = await getConfig('officeStartTime', '10:00');
  const graceMinutes = parseInt(await getConfig('gracePeriodMinutes', '15'), 10);
  const [h, m] = startTimeStr.split(':').map(Number);

  const officialStart = new Date(time);
  officialStart.setHours(h, m, 0, 0);

  // ON_TIME = within grace period after official start
  const graceCutoff = new Date(officialStart);
  graceCutoff.setMinutes(graceCutoff.getMinutes() + graceMinutes);
  if (time <= graceCutoff) return 'ON_TIME';

  // VERY_LATE = 2+ hours after official start
  const veryLateCutoff = new Date(officialStart);
  veryLateCutoff.setHours(veryLateCutoff.getHours() + 2);
  if (time > veryLateCutoff) return 'VERY_LATE';

  return 'LATE';
}

// ── Employee Actions ───────────────────────────────────────────────────────────

export async function checkIn(userId: string) {
  const today = getTodayDate();

  if (isSunday(today)) throw new AppError('Cannot check in on Sunday', 400);

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (existing?.checkIn) throw new AppError('Already checked in today', 400);

  const now = new Date();
  const cis = await getCheckInStatus(now);
  const status: AttendanceStatus = cis === 'ON_TIME' ? 'PRESENT' : 'LATE';

  const record = await prisma.attendance.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today, checkIn: now, status, checkInStatus: cis },
    update: { checkIn: now, status, checkInStatus: cis },
  });

  if (cis !== 'ON_TIME') {
    const notifyLateCheckIn = (await getConfig('notifyLateCheckIn', 'true')) === 'true';
    if (notifyLateCheckIn) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const recipients = new Set<string>();
        if (user.managerId) recipients.add(user.managerId);
        const admins = await prisma.user.findMany({
          where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, status: 'ACTIVE' },
          select: { id: true },
        });
        admins.forEach(a => recipients.add(a.id));
        for (const recipientId of recipients) {
          await createNotification({
            userId: recipientId,
            title: 'Late Check-In',
            message: `${user.name} checked in ${cis === 'VERY_LATE' ? 'very late' : 'late'} at ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`,
            type: 'GENERAL',
            link: '/attendance',
          });
        }
      }
    }
  }

  emitGlobal('attendance:updated', record);
  return record;
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

  const halfDayThreshold = parseFloat(await getConfig('halfDayHours', '4'));
  let status: AttendanceStatus = record.status;
  if (totalHours < halfDayThreshold && status !== 'LEAVE') status = 'HALF_DAY';

  const updated = await prisma.attendance.update({
    where: { userId_date: { userId, date: today } },
    data: {
      checkOut: now,
      totalHours: parseFloat(totalHours.toFixed(2)),
      dayCompletion: dayCompletion ?? record.dayCompletion,
      status,
    },
  });
  emitGlobal('attendance:updated', updated);
  return updated;
}

export async function submitMorningPlan(userId: string, content: string) {
  const today = getTodayDate();
  const hour = new Date().getHours();

  let field: 'morningPlan' | 'afternoonPlan' = 'morningPlan';
  let planType = 'Morning';

  if (hour >= 12) {
    field = 'afternoonPlan';
    planType = 'Afternoon';
  }

  const record = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (!record?.checkIn) throw new AppError(`Must check in before submitting ${planType.toLowerCase()} plan`, 400);

  return prisma.attendance.update({
    where: { userId_date: { userId, date: today } },
    data: { [field]: content },
  });
}

export async function getTodayAttendance(userId: string) {
  const today = getTodayDate();

  const existing = await prisma.attendance.findFirst({
    where: { userId, date: today },
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

// ── Permissions ────────────────────────────────────────────────────────────────

export async function applyPermission(
  userId: string,
  permissionType: PermissionType,
  reason: string,
  dateStr?: string,
) {
  const [reasonMandatory, allowBackdated, approvalRequired, notifyPermSubmitted] = await Promise.all([
    getConfig('reasonMandatory', 'true').then(v => v === 'true'),
    getConfig('allowBackdated', 'false').then(v => v === 'true'),
    getConfig('approvalRequired', 'true').then(v => v === 'true'),
    getConfig('notifyPermSubmitted', 'true').then(v => v === 'true'),
  ]);

  if (reasonMandatory && (!reason || !reason.trim())) throw new AppError('Reason is required.', 400);
  if (reason && !/^[a-zA-Z0-9\s]+$/.test(reason)) throw new AppError('Invalid Reason: Reason must contain only letters, numbers, and spaces.', 400);

  const target = dateStr ? new Date(dateStr) : new Date();
  target.setUTCHours(0, 0, 0, 0);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (!allowBackdated && target < today) throw new AppError('Invalid Date: Backdated permissions are not allowed. Contact your admin.', 400);

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: target } },
  });

  if (existing && (existing.permission === 'PENDING' || existing.permission === 'APPROVED')) {
    const statusText = existing.permission.toLowerCase();
    const typeText = existing.permissionType?.replace('_', ' ').toLowerCase() || 'attendance';
    throw new AppError(`You already have a ${statusText} ${typeText} request for this date (${target.toLocaleDateString()}). No new request is needed.`, 400);
  }

  const initialStatus: PermissionStatus = approvalRequired ? 'PENDING' : 'APPROVED';

  // Compute attendance status changes for auto-approval
  let attendanceStatus: AttendanceStatus = existing?.status ?? 'NOT_MARKED';
  let checkInStatusOverride = existing?.checkInStatus ?? null;
  if (!approvalRequired) {
    if (permissionType === 'HALF_DAY') attendanceStatus = 'HALF_DAY';
    else if (permissionType === 'LEAVE') attendanceStatus = 'LEAVE';
    else if (permissionType === 'LATE_PERMISSION') checkInStatusOverride = 'ON_TIME';
  }

  const record = await prisma.attendance.upsert({
    where: { userId_date: { userId, date: target } },
    create: {
      userId, date: target, status: attendanceStatus,
      permission: initialStatus, permissionType, permissionReason: reason,
      checkInStatus: checkInStatusOverride,
    },
    update: {
      permission: initialStatus, permissionType, permissionReason: reason,
      status: attendanceStatus, checkInStatus: checkInStatusOverride,
    },
  });

  if (notifyPermSubmitted) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const recipients = new Set<string>();
      if (user.managerId) recipients.add(user.managerId);
      
      const targetRoles = ['SUPER_ADMIN'];
      if (user.role === 'EMPLOYEE' || user.role === 'MANAGER') {
        targetRoles.push('ADMIN');
      }
      
      const higherUps = await prisma.user.findMany({
        where: { role: { in: targetRoles as any }, status: 'ACTIVE' },
        select: { id: true },
      });
      higherUps.forEach(a => recipients.add(a.id));

      await createNotification({
        userId,
        title: approvalRequired ? 'Request Submitted' : 'Request Auto-Approved',
        message: approvalRequired
          ? `Your request for ${permissionType.replace(/_/g, ' ')} on ${target.toDateString()} has been sent for approval.`
          : `Your request for ${permissionType.replace(/_/g, ' ')} on ${target.toDateString()} has been automatically approved.`,
        type: 'PERMISSION_SENT',
        link: '/permissions',
      });

      if (approvalRequired) {
        for (const recipientId of recipients) {
          if (recipientId === userId) continue;
          await createNotification({
            userId: recipientId,
            title: 'Approval Required',
            message: `${user.name} has requested a ${permissionType.replace(/_/g, ' ')} for ${target.toDateString()}. Please review and approve.`,
            type: 'PERMISSION_REQUEST',
            link: '/permissions',
          });
        }
      }
    }
  }

  emitGlobal('attendance:updated', record);
  return record;
}

export async function updateMyPermission(id: string, userId: string, data: { permissionType?: PermissionType, reason?: string, dateStr?: string }) {
  const existing = await prisma.attendance.findUnique({ where: { id } });
  if (!existing) throw new AppError('Record not found', 404);
  if (existing.userId !== userId) throw new AppError('Forbidden', 403);
  if (existing.permission !== 'PENDING') throw new AppError('Only pending permissions can be edited', 400);

  const updateData: any = {};
  if (data.permissionType) updateData.permissionType = data.permissionType;
  if (data.reason) updateData.permissionReason = data.reason;

  if (data.dateStr) {
    const targetDate = new Date(data.dateStr);
    targetDate.setUTCHours(0, 0, 0, 0);
    if (existing.date.getTime() !== targetDate.getTime()) {
      const conflict = await prisma.attendance.findUnique({
        where: { userId_date: { userId, date: targetDate } }
      });
      if (conflict && (conflict.permission === 'PENDING' || conflict.permission === 'APPROVED')) {
        throw new AppError('Another attendance/permission record already exists on that date.', 400);
      }
      updateData.date = targetDate;
    }
  }

  const updated = await prisma.attendance.update({
    where: { id },
    data: updateData
  });
  
  emitGlobal('attendance:updated', updated);
  return updated;
}

export async function deleteMyPermission(id: string, userId: string) {
  const existing = await prisma.attendance.findUnique({ where: { id } });
  if (!existing) throw new AppError('Record not found', 404);
  if (existing.userId !== userId) throw new AppError('Forbidden', 403);
  if (existing.permission !== 'PENDING') throw new AppError('Only pending permissions can be deleted', 400);

  const updated = await prisma.attendance.update({
    where: { id },
    data: {
      permission: 'NONE',
      permissionType: null,
      permissionReason: null,
    }
  });

  emitGlobal('attendance:updated', updated);
  return updated;
}

export async function getPendingPermissions(requesterId: string, requesterRole: string) {
  const baseWhere = {
    permission: { not: 'NONE' as PermissionStatus }
  };

  if (requesterRole === 'MANAGER') {
    const team = await prisma.user.findMany({ where: { managerId: requesterId, status: 'ACTIVE' } });
    const ids = team.map((m) => m.id);
    return prisma.attendance.findMany({
      where: { ...baseWhere, userId: { in: ids } },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { date: 'desc' },
    });
  }

  if (requesterRole === 'ADMIN') {
    return prisma.attendance.findMany({
      where: { ...baseWhere, user: { role: { in: ['MANAGER', 'EMPLOYEE'] } } },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { date: 'desc' },
    });
  }

  return prisma.attendance.findMany({
    where: baseWhere,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { date: 'desc' },
  });
}

export async function approvePermission(id: string, approverId: string) {
  const record = await prisma.attendance.findUnique({
    where: { id },
    include: { user: { select: { role: true } } },
  });
  if (!record) throw new AppError('Record not found', 404);
  if (record.permission !== 'PENDING') throw new AppError('Permission is not pending', 400);

  const approver = await prisma.user.findUnique({ where: { id: approverId } });
  if (!approver) throw new AppError('Approver not found', 404);

  if (record.user.role === 'ADMIN' && approver.role !== 'SUPER_ADMIN') {
    throw new AppError('Only Super Admins can approve Admin leave requests', 403);
  }

  const [permissionAffects, notifyPermApproved] = await Promise.all([
    getConfig('permissionAffects', 'true').then(v => v === 'true'),
    getConfig('notifyPermApproved', 'true').then(v => v === 'true'),
  ]);

  let status: AttendanceStatus = record.status;
  let checkInStatus = record.checkInStatus;
  if (permissionAffects) {
    if (record.permissionType === 'HALF_DAY') status = 'HALF_DAY';
    else if (record.permissionType === 'LEAVE') status = 'LEAVE';
    else if (record.permissionType === 'LATE_PERMISSION') checkInStatus = 'ON_TIME';
  }

  const updated = await prisma.attendance.update({
    where: { id },
    data: { permission: 'APPROVED', permissionApprovedById: approverId, status, checkInStatus },
  });

  const typeStr = (record.permissionType || 'permission').replace('_', ' ').toLowerCase();
  const dateStr = record.date instanceof Date ? record.date.toDateString() : new Date(record.date).toDateString();

  if (notifyPermApproved) {
    await createNotification({
      userId: record.userId,
      title: 'Permission Approved',
      message: `Your request for ${typeStr} on ${dateStr} has been approved.`,
      type: 'PERMISSION_APPROVED',
      link: '/permissions',
    });
  }

  emitGlobal('attendance:updated', updated);
  return updated;
}

export async function rejectPermission(id: string, approverId: string) {
  const record = await prisma.attendance.findUnique({
    where: { id },
    include: { user: { select: { role: true } } },
  });
  if (!record) throw new AppError('Record not found', 404);
  if (record.permission !== 'PENDING') throw new AppError('Permission is not pending', 400);

  const approver = await prisma.user.findUnique({ where: { id: approverId } });
  if (!approver) throw new AppError('Approver not found', 404);

  if (record.user.role === 'ADMIN' && approver.role !== 'SUPER_ADMIN') {
    throw new AppError('Only Super Admins can reject Admin leave requests', 403);
  }

  const updated = await prisma.attendance.update({
    where: { id },
    data: { permission: 'REJECTED', permissionApprovedById: approverId },
  });

  const typeStr = (record.permissionType || 'permission').replace('_', ' ').toLowerCase();
  const dateStr = record.date instanceof Date ? record.date.toDateString() : new Date(record.date).toDateString();

  const notifyPermRejected = (await getConfig('notifyPermRejected', 'true')) === 'true';
  if (notifyPermRejected) {
    await createNotification({
      userId: record.userId,
      title: 'Permission Rejected',
      message: `Your request for ${typeStr} on ${dateStr} has been rejected.`,
      type: 'PERMISSION_REJECTED',
      link: '/permissions',
    });
  }

  emitGlobal('attendance:updated', updated);
  return updated;
}

// ── Admin / Manager Views ──────────────────────────────────────────────────────

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

export async function getAllAttendance(
  dateStr?: string,
  month?: number,
  year?: number,
  statusFilter?: string,
) {
  // SUPER_ADMIN is never part of attendance calculations
  const andConditions: Record<string, unknown>[] = [
    { user: { role: { not: 'SUPER_ADMIN' } } },
  ];

  if (dateStr) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    andConditions.push({ date: d });
  } else if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    andConditions.push({ date: { gte: start, lte: end } });
  } else {
    andConditions.push({ date: getTodayDate() });
  }

  if (statusFilter && statusFilter !== 'ALL') {
    if (statusFilter === 'LATE') {
      // Include both new LATE status and legacy PRESENT records with LATE checkInStatus
      andConditions.push({
        OR: [
          { status: 'LATE' },
          { status: 'PRESENT', checkInStatus: { in: ['LATE', 'VERY_LATE'] } },
        ],
      });
    } else {
      andConditions.push({ status: statusFilter as AttendanceStatus });
    }
  }

  return prisma.attendance.findMany({
    where: { AND: andConditions },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: [{ date: 'desc' }, { user: { name: 'asc' } }],
  });
}

// ── Admin Override + Auto-mark ─────────────────────────────────────────────────

export async function adminOverride(
  id: string,
  adminId: string,
  data: {
    status?: AttendanceStatus;
    checkIn?: string | null;
    checkOut?: string | null;
    permission?: PermissionStatus;
    remarks?: string;
    checkInStatus?: CheckInStatus | null;
  },
) {
  const record = await prisma.attendance.findUnique({ where: { id } });
  if (!record) throw new AppError('Record not found', 404);

  const actor = await prisma.user.findUnique({ where: { id: adminId } });
  if (!actor) throw new AppError('Actor not found', 404);

  if (actor.role === 'MANAGER') {
    const allowTLOverride = (await getConfig('allowTLOverride', 'false')) === 'true';
    if (!allowTLOverride) throw new AppError('Team Leaders are not permitted to override attendance records.', 403);
  } else if (actor.role === 'ADMIN') {
    const allowAdminOverride = (await getConfig('allowAdminOverride', 'true')) === 'true';
    if (!allowAdminOverride) throw new AppError('Admins are not permitted to override attendance records.', 403);
  }

  const update: Record<string, unknown> = {};
  if (data.status) update.status = data.status;
  if (data.permission) update.permission = data.permission;
  if (data.remarks !== undefined) update.remarks = data.remarks;

  if (data.checkIn !== undefined) {
    const newCheckIn = data.checkIn ? new Date(data.checkIn) : null;
    update.checkIn = newCheckIn;
    update.checkInStatus = newCheckIn ? await getCheckInStatus(newCheckIn) : null;
  }

  if (data.checkInStatus !== undefined) update.checkInStatus = data.checkInStatus;
  if (data.checkOut !== undefined) update.checkOut = data.checkOut ? new Date(data.checkOut) : null;

  const ci = 'checkIn' in update ? (update.checkIn as Date | null) : record.checkIn;
  const co = 'checkOut' in update ? (update.checkOut as Date | null) : record.checkOut;
  update.totalHours = ci && co ? parseFloat(((co.getTime() - ci.getTime()) / 3_600_000).toFixed(2)) : null;

  // Audit log before update
  await prisma.attendanceAuditLog.create({
    data: {
      attendanceId: id,
      changedById: adminId,
      oldStatus: record.status,
      newStatus: (data.status ?? record.status) as AttendanceStatus,
      oldCheckIn: record.checkIn,
      newCheckIn: 'checkIn' in update ? (update.checkIn as Date | null) : record.checkIn,
      oldCheckOut: record.checkOut,
      newCheckOut: 'checkOut' in update ? (update.checkOut as Date | null) : record.checkOut,
      reason: data.remarks ?? null,
    },
  });

  const updated = await prisma.attendance.update({ where: { id }, data: update });
  emitGlobal('attendance:updated', updated);
  return updated;
}

export async function autoMarkAttendance() {
  const today = getTodayDate();
  const sunday = isSunday(today);

  const [autoAbsentTimeStr, notifyMissedCheckIn] = await Promise.all([
    getConfig('autoAbsentTime', '12:00'),
    getConfig('notifyMissedCheckIn', 'true').then(v => v === 'true'),
  ]);

  const [abh, abm] = autoAbsentTimeStr.split(':').map(Number);
  const now = new Date();
  const pastAutoAbsentTime = now.getHours() > abh || (now.getHours() === abh && now.getMinutes() >= abm);

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { not: 'SUPER_ADMIN' } },
  });

  const results = await Promise.all(
    users.map(async (u) => {
      const existing = await prisma.attendance.findUnique({
        where: { userId_date: { userId: u.id, date: today } },
      });

      if (existing) {
        if (!sunday && existing.status === 'NOT_MARKED' && pastAutoAbsentTime) {
          if (notifyMissedCheckIn) {
            await createNotification({
              userId: u.id,
              title: 'Missed Check-In',
              message: `You have been marked ABSENT for today as you did not check in before ${autoAbsentTimeStr}.`,
              type: 'GENERAL',
              link: '/attendance',
            });
          }
          return prisma.attendance.update({
            where: { userId_date: { userId: u.id, date: today } },
            data: { status: 'ABSENT' },
          });
        }
        return existing;
      }

      const defaultStatus: AttendanceStatus = sunday ? 'SUNDAY' : (pastAutoAbsentTime ? 'ABSENT' : 'NOT_MARKED');
      const newRecord = await prisma.attendance.create({
        data: { userId: u.id, date: today, status: defaultStatus },
      });

      if (!sunday && defaultStatus === 'ABSENT' && notifyMissedCheckIn) {
        await createNotification({
          userId: u.id,
          title: 'Missed Check-In',
          message: `You have been marked ABSENT for today as you did not check in before ${autoAbsentTimeStr}.`,
          type: 'GENERAL',
          link: '/attendance',
        });
      }

      return newRecord;
    }),
  );
  emitGlobal('attendance:updated', { date: today, action: 'autoMarkAttendance' });
  return results;
}

// ── Dashboard Stats ────────────────────────────────────────────────────────────

export async function getDashboardStats(role: string, userId: string) {
  const today = getTodayDate();

  // SUPER_ADMIN records never count in attendance stats
  const superAdminExclusion = { user: { role: { not: 'SUPER_ADMIN' as const } } };
  let base: Record<string, unknown> = { date: today, ...superAdminExclusion };

  if (role === 'MANAGER') {
    const team = await prisma.user.findMany({ where: { managerId: userId, status: 'ACTIVE' } });
    base = { date: today, userId: { in: team.map((t) => t.id) } };
  }

  const [present, absent, late, halfDay, pendingPermissions, approvedPermissions, activeNow] =
    await Promise.all([
      // Present = on-time full day attendees
      prisma.attendance.count({ where: { ...base, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { ...base, status: 'ABSENT' } }),
      // Late = status LATE (set on check-in) OR legacy: PRESENT + checkInStatus LATE
      prisma.attendance.count({
        where: {
          ...base,
          OR: [
            { status: 'LATE' },
            { status: 'PRESENT', checkInStatus: { in: ['LATE', 'VERY_LATE'] } },
          ],
        },
      }),
      prisma.attendance.count({ where: { ...base, status: 'HALF_DAY' } }),
      prisma.attendance.count({ where: { permission: 'PENDING', ...superAdminExclusion } }),
      prisma.attendance.count({ where: { ...base, permission: 'APPROVED' } }),
      // Active Now = checked in but not checked out
      prisma.attendance.count({ where: { ...base, checkIn: { not: null }, checkOut: null } }),
    ]);

  const countLateAsPresent = (await getConfig('countLateAsPresent', 'true')) === 'true';

  return {
    present: countLateAsPresent ? present + late : present,
    absent,
    late: countLateAsPresent ? 0 : late,
    halfDay,
    pendingPermissions,
    approvedPermissions,
    activeNow,
  };
}

// ── Team Hierarchy ─────────────────────────────────────────────────────────────

export async function getTeamHierarchy(dateStr?: string) {
  const target = dateStr ? new Date(dateStr) : getTodayDate();

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { not: 'SUPER_ADMIN' } },
    include: {
      attendance: { where: { date: target }, take: 1 },
    },
  });

  const admins = users.filter(u => u.role === 'ADMIN');
  const managers = users.filter(u => u.role === 'MANAGER');
  const employees = users.filter(u => u.role === 'EMPLOYEE');

  return admins.map(admin => ({
    admin: {
      id: admin.id,
      name: admin.name,
      role: admin.role,
      attendance: admin.attendance[0] ?? null,
    },
    teams: managers
      .filter(m => m.managerId === admin.id)
      .map(tl => ({
        teamLeader: {
          id: tl.id,
          name: tl.name,
          role: tl.role,
          attendance: tl.attendance[0] ?? null,
        },
        employees: employees
          .filter(e => e.managerId === tl.id)
          .map(emp => ({
            id: emp.id,
            name: emp.name,
            role: emp.role,
            attendance: emp.attendance[0] ?? null,
          })),
      })),
    // Employees directly under admin (no TL)
    directEmployees: employees
      .filter(e => e.managerId === admin.id)
      .map(emp => ({
        id: emp.id,
        name: emp.name,
        role: emp.role,
        attendance: emp.attendance[0] ?? null,
      })),
  }));
}

// ── Performance Stats (Monthly Weighted Score) ─────────────────────────────────

export async function getPerformanceStats(month: number, year: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const records = await prisma.attendance.findMany({
    where: {
      date: { gte: start, lte: end },
      user: { role: { not: 'SUPER_ADMIN' }, status: 'ACTIVE' },
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  const byUser: Record<string, {
    user: { id: string; name: string; role: string };
    present: number; late: number; halfDay: number; absent: number; working: number;
  }> = {};

  records.forEach(r => {
    if (!r.user || r.status === 'SUNDAY') return;
    if (!byUser[r.userId]) {
      byUser[r.userId] = { user: r.user, present: 0, late: 0, halfDay: 0, absent: 0, working: 0 };
    }
    const s = byUser[r.userId];
    s.working++;
    // LATE status (new) OR legacy: PRESENT with late checkInStatus
    const isLate = r.status === 'LATE' || (r.checkInStatus === 'LATE' || r.checkInStatus === 'VERY_LATE');
    if (isLate) s.late++;
    else if (r.status === 'PRESENT') s.present++;
    else if (r.status === 'HALF_DAY') s.halfDay++;
    else if (r.status === 'ABSENT') s.absent++;
  });

  return Object.values(byUser).map(stat => {
    // Weighted: Present=1, Late=0.75, HalfDay=0.5, Absent=0
    const weighted = stat.present * 1 + stat.late * 0.75 + stat.halfDay * 0.5;
    const score = stat.working > 0 ? Math.round((weighted / stat.working) * 100) : 0;
    return { ...stat, score };
  }).sort((a, b) => b.score - a.score);
}

// ── Audit Logs ─────────────────────────────────────────────────────────────────

export async function getAuditLogs(attendanceId?: string) {
  return prisma.attendanceAuditLog.findMany({
    where: attendanceId ? { attendanceId } : {},
    include: {
      changedBy: { select: { id: true, name: true, role: true } },
      attendance: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

// ── Attendance Correction Requests ─────────────────────────────────────────────

export async function createCorrectionRequest(
  userId: string,
  data: {
    date: string;
    requestedStatus: AttendanceStatus;
    requestedCheckIn?: string | null;
    requestedCheckOut?: string | null;
    reason: string;
  },
) {
  if (!data.reason?.trim()) throw new AppError('Reason is required', 400);

  const target = new Date(data.date);
  target.setUTCHours(0, 0, 0, 0);

  const attendance = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: target } },
  });

  const request = await prisma.attendanceCorrectionRequest.create({
    data: {
      userId,
      attendanceId: attendance?.id ?? null,
      date: target,
      requestedStatus: data.requestedStatus,
      requestedCheckIn: data.requestedCheckIn ? new Date(data.requestedCheckIn) : null,
      requestedCheckOut: data.requestedCheckOut ? new Date(data.requestedCheckOut) : null,
      reason: data.reason,
    },
  });

  // Notify manager and admins
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    const recipients = new Set<string>();
    if (user.managerId) recipients.add(user.managerId);
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN'] }, status: 'ACTIVE' },
      select: { id: true },
    });
    admins.forEach(a => recipients.add(a.id));

    for (const recipientId of recipients) {
      await createNotification({
        userId: recipientId,
        title: 'Attendance Correction Request',
        message: `${user.name} has submitted an attendance correction request for ${target.toDateString()}.`,
        type: 'PERMISSION_REQUEST',
        link: '/attendance?tab=corrections',
      });
    }
  }

  return request;
}

export async function getCorrectionRequests(requesterId: string, requesterRole: string) {
  if (requesterRole === 'EMPLOYEE') {
    return prisma.attendanceCorrectionRequest.findMany({
      where: { userId: requesterId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (requesterRole === 'MANAGER') {
    const team = await prisma.user.findMany({ where: { managerId: requesterId, status: 'ACTIVE' } });
    const ids = [...team.map(t => t.id), requesterId];
    return prisma.attendanceCorrectionRequest.findMany({
      where: { userId: { in: ids } },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Admin / Super Admin — see all
  return prisma.attendanceCorrectionRequest.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function reviewCorrectionRequest(
  id: string,
  reviewerId: string,
  approved: boolean,
  note?: string,
) {
  const req = await prisma.attendanceCorrectionRequest.findUnique({ where: { id } });
  if (!req) throw new AppError('Request not found', 404);
  if (req.status !== 'PENDING') throw new AppError('Request already reviewed', 400);

  const updated = await prisma.attendanceCorrectionRequest.update({
    where: { id },
    data: {
      status: approved ? 'APPROVED' : 'REJECTED',
      reviewedById: reviewerId,
      reviewNote: note ?? null,
    },
  });

  if (approved) {
    const attendance = await prisma.attendance.upsert({
      where: { userId_date: { userId: req.userId, date: req.date } },
      create: {
        userId: req.userId,
        date: req.date,
        status: req.requestedStatus,
        checkIn: req.requestedCheckIn,
        checkOut: req.requestedCheckOut,
      },
      update: {
        status: req.requestedStatus,
        checkIn: req.requestedCheckIn,
        checkOut: req.requestedCheckOut,
      },
    });

    await prisma.attendanceAuditLog.create({
      data: {
        attendanceId: attendance.id,
        changedById: reviewerId,
        newStatus: req.requestedStatus,
        newCheckIn: req.requestedCheckIn,
        newCheckOut: req.requestedCheckOut,
        reason: `Correction request approved: ${req.reason}`,
      },
    });

    await createNotification({
      userId: req.userId,
      title: 'Correction Approved',
      message: `Your attendance correction for ${req.date.toDateString()} has been approved.`,
      type: 'PERMISSION_APPROVED',
      link: '/attendance',
    });
  } else {
    await createNotification({
      userId: req.userId,
      title: 'Correction Rejected',
      message: `Your attendance correction for ${req.date.toDateString()} has been rejected.${note ? ` Note: ${note}` : ''}`,
      type: 'PERMISSION_REJECTED',
      link: '/attendance',
    });
  }

  return updated;
}
