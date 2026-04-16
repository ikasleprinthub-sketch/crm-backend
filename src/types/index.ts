import { Request } from 'express';
import { Role } from '@prisma/client';

// ─── Augment Express Request ──────────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

// ─── Re-export Prisma enums for convenience ───────────────────────────────────
export { Role, LeadStatus, TaskStatus, Priority } from '@prisma/client';
