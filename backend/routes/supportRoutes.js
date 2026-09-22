import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createSupportRequest,
  getMySupportRequests,
  getDepartmentSupportRequests,
  updateSupportRequest,
} from "../controllers/supportController.js";

const router = express.Router();

router.post("/requests", protect, createSupportRequest);
router.get("/requests/mine", protect, getMySupportRequests);
router.get("/requests/department", protect, getDepartmentSupportRequests);
router.put("/requests/:id", protect, updateSupportRequest);

export default router;
