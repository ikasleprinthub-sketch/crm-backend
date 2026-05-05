import { prisma } from "../../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// LOGIN USER
export const loginUser = async (data: any) => {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) throw new Error("Invalid credentials");

  const isMatch = await bcrypt.compare(data.password, user.password);

  if (!isMatch) throw new Error("Invalid credentials");

  // 🔥 GENERATE JWT
  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN as any }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      managerId: user.managerId,
      manager: user.managerId ? await prisma.user.findUnique({
        where: { id: user.managerId },
        select: { id: true, name: true, email: true, role: true }
      }) : null
    },
  };
};

// GET CURRENT USER
export const getCurrentUser = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      managerId: true,
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        }
      }
    },
  });
};
