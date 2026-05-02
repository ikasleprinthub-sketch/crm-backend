import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE']),
  managerId: z.string().uuid().optional().nullable(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE']).optional(),
  managerId: z.string().uuid().optional().nullable(),
});
