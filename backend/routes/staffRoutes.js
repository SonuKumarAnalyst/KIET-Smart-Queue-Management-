import express from "express";
import { protect } from "../middleware/authMiddleware.js";

// ===== STAFF CONTROLLERS =====
import {
  callNextTicket,
  completeTicket,
  togglePauseQueue,
  getStaffProfile,
  setQueueLimit,
  toggleQueueStatus,
  increaseQueueLimit,
  generateDepartmentQR,
  getQueueStats,
  addTicketNote,
  transferTicket,
  getTicketDetails,
  getTransferDepartments,
  sendDepartmentBroadcast,
  markNoShow,
  getDepartmentTickets,
} from "../controllers/staffController.js";

// ===== EMERGENCY CONTROLLERS =====
import {
  startEmergency,
  endEmergency,
  getPendingEmergencyCount,
  rejectEmergency,
  approveEmergency,
  getPendingEmergencies,
  getAllEmergencies,
} from "../controllers/emergencyController.js";
import {
  getDepartmentSupportRequests,
  updateSupportRequest,
} from "../controllers/supportController.js";

const router = express.Router();

// ==============================
// STAFF PROFILE
// ==============================
router.get("/me", protect, getStaffProfile);
router.get("/department/qr", protect, generateDepartmentQR);
router.get("/queue-stats", protect, getQueueStats);

// ==============================
// 🚨 EMERGENCY ACTIONS (STAFF)
// ==============================
router.post("/emergency/start", protect, startEmergency);
router.post("/emergency/end", protect, endEmergency);
router.get(
  "/emergency/count",
  protect,      // your auth middleware
  getPendingEmergencyCount
);

router.get(
  "/emergencies",
  protect,
  getPendingEmergencies
);

router.get(
  "/emergency/history",
  protect,
  getAllEmergencies
);

router.post(
  "/emergency/approve/:emergencyId",
  protect,
  approveEmergency
);

router.post(
  "/emergency/reject/:emergencyId",
  protect,
  rejectEmergency
);


// ==============================
// STAFF QUEUE ACTIONS
// ==============================
router.post("/call-next", protect, callNextTicket);
router.post("/complete", protect, completeTicket);
router.post("/no-show", protect, markNoShow);
router.post("/toggle-queue", protect, toggleQueueStatus);
router.post("/toggle-pause", protect, togglePauseQueue);
router.post("/set-limit", protect, setQueueLimit);
router.post("/increase-limit", protect, increaseQueueLimit);

// ==============================
// 📝 NOTES & TRANSFERS
// ==============================
router.post("/add-note", protect, addTicketNote);
router.post("/transfer", protect, transferTicket);
router.post("/broadcast", protect, sendDepartmentBroadcast);
router.get("/ticket/:ticketId", protect, getTicketDetails);
router.get("/transfer-departments", protect, getTransferDepartments);
router.get("/department-tickets", protect, getDepartmentTickets);
router.get("/support-requests", protect, getDepartmentSupportRequests);
router.put("/support-requests/:id", protect, updateSupportRequest);

export default router;
