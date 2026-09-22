import Queue from "../models/Queue.js";
import Ticket from "../models/Ticket.js";
import { getCrowdStatusByDepartment } from "../services/crowdStatus.service.js";


// ===============================
// GET CURRENT SERVING TICKETS
// ===============================
export const getCurrentServing = async (req, res) => {
  try {
    const { departmentId } = req.params;

    const queue = await Queue.findOne({ department: departmentId });

    if (!queue) {
      return res.status(404).json({ message: "Queue not found" });
    }

    // 🔥 REAL-TIME: Get all tickets currently in "serving" for this department
    const servingTickets = await Ticket.find({
      queue: queue._id,
      status: "serving",
    }).select("ticketNumber servedBy").populate("servedBy", "fullName");

    res.json({
      servingTickets,
      latestTicket: queue.currentTicket ? (await Ticket.findById(queue.currentTicket).select("ticketNumber"))?.ticketNumber : null
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ===============================
// GET CROWD STATUS (BEFORE JOIN)
// ===============================
export const getCrowdStatus = async (req, res) => {
  try {
    const { departmentId } = req.query;

    if (!departmentId) {
      return res.status(400).json({
        message: "departmentId is required",
      });
    }

    const crowdStatus = await getCrowdStatusByDepartment(departmentId);

    res.json({
      departmentId,
      ...crowdStatus,
    });
  } catch (error) {
    console.error("Crowd status error:", error);
    res.status(500).json({
      message: "Unable to fetch crowd status",
    });
  }
};
