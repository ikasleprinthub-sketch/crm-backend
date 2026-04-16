import { Router } from "express";
import * as controller from "./lead.controller";
import { protect } from "../../middleware/auth.middleware";

const router: any = Router();

router.use(protect);

router.post("/", controller.createLead);
router.get("/", controller.getLeads);

router.get("/:id", controller.getLead);
router.put("/:id", controller.updateLead);
router.delete("/:id", controller.deleteLead);

router.post("/:id/convert", controller.convertLead);

export default router;
