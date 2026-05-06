import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createNotification } from '../notifications/notifications.service';

// ─── Shared select (never expose password) ────────────────────────────────────
const safeSelect = {
  id:        true,
  name:      true,
  email:     true,
  role:      true,
  status:    true,
  managerId: true,
  manager:   { select: { id: true, name: true, email: true } },
  employees: { select: { id: true, name: true, email: true, role: true, status: true } },
  requestedBy: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} as const;

// ─── GET all users ────────────────────────────────────────────────────────────
export async function getAllUsers(actor: { id: string; role: string }) {
  // SUPER_ADMIN sees everyone
  if (actor.role === 'SUPER_ADMIN') {
    return prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: safeSelect,
    });
  }

  // ADMIN sees everyone EXCEPT Super Admin
  if (actor.role === 'ADMIN') {
    return prisma.user.findMany({
      where: { role: { not: 'SUPER_ADMIN' } },
      orderBy: { name: 'asc' },
      select: safeSelect,
    });
  }

  if (actor.role === 'MANAGER') {
    // Manager sees themselves + their team (active + pending)
    return prisma.user.findMany({
      where: {
        OR: [
          { id: actor.id }, 
          { managerId: actor.id },
          { requestedById: actor.id }
        ],
      },
      orderBy: { name: 'asc' },
      select: safeSelect,
    });
  }

  // Employee sees only themselves
  return prisma.user.findMany({
    where: { id: actor.id },
    select: safeSelect,
  });
}

// ─── GET single user ──────────────────────────────────────────────────────────
export async function getUserById(id: string, actor: { id: string; role: string }) {
  // Employees can only see themselves
  if (actor.role === Role.EMPLOYEE && actor.id !== id) {
    throw new AppError('Access denied', 403);
  }

  const user = await prisma.user.findUnique({ where: { id }, select: safeSelect });
  if (!user) throw new AppError('User not found', 404);
  return user;
}

// ─── CREATE user (Administrative rules) ──────────────────────────────────────
export async function createUser(
  data: {
    name: string;
    email: string;
    password: string;
    role: Role;
    managerId?: string;
  },
  actor: { id: string; role: string }
) {
  // Permission Check
  if (data.role === 'SUPER_ADMIN') {
    throw new AppError('Cannot create Super Admin accounts.', 403);
  }

  if (actor.role === 'MANAGER') {
    if (data.role !== 'EMPLOYEE') {
      throw new AppError('Managers can only request Employee accounts', 403);
    }
  } else if (actor.role === 'ADMIN') {
    if (data.role === 'ADMIN') {
      throw new AppError('Admins cannot create other Admins', 403);
    }
  } else if (actor.role !== 'SUPER_ADMIN') {
    throw new AppError('Insufficient permissions', 403);
  }

  console.log(`[UsersService] Creating user with email: "${data.email}"`);
  if (data.email !== data.email.toLowerCase()) {
    console.log(`[UsersService] REJECTING: Email "${data.email}" contains capital letters.`);
    throw new AppError('Email must be in all lowercase letters (no capitals allowed)', 400);
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError('Email already registered', 409);

  // Validate managerId if provided
  if (data.managerId) {
    const mgr = await prisma.user.findUnique({ where: { id: data.managerId } });
    if (!mgr) throw new AppError('Manager not found', 404);
    if (mgr.role !== 'MANAGER' && mgr.role !== 'ADMIN' && mgr.role !== 'SUPER_ADMIN') {
      throw new AppError('Assigned manager must have an administrative role', 400);
    }
  }

  const hashed = await bcrypt.hash(data.password, 12);

  // Determine initial status: Managers' creations are PENDING
  const initialStatus = (actor.role === 'MANAGER') ? 'PENDING' : 'ACTIVE';

  return prisma.user.create({
    data: {
      name:          data.name,
      email:         data.email,
      password:      hashed,
      role:          data.role as any,
      status:        initialStatus as any,
      requestedById: actor.role === 'MANAGER' ? actor.id : null,
      managerId:     data.managerId || (actor.role === 'MANAGER' ? actor.id : undefined),
    },
    select: safeSelect,
  });
}

// ─── APPROVE/REJECT User (Admin/Super Admin only) ─────────────────────────────
export async function approveUser(id: string, actor: { id: string; role: string }) {
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
    throw new AppError('Only administrators can approve users', 403);
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new AppError('User not found', 404);
  if (target.status !== 'PENDING') throw new AppError('User is not pending approval', 400);

  const updated = await prisma.user.update({
    where: { id },
    data: { 
      status: 'ACTIVE' as any,
      approvedById: actor.id
    },
    select: safeSelect
  });

  // Notify requester
  if (target.requestedById) {
    await createNotification({
      userId:  target.requestedById,
      title:   'User Account Approved',
      message: `The account for ${target.name} has been approved.`,
      type:    'USER_APPROVED',
      link:    '/users',
    });
  }

  return updated;
}

export async function rejectUser(id: string, actor: { id: string; role: string }) {
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
    throw new AppError('Only administrators can reject users', 403);
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new AppError('User not found', 404);
  if (target.status !== 'PENDING') throw new AppError('User is not pending approval', 400);

  const updated = await prisma.user.update({
    where: { id },
    data: { status: 'REJECTED' as any },
    select: safeSelect
  });

  // Notify requester
  if (target.requestedById) {
    await createNotification({
      userId:  target.requestedById,
      title:   'User Account Rejected',
      message: `The account for ${target.name} was rejected.`,
      type:    'USER_REJECTED',
      link:    '/users',
    });
  }

  return updated;
}

// ─── UPDATE user ──────────────────────────────────────────────────────────────
export async function updateUser(
  id: string,
  data: Partial<{ name: string; email: string; password: string; role: Role; managerId: string | null; currentPassword?: string; newPassword?: string }>,
  actor: { id: string; role: string }
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError('User not found', 404);

  // Permission check for UPDATE
  if (actor.role === 'SUPER_ADMIN') {
    // Super admin can update anyone
  } else if (actor.role === 'ADMIN') {
    // Admin can update themselves, Managers, or Employees
    if (existing.role === 'SUPER_ADMIN' && actor.id !== id) {
       throw new AppError('Admins cannot update Super Admin accounts', 403);
    }
  } else if (actor.id !== id) {
    throw new AppError('Access denied: You can only update your own account', 403);
  }

  // Role change restrictions
  if (data.role && data.role !== existing.role && actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
    throw new AppError('Only administrators can change account roles', 403);
  }

  const updateData: Record<string, any> = {};
  if (data.name)      updateData.name      = data.name;
  if (data.email) {
    if (data.email !== data.email.toLowerCase()) {
      throw new AppError('Email must be in all lowercase letters (no capitals allowed)', 400);
    }
    updateData.email = data.email;
  }
  if (data.role)      updateData.role      = data.role;
  if (data.managerId !== undefined) updateData.managerId = data.managerId;
  
  // Handle Password Updates
  const newPass = data.newPassword || data.password;

  if (newPass) {
    console.log(`[UsersService] Password update requested for user ${id}`);
    if (newPass.length < 6) {
      throw new AppError('Password must be at least 6 characters.', 400);
    }

    // Security Check: If updating own password, current password is required
    if (actor.id === id) {
      if (!data.currentPassword) {
        throw new AppError('Current password is required to set a new password.', 400);
      }
      const isMatch = await bcrypt.compare(data.currentPassword, existing.password);
      if (!isMatch) {
        console.log(`[UsersService] Current password mismatch for user ${id}`);
        throw new AppError('Current password incorrect. Please verify and try again.', 400);
      }
    }
    
    // Hash and update the password
    const hashed = await bcrypt.hash(newPass, 12);
    updateData.password = hashed;
    console.log(`[UsersService] Password hashed and added to updateData for user ${id}`);
  }

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: safeSelect
  });
}

