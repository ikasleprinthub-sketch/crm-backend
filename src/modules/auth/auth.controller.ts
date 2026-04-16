import * as authService from "./auth.service";

export const register = async (req: any, res: any) => {
  try {
    const user = await authService.registerUser(req.body);
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const login = async (req: any, res: any) => {
  try {
    const result = await authService.loginUser(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(401).json({ success: false, message: err.message });
  }
};

export const me = async (req: any, res: any) => {
  const user = await authService.getCurrentUser(req.user.id);
  res.json({ success: true, data: user });
};
