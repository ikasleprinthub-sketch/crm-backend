import { Router } from "express";
import * as controller from "./auth.controller";
import { protect } from "../../middleware/auth.middleware";
import { allowRoles } from "../../middleware/role.middleware";
import { authLimiter, profileLimiter } from "../../middleware/rateLimit.middleware";

const router: any = Router();

// Admin/Manager creates users
router.post("/register", authLimiter, protect, allowRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), controller.register);

// Login
router.post("/login", authLimiter, controller.login);

// Get logged-in user - Relaxed limit for profile checks
router.get("/me", profileLimiter, protect, controller.me);

export default router;
