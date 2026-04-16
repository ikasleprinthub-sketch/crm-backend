import { Router } from "express";
import * as controller from "./task.controller";
import { protect } from "../../middleware/auth.middleware";
import { requireAdmin, requireManager } from "../../middleware/role.middleware";

const router: any = Router();

router.use(protect);

router.post("/", requireManager, controller.createTask);
router.get("/", controller.getTasks);

router.patch("/:id/status", controller.updateStatus);
router.patch("/:id/assign", requireManager, controller.assignTask);

router.patch("/sop/:stepId", controller.updateSOP);

export default router;
