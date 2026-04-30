import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export const protect = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Not authorized" });
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
    
    // Verify user still exists in DB (handles stale tokens after DB reset)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, email: true }
    });

    if (!user) {
      return res.status(401).json({ message: "User no longer exists. Please log in again." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const authenticate = protect;
