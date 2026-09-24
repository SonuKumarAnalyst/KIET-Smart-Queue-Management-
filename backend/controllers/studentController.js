import Queue from "../models/Queue.js";
import Ticket from "../models/Ticket.js";
import Department from "../models/Department.js";
import { io } from "../server.js";
import Feedback from "../models/Feedback.js";
import { sendTicketEmail } from "../services/email.service.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { calculatePosition } from "../utils/queueUtils.js";

// ==============================
// STUDENT JOIN QUEUE
// ==============================
export const joinQueue = async (req, res) => {
  try {
    // 1️⃣ Only students
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Students only" });
    }

    const { departmentId, serviceName } = req.body;
    console.log(`📝 Join request for dept: ${departmentId}, service: ${serviceName} from user: ${req.user.id}`);

    if (!departmentId) {
      return res.status(400).json({ message: "Department ID is required" });
    }

    // 2️⃣ Validate department
    const department = await Department.findById(departmentId);
    if (!department || !department.isActive) {
      return res.status(404).json({ message: "Department not available" });
    }

    // 🔍 Find selected service duration
    const selectedService = department.services.find(s => s.name === serviceName) || { name: "General", estimatedDuration: 5 };
    console.log(`🔍 Selected service: ${selectedService.name} (${selectedService.estimatedDuration}m)`);
    const serviceDuration = selectedService.estimatedDuration;

    // 3️⃣ Find queue
    let queue = await Queue.findOne({ department: departmentId });
    if (!queue) {
      console.warn(`⚠️ Queue missing for dept ${departmentId}. Auto-recovering...`);
      // 🆕 AUTO-RECOVERY: If queue is missing, create it now!
      queue = await Queue.create({ department: departmentId });
      console.log(`✅ Auto-created missing queue for department: ${departmentId}`);
    }

    // 🚫 Queue closed
    if (!queue.isOpen) {
      console.warn(`🚫 Queue ${queue._id} is closed`);
      return res.status(400).json({ message: "Queue is currently closed" });
    }

    // 🚫 Same department duplicate check
    const existingTicket = await Ticket.findOne({
      user: req.user.id,
      queue: queue._id,
      status: { $in: ["waiting", "serving", "hold"] },
    });

    if (existingTicket) {
      console.warn(`🚫 User ${req.user.id} already in queue ${queue._id}`);
      return res.status(400).json({
        message: "You are already in this department queue",
      });
    }

    // 🚫 Queue limit check (SAFE)
    if (queue.maxTickets != null) {
      const activeCount = await Ticket.countDocuments({
        queue: queue._id,
        status: { $in: ["waiting", "serving", "hold"] },
      });

      if (activeCount >= queue.maxTickets) {
        console.warn(`🚫 Queue ${queue._id} is full (${activeCount}/${queue.maxTickets})`);
        return res.status(400).json({
          message: "Queue is full. Please try later.",
        });
      }
    }

    // 4️⃣ Count waiting tickets
    const waitingCount = await Ticket.countDocuments({
      queue: queue._id,
      status: "waiting",
    });

    // 5️⃣ Generate ticket number
    const ticketNumber = `A${String(waitingCount + 1).padStart(3, "0")}`;

    // 6️⃣ Create ticket
    const ticket = await Ticket.create({
      ticketNumber,
      queue: queue._id,
      user: req.user.id,
      serviceName: selectedService.name,
      serviceDuration: selectedService.estimatedDuration,
      source: "app",
      status: "waiting",
      isGuest: false,
    });

    // 🔔 Notify students in this department
    const position = await calculatePosition(ticket._id);
    io.to(`department_${departmentId}`).emit("ticket_joined", {
      ticketNumber,
      position,
    });

    // 🛡️ Notify Admins (Analytics Refresh)
    io.to("admin_room").emit("update_analytics");

    // 7️⃣ Calculate ETA
    const eta = (position - 1) * queue.averageServiceTime;

    // 📧 SEND EMAIL NOTIFICATION
    const user = await User.findById(req.user.id);
    if (user && user.email) {
      await sendTicketEmail(user.email, {
        ticketNumber,
        departmentName: department.name,
        status: "waiting",
      });
    }

    // ✅ SEND RESPONSE LAST
    res.status(201).json({
      message: "Joined queue successfully",
      ticketNumber,
      position,
      estimatedWaitTime: `${eta} minutes`,
      ticketId: ticket._id,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==============================
// GET ACTIVE DEPARTMENTS (STUDENT)
// ==============================
export const getActiveDepartments = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Students only" });
    }

    const departments = await Department.find({ isActive: true })
      .select("_id name description services");

    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==============================
// GET ACTIVE TICKET (STUDENT)
// ==============================
export const getMyActiveTicket = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Students only" });
    }

    const ticket = await Ticket.findOne({
      user: req.user.id,
      status: { $in: ["waiting", "serving", "hold"] },
    }).populate({
      path: "queue",
      populate: { path: "department", select: "name" },
    });

    if (!ticket) {
      return res.json(null);
    }

    const position = await calculatePosition(ticket._id);
    
    // 🔍 Also calculate waiting-list-only position
    const waitingAhead = await Ticket.countDocuments({
      queue: ticket.queue._id,
      status: "waiting",
      _id: { $ne: ticket._id },
      $or: [
        { priority: { $gt: ticket.priority } },
        { priority: ticket.priority, createdAt: { $lt: ticket.createdAt } }
      ]
    });

    const queue = await Queue.findById(ticket.queue._id);
    const eta = waitingAhead * (queue?.averageServiceTime || 5);

    res.json({
      _id: ticket._id,
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      departmentId: ticket.queue.department._id,
      departmentName: ticket.queue.department.name,
      position: position,
      waitingPosition: waitingAhead + 1,
      estimatedWaitTime: eta,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==============================
// STUDENT CANCEL QUEUE
// ==============================
export const cancelQueue = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Students only" });
    }

    const { departmentId } = req.body;

    if (!departmentId) {
      return res.status(400).json({ message: "Department ID is required" });
    }

    let queue = await Queue.findOne({ department: departmentId });
    if (!queue) {
      // Auto-create queue even on cancel (safety measure)
      queue = await Queue.create({ department: departmentId });
    }

    const ticket = await Ticket.findOne({
      user: req.user.id,
      queue: queue._id,
      status: { $in: ["waiting", "serving", "hold"] },
    });

    if (!ticket) {
      return res.status(400).json({
        message: "You are not in this queue",
      });
    }

    ticket.status = "no-show";
    ticket.noShowAt = new Date();
    ticket.servedAt = new Date();
    await ticket.save();

    if (
      queue.currentTicket &&
      queue.currentTicket.toString() === ticket._id.toString()
    ) {
      queue.currentTicket = null;
      await queue.save();
    }

    // 🔔 Notify department
    io.to(`department_${departmentId}`).emit("ticket_cancelled", {
      ticketNumber: ticket.ticketNumber,
    });

    // 🛡️ ANALYTICS
    io.to("admin_room").emit("update_analytics");

    // 📧 EMAIL NOTIFICATION ON CANCELLATION
    const user = await User.findById(req.user.id);
    const department = await Department.findById(departmentId);
    if (user && user.email) {
      await sendTicketEmail(user.email, {
        ticketNumber: ticket.ticketNumber,
        departmentName: department ? department.name : "Department",
        status: "cancelled",
      });
    }

    res.json({
      message: "You have left the queue successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==============================
// STUDENT: TICKET HISTORY
// ==============================
export const getMyTicketHistory = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Students only" });
    }

    const tickets = await Ticket.find({
      user: req.user.id,
      status: { $in: ["completed", "no-show"] },
    })
      .populate({
        path: "queue",
        populate: {
          path: "department",
          select: "name",
        },
      })
      .sort({ createdAt: -1 });

    // 🔍 Get all feedback for these tickets
    const feedbacks = await Feedback.find({
      student: req.user.id,
      ticket: { $in: tickets.map((t) => t._id) },
    }).select("ticket");

    const feedbackTicketIds = new Set(
      feedbacks.map((f) => f.ticket.toString())
    );

    const history = tickets.map((t) => ({
      _id: t._id,
      ticketNumber: t.ticketNumber,
      department: t.queue?.department?.name || "N/A",
      status: t.status,
      joinedAt: t.createdAt,
      servedAt: t.servedAt || null,

      // ✅ THIS IS THE KEY FIX
      feedbackSubmitted: feedbackTicketIds.has(t._id.toString()),
    }));

    res.json(history);
  } catch (error) {
    console.error("Ticket history error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ==============================
// STUDENT: SUBMIT FEEDBACK
// ==============================
export const submitFeedback = async (req, res) => {
  try {
    // 🔒 Role check
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Students only" });
    }

    const { ticketId, options, comment } = req.body;

    // ✅ Basic validation
    if (!ticketId || !options || options.length === 0) {
      return res.status(400).json({
        message: "At least one feedback option is required",
      });
    }

    // 🔍 Find completed ticket of this student
    const ticket = await Ticket.findOne({
      _id: ticketId,
      user: req.user.id,
      status: "completed",
    }).populate({
      path: "queue",
      populate: {
        path: "department",
      },
    });

    if (!ticket) {
      return res.status(404).json({
        message: "Feedback allowed only for completed tickets",
      });
    }

    // 🚫 Prevent duplicate feedback
    const existingFeedback = await Feedback.findOne({
      ticket: ticketId,
    });

    if (existingFeedback) {
      return res.status(409).json({
        message: "Feedback already submitted for this ticket",
      });
    }

    // 🤖 AI SENTIMENT ANALYSIS
    let sentiment = "neutral";
    if (comment && comment.trim().length > 5) {
      try {
        const chatbotBaseUrl = process.env.CHATBOT_URL || "http://localhost:8005";
        const response = await fetch(`${chatbotBaseUrl}/analyze-sentiment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        });
        const data = await response.json();
        sentiment = data.sentiment || "neutral";
      } catch (err) {
        console.error("AI Sentiment analysis failed:", err.message);
      }
    }

    // 💾 Create feedback (MATCHES YOUR MODEL)
    const feedback = await Feedback.create({
      ticket: ticket._id,
      student: req.user.id,
      department: ticket.queue.department._id,
      options,
      comment: comment || "",
      sentiment,
    });

    // ✅ IMPORTANT: SEND JSON RESPONSE
    return res.status(201).json({
      message: "Feedback submitted successfully",
      feedbackId: feedback._id,
    });
  } catch (error) {
    console.error("❌ Feedback submit error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
// ==============================
// STUDENT: TOGGLE HOLD STATUS (STEP AWAY)
// ==============================
export const toggleHoldStatus = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Students only" });
    }

    const ticket = await Ticket.findOne({
      user: req.user.id,
      status: { $in: ["waiting", "hold"] },
    }).populate({
      path: "queue",
      select: "department",
    });

    if (!ticket) {
      return res.status(404).json({ message: "No active waiting ticket found" });
    }

    const isHolding = ticket.status === "hold";
    ticket.status = isHolding ? "waiting" : "hold";
    ticket.holdAt = isHolding ? null : new Date();
    await ticket.save();

    const departmentId = ticket.queue.department.toString();

    // 🔔 Notify department (staff)
    io.to(`department_${departmentId}`).emit("ticket_hold_toggled", {
      ticketId: ticket._id,
      status: ticket.status,
      ticketNumber: ticket.ticketNumber,
    });

    // 👤 Also notify the specific user room
    io.to(`user_${req.user.id}`).emit("ticket_hold_toggled", {
      ticketId: ticket._id,
      status: ticket.status,
      ticketNumber: ticket.ticketNumber,
    });

    // 🎟️ Also notify the ticket specific room
    io.to(`ticket_${ticket._id}`).emit("ticket_hold_toggled", {
      ticketId: ticket._id,
      status: ticket.status,
      ticketNumber: ticket.ticketNumber,
    });

    res.json({
      message: ticket.status === "hold" ? "You have stepped away. Staff notified." : "Welcome back! You're back in line.",
      status: ticket.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==============================
// STUDENT: GET DEPARTMENT TRAFFIC (FORECASTING)
// ==============================
export const getDepartmentTraffic = async (req, res) => {
  try {
    const { departmentId } = req.params;

    const traffic = await Ticket.aggregate([
      {
        $lookup: {
          from: "queues",
          localField: "queue",
          foreignField: "_id",
          as: "queueInfo"
        }
      },
      { $unwind: "$queueInfo" },
      { $match: { "queueInfo.department": new mongoose.Types.ObjectId(departmentId) } },
      {
        $project: {
          hour: { $hour: "$createdAt" }
        }
      },
      {
        $group: {
          _id: "$hour",
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(traffic);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==============================
// STUDENT: RESTORE NO-SHOW TICKET (GRACE PERIOD)
// ==============================
export const restoreNoShowTicket = async (req, res) => {
  try {
    const { ticketId } = req.body;
    console.log(`🔄 Attempting to restore ticket: ${ticketId} for user: ${req.user.id}`);
    
    const ticket = await Ticket.findOne({
      _id: ticketId,
      user: req.user.id,
      status: "no-show"
    });

    if (!ticket) {
      console.warn(`🚫 Ticket ${ticketId} not found or not 'no-show' for user ${req.user.id}`);
      return res.status(404).json({ message: "Ticket not found or not eligible" });
    }

    // Check 5 min grace period
    const diff = (new Date() - new Date(ticket.noShowAt)) / 60000;
    console.log(`🕒 Grace period check: ${diff.toFixed(2)} mins since no-show`);
    if (diff > 5) {
      return res.status(400).json({ message: "Grace period expired" });
    }

    ticket.status = "waiting";
    ticket.noShowAt = null;
    ticket.servedAt = null;
    await ticket.save();

    console.log(`✅ Ticket ${ticket.ticketNumber} restored successfully`);
    res.json({ message: "Ticket restored! Please be ready.", status: "waiting" });
  } catch (error) {
    console.error("❌ Restore ticket error:", error);
    res.status(500).json({ message: error.message });
  }
};

