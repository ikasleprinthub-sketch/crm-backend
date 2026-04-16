import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

  return prisma.user.update({
    where: { id },
    data: { 
      status: 'ACTIVE' as any,
      approvedById: actor.id
    },
    select: safeSelect
  });
}

export async function rejectUser(id: string, actor: { id: string; role: string }) {
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
    throw new AppError('Only administrators can reject users', 403);
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new AppError('User not found', 404);
  if (target.status !== 'PENDING') throw new AppError('User is not pending approval', 400);

  return prisma.user.update({
    where: { id },
    data: { status: 'REJECTED' as any },
    select: safeSelect
  });
}

// ─── UPDATE user ──────────────────────────────────────────────────────────────
export async function updateUser(
  id: string,
  data: Partial<{ name: string; email: string; password: string; role: Role; managerId: string | null }>,
  actor: { id: string; role: string }
) {
  // Permission check for UPDATE
  if (actor.role === 'SUPER_ADMIN') {
    // Super admin can update anyone
  } else if (actor.role === 'ADMIN') {
    // Admin can update themselves, Managers, or Employees
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new AppError('User not found', 404);
    if (target.role === 'SUPER_ADMIN' && actor.id !== id) {
       throw new AppError('Admins cannot update Super Admin accounts', 403);
    }
  } else if (actor.id !== id) {
    throw new AppError('Access denied: You can only update your own account', 403);
  }

  // Role change restrictions
  if (data.role && actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
    throw new AppError('Only administrators can change account roles', 403);
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError('User not found', 404);

  const updateData: Record<string, unknown> = {};
  if (data.name)      updateData.name      = data.name;
  if (data.email)     updateData.email     = data.email;
  if (data.role)      updateData.role      = data.role;
  if (data.managerId !== undefined) updateData.managerId = data.managerId;
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 12);
  }

  return prisma.user.update({ where: { id }, data: updateData, select: safeSelect });
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
  
  if (actor.role === 'SUPER_ADMIN') {
    // Super admin can delete anyone
  } else if (actor.role === 'ADMIN') {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new AppError('User not found', 404);
    if (target.role === 'SUPER_ADMIN' || target.role === 'ADMIN') {
      throw new AppError('Admins cannot delete other administrators', 403);
    }
  } else {
    throw new AppError('Only administrators can delete user accounts', 403);
  }

  return prisma.user.delete({ where: { id } });
}

// ─── GET team for a manager ───────────────────────────────────────────────────
export async function getMyTeam(managerId: string) {
  return prisma.user.findMany({
    where: { managerId },
    select: safeSelect,
    orderBy: { name: 'asc' },
  });
}
