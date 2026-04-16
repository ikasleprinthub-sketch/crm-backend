export const allowRoles = (...roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden: Insufficient permissions" });
    }
    next();
  };
};

export const requireAdmin = allowRoles('ADMIN');
export const requireManager = allowRoles('ADMIN', 'MANAGER');