// ─── ASSIGN employee to manager (Admin only) ──────────────────────────────────
export async function assignToManager(employeeId: string, managerId: string | null) {
  const emp = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!emp) throw new AppError('Employee not found', 404);
  if (emp.role !== Role.EMPLOYEE) throw new AppError('Target user must be an EMPLOYEE', 400);

  if (managerId) {
    const mgr = await prisma.user.findUnique({ where: { id: managerId } });
    if (!mgr) throw new AppError('Manager not found', 404);
    if (mgr.role !== 'MANAGER' && mgr.role !== 'ADMIN' && mgr.role !== 'SUPER_ADMIN') {
      throw new AppError('Assigned manager must have an administrative role', 400);
    }
  }

  return prisma.user.update({
    where: { id: employeeId },
    data:  { managerId },
    select: safeSelect,
  });
}

// ─── DELETE user (Admin only) ─────────────────────────────────────────────────
export async function deleteUser(id: string, actor: { id: string; role: string }) {
  if (id === actor.id) throw new AppError('Cannot delete yourself', 400);
  
  const target = await prisma.user.findUnique({ 
    where: { id },
    include: {
      _count: {
        select: {
          assignedTasks: true,
          employees: true,
        }
      }
    }
  });

  if (!target) throw new AppError('User not found', 404);

  // Permission check
  if (actor.role === 'SUPER_ADMIN') {
    // Super admin can delete
  } else if (actor.role === 'ADMIN') {
    if (target.role === 'SUPER_ADMIN' || target.role === 'ADMIN') {
      throw new AppError('Admins cannot delete other administrators', 403);
    }
  } else {
    throw new AppError('Only administrators can delete user accounts', 403);
  }

  // Business Logic Check: Prevent deletion if user has active tasks or team members
  if (target._count.assignedTasks > 0) {
    throw new AppError(`Cannot delete user: ${target.name} has ${target._count.assignedTasks} assigned tasks. Please reassign them first.`, 400);
  }
  if (target._count.employees > 0) {
    throw new AppError(`Cannot delete user: ${target.name} is a manager for ${target._count.employees} employees. Please reassign the team first.`, 400);
  }

  // Execute deletion in a transaction to clean up non-critical relations
  return prisma.$transaction(async (tx) => {
    // 1. Delete non-critical relations
    await tx.notification.deleteMany({ where: { userId: id } });
    await tx.activityLog.deleteMany({ where: { userId: id } });
    await tx.note.deleteMany({ where: { userId: id } });
    await tx.comment.deleteMany({ where: { userId: id } });
    await tx.attendance.deleteMany({ where: { userId: id } });

    // 2. Clear references in other records (nullify where possible)
    await tx.user.updateMany({ where: { requestedById: id }, data: { requestedById: null } });
    await tx.user.updateMany({ where: { approvedById: id }, data: { approvedById: null } });
    await tx.attendance.updateMany({ where: { permissionApprovedById: id }, data: { permissionApprovedById: null } });

    // 3. Finally delete the user
    return tx.user.delete({ where: { id } });
  });
}

// ─── GET team for a manager ───────────────────────────────────────────────────
export async function getMyTeam(managerId: string) {
  return prisma.user.findMany({
    where: { managerId },
    select: safeSelect,
    orderBy: { name: 'asc' },
  });
}
