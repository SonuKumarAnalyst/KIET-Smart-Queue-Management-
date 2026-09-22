import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { 
  bookAppointment, 
  getMyAppointments, 
  cancelAppointment, 
  getAvailableSlots,
  checkInAppointment,
  getDepartmentAppointments
} from "../controllers/appointmentController.js";

const router = express.Router();

router.use(protect);

router.post("/book", bookAppointment);
router.get("/my", getMyAppointments);
router.put("/cancel/:id", cancelAppointment);
router.post("/check-in/:id", checkInAppointment);
router.get("/available", getAvailableSlots);
router.get("/department", getDepartmentAppointments);

export default router;
