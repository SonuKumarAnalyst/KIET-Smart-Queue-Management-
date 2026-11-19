import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  startVideoCall,
  acceptVideoCall,
  rejectVideoCall,
  endVideoCall,
  getActiveVideoCall,
} from "../controllers/callController.js";

const router = express.Router();

router.post("/start", protect, startVideoCall);
router.post("/:callId/accept", protect, acceptVideoCall);
router.post("/:callId/reject", protect, rejectVideoCall);
router.post("/:callId/end", protect, endVideoCall);
router.get("/active/:ticketId", protect, getActiveVideoCall);

export default router;
