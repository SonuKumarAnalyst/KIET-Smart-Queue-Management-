import Queue from "../models/Queue.js";
import Ticket from "../models/Ticket.js";
import User from "../models/User.js";
import Emergency from "../models/Emergency.js";
import { io } from "../server.js";
import QRCode from "qrcode";
import { getCrowdStatusByDepartment } from "../services/crowdStatus.service.js";
import crypto from "crypto";
import StaffQr from "../models/StaffQr.js";

/* 🔔 PUSH NOTIFICATION UTILITY */
import { sendPushToUser } from "../utils/push.js";
import { sendTicketEmail } from "../services/email.service.js";
import Department from "../models/Department.js";


// ==============================
// GET STAFF PROFILE
// ==============================
export const getStaffProfile = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const staff = await User.findById(req.user.id)
      .populate("department", "name description");

    // 🔥 REAL-TIME: Get the ticket being served by THIS staff member
    const activeTicket = await Ticket.findOne({
      servedBy: req.user.id,
      status: "serving"
    }).populate("user", "fullName email");

    let queue = await Queue.findOne({ department: staff.department });

    if (!queue && staff.department) {
      queue = await Queue.create({ department: staff.department });
      console.log(`✅ Auto-created missing queue for department (Staff Login): ${staff.department}`);
    }

    res.json({
      ...staff.toObject(),
      currentTicketDetails: activeTicket || null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/* ==============================
   STAFF TOGGLE PAUSE QUEUE
============================== */
export const togglePauseQueue = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const { pauseMessage } = req.body;
    const staff = await User.findById(req.user.id);
    const departmentId = staff.department.toString();

    const queue = await Queue.findOne({ department: departmentId });
    if (!queue) {
      return res.status(404).json({ message: "Queue not found" });
    }

    queue.isPaused = !queue.isPaused;
    if (pauseMessage) queue.pauseMessage = pauseMessage;
    
    await queue.save();

    io.to(`department_${departmentId}`).emit("queue_pause_toggled", {
      isPaused: queue.isPaused,
      pauseMessage: queue.pauseMessage,
    });

    res.json({
      message: `Queue ${queue.isPaused ? "paused" : "resumed"}`,
      isPaused: queue.isPaused,
      pauseMessage: queue.pauseMessage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==============================
// STAFF: MARK NO-SHOW
// ==============================
export const markNoShow = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const { ticketId } = req.body;
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (ticket.status !== "serving" || !ticket.calledAt) {
      return res.status(400).json({ message: "Only a called ticket can be marked as no-show" });
    }

    const arrivalWindowMs = 5 * 60 * 1000;
    if (Date.now() - ticket.calledAt.getTime() < arrivalWindowMs) {
      return res.status(400).json({ message: "Please wait until the 5-minute arrival window expires" });
    }

    ticket.status = "no-show";
    ticket.noShowAt = new Date();
    ticket.servedAt = new Date(); // Analytics convenience
    await ticket.save();

    const staff = await User.findById(req.user.id);
    const departmentId = staff.department.toString();
    const queue = await Queue.findOne({ department: departmentId });

    // 🚨 SYNC WITH EMERGENCY SYSTEM
    if (ticket.emergency) {
      await Emergency.findByIdAndUpdate(ticket.emergency, { status: "resolved" }); // Mark as resolved/done
      queue.emergencyActive = false;
      await queue.save();
      io.to(`department_${departmentId}`).emit("emergency_ended");
    }

    if (queue.currentTicket?.toString() === ticketId) {
      queue.currentTicket = null;
      await queue.save();
    }

    // Notify student and department
    const noShowData = {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      departmentId: departmentId
    };

    io.to(`department_${departmentId}`).emit("ticket_no_show", noShowData);
    
    if (ticket.user) {
      io.to(`user_${ticket.user}`).emit("you_marked_no_show", noShowData);
    }

    io.to("admin_room").emit("update_analytics");

    res.json({ message: "Ticket marked as no-show" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const callNextTicket = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const staff = await User.findById(req.user.id);
    if (!staff || !staff.department) {
      return res.status(400).json({
        message: "Staff not assigned to any department",
      });
    }

    const departmentId = staff.department.toString();

    const queue = await Queue.findOne({
      department: departmentId,
      isOpen: true,
    });

    if (!queue) {
      return res.status(400).json({ message: "Queue is closed" });
    }

    if (queue.emergencyActive) {
      return res.status(400).json({
        message: "Emergency in progress. Resolve emergency before calling next ticket.",
      });
    }

    const nextTicket = await Ticket.findOne({
      queue: queue._id,
      status: "waiting", // Skip "hold" status
    }).sort({ priority: -1, createdAt: 1 });

    if (!nextTicket) {
      return res.status(400).json({ message: "No tickets in queue" });
    }

    // 🔥 REAL-TIME: Auto-complete any previous ticket served by THIS staff member
    await Ticket.updateMany(
      { servedBy: req.user.id, status: "serving" },
      { status: "completed", servedAt: new Date() }
    );

    // 1️⃣ Update ticket
    nextTicket.status = "serving";
    nextTicket.servedBy = req.user.id;
    nextTicket.calledAt = new Date();
    await nextTicket.save();

    // 🚨 SYNC WITH EMERGENCY SYSTEM
    if (nextTicket.emergency) {
      await Emergency.findByIdAndUpdate(nextTicket.emergency, { status: "active" });
      queue.emergencyActive = true;
      queue.emergencyReason = "Emergency ticket in progress";
      
      io.to(`department_${departmentId}`).emit("emergency_started", {
        studentId: nextTicket.user?.toString(),
        note: queue.emergencyReason,
      });

      // Special notification for the student
      if (nextTicket.user) {
        io.to(`user_${nextTicket.user}`).emit("emergency_your_turn");
      }
    }

    // 2️⃣ Update queue
    queue.currentTicket = nextTicket._id;
    await queue.save();

    // 3️⃣ SOCKET EVENT (REALTIME UI)
    io.to(`department_${departmentId}`).emit("ticket_called", {
      ticketNumber: nextTicket.ticketNumber,
      ticketId: nextTicket._id,
      servedBy: req.user.id,
      priority: nextTicket.priority, // 🔥 Add priority
    });

    // 🛡️ ANALYTICS
    io.to("admin_room").emit("update_analytics");

    // 🔔 4️⃣ PUSH NOTIFICATION (BACKGROUND / MOBILE)
    if (nextTicket.user) {
      await sendPushToUser(nextTicket.user.toString(), {
        title: "🎟️ It's Your Turn!",
        body: `Ticket ${nextTicket.ticketNumber} is now being served`,
        url: `${process.env.FRONTEND_BASE_URL}/#/student`,
      });

      // 📧 5️⃣ EMAIL NOTIFICATION
      const userData = await User.findById(nextTicket.user);
      const dept = await Department.findById(departmentId);
      if (userData && userData.email) {
        await sendTicketEmail(userData.email, {
          ticketNumber: nextTicket.ticketNumber,
          departmentName: dept.name,
          status: "calling",
        });
      }
    }

    // 6️⃣ Crowd status update
    const crowdStatus = await getCrowdStatusByDepartment(departmentId);

    io.to(`department_${departmentId}`).emit("queue_crowd_updated", {
      departmentId,
      ...crowdStatus,
    });

    res.json({
      message: "Now serving",
      ticketNumber: nextTicket.ticketNumber,
      ticketId: nextTicket._id,
    });
  } catch (error) {
    console.error("Call next ticket error:", error);
    res.status(500).json({ message: error.message });
  }
};


// ==============================
// STAFF COMPLETE CURRENT TICKET
// ==============================
export const completeTicket = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const staff = await User.findById(req.user.id);
    if (!staff || !staff.department) {
      return res.status(400).json({
        message: "Staff not assigned to any department",
      });
    }

    const departmentId = staff.department.toString();
    const queue = await Queue.findOne({ department: departmentId });

    // 🔥 REAL-TIME: Complete the specific ticket served by THIS staff
    const ticket = await Ticket.findOne({
      servedBy: req.user.id,
      status: "serving",
    });

    if (!ticket) {
      return res.status(400).json({
        message: "No active ticket to complete",
      });
    }

    ticket.status = "completed";
    ticket.servedAt = new Date();
    await ticket.save();

    // 🚨 SYNC WITH EMERGENCY SYSTEM
    if (ticket.emergency) {
      await Emergency.findByIdAndUpdate(ticket.emergency, { status: "resolved" });
      queue.emergencyActive = false;
      await queue.save();
      io.to(`department_${departmentId}`).emit("emergency_ended");
      io.to(`user_${ticket.user}`).emit("emergency_served");
    }

    // Only clear queue.currentTicket if THIS was the latest ticket
    if (queue && queue.currentTicket?.toString() === ticket._id.toString()) {
      queue.currentTicket = null;
      await queue.save();
    }

    io.to(`department_${departmentId}`).emit("ticket_completed", {
      ticketNumber: ticket.ticketNumber,
      userId: ticket.user,
      ticketId: ticket._id,
      servedBy: req.user.id,
    });

    // 🛡️ ANALYTICS
    io.to("admin_room").emit("update_analytics");

    // Notify specific user room for feedback prompt
    if (ticket.user) {
      const userRoom = `user_${ticket.user}`;
      console.log(`🔔 Emitting feedback prompt to ${userRoom}`);
      io.to(userRoom).emit("show_feedback_prompt", {
        ticketNumber: ticket.ticketNumber,
        ticketId: ticket._id,
        departmentName: (await Department.findById(departmentId))?.name || "Department"
      });
    }

    // 📧 EMAIL NOTIFICATION ON COMPLETION
    if (ticket.user) {
      const userData = await User.findById(ticket.user);
      const dept = await Department.findById(departmentId);
      if (userData && userData.email) {
        await sendTicketEmail(userData.email, {
          ticketNumber: ticket.ticketNumber,
          departmentName: dept.name,
          status: "completed",
        });
      }
    }

    const crowdStatus = await getCrowdStatusByDepartment(departmentId);

    io.to(`department_${departmentId}`).emit("queue_crowd_updated", {
      departmentId,
      ...crowdStatus,
    });

    res.json({
      message: "Ticket completed successfully",
      ticketNumber: ticket.ticketNumber,
    });
  } catch (error) {
    console.error("Complete ticket error:", error);
    res.status(500).json({ message: error.message });
  }
};


// ==============================
// STAFF TOGGLE QUEUE STATUS
// ==============================
export const toggleQueueStatus = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const staff = await User.findById(req.user.id);
    if (!staff || !staff.department) {
      return res.status(400).json({ message: "Staff not assigned" });
    }

    const departmentId = staff.department.toString();
    const queue = await Queue.findOne({ department: departmentId });

    if (!queue) {
      return res.status(404).json({ message: "Queue not found" });
    }

    queue.isOpen = !queue.isOpen;
    await queue.save();

    io.to(`department_${departmentId}`).emit("queue_status_changed", {
      isOpen: queue.isOpen,
    });

    res.json({
      message: `Queue ${queue.isOpen ? "opened" : "closed"}`,
      isOpen: queue.isOpen,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ==============================
// SET QUEUE LIMIT
// ==============================
export const setQueueLimit = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const { maxTickets } = req.body;
    const staff = await User.findById(req.user.id);
    const departmentId = staff.department.toString();

    const queue = await Queue.findOne({ department: departmentId });
    queue.maxTickets = maxTickets;
    await queue.save();

    io.to(`department_${departmentId}`).emit("queue_limit_updated", {
      maxTickets,
    });

    res.json({
      message: "Queue limit updated",
      maxTickets,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ==============================
// STAFF INCREASE QUEUE LIMIT
// ==============================
export const increaseQueueLimit = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const { increaseBy } = req.body;
    if (!increaseBy || increaseBy <= 0) {
      return res.status(400).json({ message: "Invalid increase value" });
    }

    const staff = await User.findById(req.user.id);
    if (!staff || !staff.department) {
      return res.status(400).json({
        message: "Staff not assigned to department",
      });
    }

    const departmentId = staff.department.toString();
    const queue = await Queue.findOne({ department: departmentId });

    if (!queue) {
      return res.status(404).json({ message: "Queue not found" });
    }

    queue.maxTickets =
      queue.maxTickets === null ? increaseBy : queue.maxTickets + increaseBy;

    queue.isOpen = true;
    await queue.save();

    io.to(`department_${departmentId}`).emit("queue_status_changed", {
      isOpen: true,
      maxTickets: queue.maxTickets,
    });

    res.json({
      message: "Queue limit increased",
      maxTickets: queue.maxTickets,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ===============================
// GENERATE QR FOR STAFF DEPARTMENT
// ===============================
export const generateDepartmentQR = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const staff = await User.findById(req.user.id);
    if (!staff || !staff.department) {
      return res.status(400).json({
        message: "Staff is not assigned to any department",
      });
    }

    const departmentId = staff.department.toString();
    const endOfToday = new Date();
    endOfToday.setUTCHours(23, 59, 59, 999);

    let staffQr = await StaffQr.findOne({
      department: departmentId,
      isActive: true,
      validDate: { $gte: new Date() },
    });

    if (!staffQr) {
      staffQr = await StaffQr.create({
        department: departmentId,
        qrId: crypto.randomUUID(),
        validDate: endOfToday,
        isActive: true,
      });
    }

    const joinUrl = `${process.env.FRONTEND_BASE_URL}/#/guest/entry/${staffQr.qrId}`;
    const qrCode = await QRCode.toDataURL(joinUrl);

    res.json({
      qrId: staffQr.qrId,
      joinUrl,
      qrCode,
      validTill: staffQr.validDate,
    });
  } catch (error) {
    console.error("Staff QR error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// ==============================
// STAFF QUEUE STATS
// ==============================
export const getQueueStats = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const staff = await User.findById(req.user.id);
    if (!staff || !staff.department) {
      return res.status(400).json({
        message: "Staff not assigned to any department",
      });
    }

    const queue = await Queue.findOne({
      department: staff.department,
    });

    if (!queue) {
      return res.status(404).json({ message: "Queue not found" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const total = await Ticket.countDocuments({ 
        queue: queue._id, 
        createdAt: { $gte: today } 
    });
    const served = await Ticket.countDocuments({
      queue: queue._id,
      status: "completed",
      createdAt: { $gte: today }
    });
    const waiting = await Ticket.countDocuments({
      queue: queue._id,
      status: "waiting",
      createdAt: { $gte: today }
    });
    
    const serving = await Ticket.countDocuments({
      queue: queue._id,
      status: "serving",
      createdAt: { $gte: today }
    });

    const onHold = await Ticket.countDocuments({
      queue: queue._id,
      status: "hold",
      createdAt: { $gte: today }
    });

    res.json({
      total,
      served,
      waiting,
      serving,
      onHold,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ==============================
   STAFF ADD NOTE TO TICKET
============================== */
export const addTicketNote = async (req, res) => {
  try {
    const { ticketId, content } = req.body;
    if (!content) return res.status(400).json({ message: "Content required" });

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    ticket.notes.push({
      content,
      author: req.user.id,
    });

    await ticket.save();

    // 🚀 Return the ticket with populated notes
    const updatedTicket = await Ticket.findById(ticketId)
      .populate("user", "fullName email")
      .populate("notes.author", "fullName");

    res.json({ message: "Note added", ticket: updatedTicket });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ==============================
   STAFF TRANSFER TICKET
============================== */
export const transferTicket = async (req, res) => {
  try {
    const { ticketId, toDepartmentId, internalNote, targetPosition } = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const staff = await User.findById(req.user.id);
    const fromDeptId = staff.department;

    const toQueue = await Queue.findOne({ department: toDepartmentId });
    if (!toQueue) return res.status(404).json({ message: "Target queue not found" });

    // 1. Record transfer history
    ticket.transferHistory.push({
      fromDept: fromDeptId,
      toDept: toDepartmentId,
      transferredBy: req.user.id,
    });

    // 2. Add internal note if provided
    if (internalNote) {
      ticket.notes.push({
        content: `[INTERNAL TRANSFER NOTE] ${internalNote}`,
        author: req.user.id,
      });
    }

    // 3. Move to new queue and reset status to waiting
    const oldQueueId = ticket.queue;
    ticket.queue = toQueue._id;
    ticket.status = "waiting";
    ticket.servedAt = null;
    ticket.servedBy = null;

    // 4. Handle Position (1st or 2nd)
    // Find existing waiting tickets in the target queue sorted by current logic
    const waitingTickets = await Ticket.find({
      queue: toQueue._id,
      status: "waiting",
    }).sort({ priority: -1, createdAt: 1 });

    if (waitingTickets.length > 0) {
      const firstTicket = waitingTickets[0];
      
      if (targetPosition === 1) {
        // Set priority and make it older than the current first
        ticket.priority = Math.max(firstTicket.priority, 10); // Use high priority
        ticket.createdAt = new Date(firstTicket.createdAt.getTime() - 1000);
      } else if (targetPosition === 2) {
        if (waitingTickets.length > 1) {
          const secondTicket = waitingTickets[1];
          // Position between 1st and 2nd
          ticket.priority = firstTicket.priority;
          const midTime = (firstTicket.createdAt.getTime() + secondTicket.createdAt.getTime()) / 2;
          ticket.createdAt = new Date(midTime);
        } else {
          // Only one ticket exists, so it becomes 2nd
          ticket.priority = firstTicket.priority;
          ticket.createdAt = new Date(firstTicket.createdAt.getTime() + 1000);
        }
      }
    } else {
      // Empty queue, just set a default priority
      ticket.priority = 0;
    }

    await ticket.save();

    // 5. Update old queue currentTicket if necessary
    const oldQueue = await Queue.findById(oldQueueId);
    if (oldQueue.currentTicket?.toString() === ticketId) {
        oldQueue.currentTicket = null;
        await oldQueue.save();
    }

    // 6. Notify both departments via socket
    io.to(`department_${fromDeptId}`).emit("ticket_transferred_out", { ticketId });
    io.to(`department_${toDepartmentId}`).emit("ticket_transferred_in", {
      ticketNumber: ticket.ticketNumber,
      ticketId: ticket._id,
    });
    
    // 7. Notify student/guest
    const transferData = {
        toDepartmentName: (await Department.findById(toDepartmentId))?.name || "New Department",
        departmentId: toDepartmentId,
        ticketId: ticket._id
    };
    
    if (ticket.user) {
        io.to(`user_${ticket.user}`).emit("ticket_transferred", transferData);
    }
    // Also notify the ticket room (covers guests)
    io.to(`ticket_${ticket._id}`).emit("ticket_transferred", transferData);

    res.json({ message: "Ticket transferred successfully", ticket });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ==============================
   GET SINGLE TICKET DETAILS
============================== */
export const getTicketDetails = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findById(ticketId)
      .populate("user", "fullName email")
      .populate("notes.author", "fullName");
    
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ==============================
   STAFF LIST DEPARTMENTS (FOR TRANSFER)
============================== */
export const getTransferDepartments = async (req, res) => {
  try {
    const depts = await Department.find({ isActive: true })
      .select("name _id")
      .sort({ name: 1 });
    res.json(depts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ==============================
   STAFF DEPARTMENT BROADCAST
============================== */
export const sendDepartmentBroadcast = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Message is required" });

    const staff = await User.findById(req.user.id);
    if (!staff || !staff.department) {
      return res.status(400).json({ message: "Staff not assigned to department" });
    }

    const departmentId = staff.department.toString();
    const staffName = staff.fullName;

    // Emit to all users in this department room
    io.to(`department_${departmentId}`).emit("broadcast", {
      message,
      staffName,
      timestamp: new Date()
    });

    res.json({ message: "Broadcast sent successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==============================
// GET ALL TICKETS FOR DEPARTMENT
// ==============================
export const getDepartmentTickets = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const staff = await User.findById(req.user.id);
    if (!staff || !staff.department) {
      return res.status(400).json({ message: "Staff not assigned" });
    }

    const departmentId = staff.department.toString();
    const queue = await Queue.findOne({ department: departmentId });

    if (!queue) {
      return res.json([]);
    }

    const tickets = await Ticket.find({
      queue: queue._id,
      status: { $in: ["waiting", "serving", "hold"] },
    }).sort({ priority: -1, createdAt: 1 });

    // Enriched data for the table
    const enrichedTickets = await Promise.all(tickets.map(async (t) => {
      const student = t.user ? await User.findById(t.user).select("fullName studentID") : null;
      
      // Calculate waiting position for those in "waiting" status
      let waitingPos = null;
      if (t.status === "waiting") {
        waitingPos = await Ticket.countDocuments({
          queue: queue._id,
          status: "waiting",
          _id: { $ne: t._id },
          $or: [
            { priority: { $gt: t.priority } },
            { priority: t.priority, createdAt: { $lt: t.createdAt } }
          ]
        }) + 1;
      }

      return {
        _id: t._id,
        ticketNumber: t.ticketNumber,
        status: t.status,
        studentName: student?.fullName || (t.isGuest ? "Guest" : "Unknown"),
        studentID: student?.studentID || (t.isGuest ? "GUEST" : "N/A"),
        waitingPosition: waitingPos,
        holdAt: t.holdAt,
        joinedAt: t.createdAt
      };
    }));

    res.json(enrichedTickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

