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
  managerId: true,
  manager:   { select: { id: true, name: true, email: true } },
  employees: { select: { id: true, name: true, email: true, role: true } },
  createdAt: true,
  updatedAt: true,
} as const;

// ─── GET all users ────────────────────────────────────────────────────────────
export async function getAllUsers(actor: { id: string; role: string }) {
  if (actor.role === Role.ADMIN) {
    return prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: safeSelect,
    });
  }

  if (actor.role === Role.MANAGER) {
    // Manager sees themselves + their team
    return prisma.user.findMany({
      where: {
        OR: [{ id: actor.id }, { managerId: actor.id }],
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

// ─── CREATE user (Admin only) ─────────────────────────────────────────────────
export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: Role;
  managerId?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError('Email already registered', 409);

  // Validate managerId if provided
  if (data.managerId) {
    const mgr = await prisma.user.findUnique({ where: { id: data.managerId } });
    if (!mgr) throw new AppError('Manager not found', 404);
    if (mgr.role !== Role.MANAGER && mgr.role !== Role.ADMIN) {
      throw new AppError('Assigned manager must have MANAGER or ADMIN role', 400);
    }
  }

  const hashed = await bcrypt.hash(data.password, 12);

  return prisma.user.create({
    data: {
      name:      data.name,
      email:     data.email,
      password:  hashed,
      role:      data.role,
      managerId: data.managerId,
    },
    select: safeSelect,
  });
}

// ─── UPDATE user ──────────────────────────────────────────────────────────────
export async function updateUser(
  id: string,
  data: Partial<{ name: string; email: string; password: string; role: Role; managerId: string | null }>,
  actor: { id: string; role: string }
) {
  // Users can only update themselves; Admin can update anyone
  if (actor.role !== Role.ADMIN && actor.id !== id) {
    throw new AppError('Access denied', 403);
  }

  // Non-admins cannot change role
  if (data.role && actor.role !== Role.ADMIN) {
    throw new AppError('Only admins can change roles', 403);
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError('User not found', 404);

  const updateData: Record<string, unknown> = {};
  if (data.name)      updateData.name      = data.name;
  if (data.email)     updateData.email     = data.email;
  if (data.role)      updateData.role      = data.role;
  if (data.managerId !== undefined) updateData.managerId = data.managerId; // allow null to unassign
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
    if (mgr.role !== Role.MANAGER && mgr.role !== Role.ADMIN) {
      throw new AppError('Assigned manager must have MANAGER or ADMIN role', 400);
    }
  }

  return prisma.user.update({
    where: { id: employeeId },
    data:  { managerId },
    select: safeSelect,
  });
}

// ─── DELETE user (Admin only) ─────────────────────────────────────────────────
export async function deleteUser(id: string, actorId: string) {
  if (id === actorId) throw new AppError('Cannot delete yourself', 400);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError('User not found', 404);
  await prisma.user.delete({ where: { id } });
}

// ─── GET team for a manager ───────────────────────────────────────────────────
export async function getMyTeam(managerId: string) {
  return prisma.user.findMany({
    where: { managerId },
    select: safeSelect,
    orderBy: { name: 'asc' },
  });
}
