import { Router } from "express";
import * as controller from "./auth.controller";
import { protect } from "../../middleware/auth.middleware";
import { allowRoles } from "../../middleware/role.middleware";

const router: any = Router();

// Admin creates users
router.post("/register", protect, allowRoles("ADMIN"), controller.register);

// Login
router.post("/login", controller.login);

// Get logged-in user
router.get("/me", protect, controller.me);

export default router;
