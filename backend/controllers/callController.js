import crypto from "crypto";
import CallSession from "../models/CallSession.js";
import Ticket from "../models/Ticket.js";
import User from "../models/User.js";
import { io } from "../server.js";

const isParticipant = (call, user) =>
  call.student?.toString() === user.id || call.staff?.toString() === user.id;

export const startVideoCall = async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Staff only" });
    }

    const { ticketId } = req.body;
    if (!ticketId) {
      return res.status(400).json({ message: "Ticket ID is required" });
    }

    const ticket = await Ticket.findById(ticketId).populate("queue");
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    if (ticket.status !== "serving" || ticket.servedBy?.toString() !== req.user.id) {
      return res.status(400).json({ message: "This ticket is not currently assigned to you" });
    }
    if (!ticket.user) {
      return res.status(400).json({ message: "Video calls are available only for registered students" });
    }

    await CallSession.updateMany(
      { ticket: ticket._id, status: { $in: ["ringing", "active", "accepted"] } },
      { status: "ended", endedAt: new Date() }
    );

    const staff = await User.findById(req.user.id).select("fullName");
    const student = await User.findById(ticket.user).select("fullName");
    if (!staff || !student) {
      return res.status(404).json({ message: "Call participants not found" });
    }

    const queueDepartment = ticket.queue?.department;
    const departmentId = queueDepartment || (await User.findById(req.user.id).select("department")).department;
    if (!departmentId) {
      return res.status(400).json({ message: "Staff department is required" });
    }

    const roomName = `KIET-${ticket.ticketNumber}-${crypto.randomBytes(8).toString("hex")}`;
    const domain = process.env.JITSI_DOMAIN || "meet.jit.si";
    const call = await CallSession.create({
      ticket: ticket._id,
      student: ticket.user,
      staff: req.user.id,
      department: departmentId,
      roomName,
      domain,
      status: "ringing",
      startedAt: new Date(),
    });

    const payload = {
      callId: call._id,
      roomName: call.roomName,
      domain: call.domain,
      ticketNumber: ticket.ticketNumber,
      staffName: staff.fullName,
      studentName: student.fullName,
    };

    io.to(`user_${ticket.user}`).emit("incoming_call", payload);

    res.status(201).json({
      ...payload,
      status: call.status,
    });
  } catch (error) {
    console.error("Start video call error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const acceptVideoCall = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Students only" });
    }
    const call = await CallSession.findById(req.params.callId);
    if (!call) return res.status(404).json({ message: "Call not found" });
    if (call.student.toString() !== req.user.id) {
      return res.status(403).json({ message: "This call belongs to another student" });
    }
    if (!["ringing", "active"].includes(call.status)) {
      return res.status(400).json({ message: "Call is no longer active" });
    }

    call.status = "accepted";
    call.acceptedAt = new Date();
    await call.save();

    const payload = { callId: call._id, roomName: call.roomName, domain: call.domain };
    io.to(`user_${call.staff}`).emit("call_accepted", payload);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const rejectVideoCall = async (req, res) => {
  try {
    const call = await CallSession.findById(req.params.callId);
    if (!call) return res.status(404).json({ message: "Call not found" });
    if (!isParticipant(call, req.user)) {
      return res.status(403).json({ message: "Not authorized to reject this call" });
    }

    call.status = "rejected";
    call.endedAt = new Date();
    await call.save();
    io.to(`user_${call.student}`).emit("call_rejected", { callId: call._id });
    io.to(`user_${call.staff}`).emit("call_rejected", { callId: call._id });
    res.json({ message: "Call rejected" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const endVideoCall = async (req, res) => {
  try {
    const call = await CallSession.findById(req.params.callId);
    if (!call) return res.status(404).json({ message: "Call not found" });
    if (!isParticipant(call, req.user)) {
      return res.status(403).json({ message: "Not authorized to end this call" });
    }

    call.status = "ended";
    call.endedAt = new Date();
    await call.save();

    const payload = { callId: call._id };
    io.to(`user_${call.student}`).emit("call_ended", payload);
    io.to(`user_${call.staff}`).emit("call_ended", payload);
    res.json({ message: "Call ended" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getActiveVideoCall = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    if (
      (req.user.role === "student" && ticket.user?.toString() !== req.user.id) ||
      (req.user.role === "staff" && ticket.servedBy?.toString() !== req.user.id)
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const call = await CallSession.findOne({
      ticket: ticket._id,
      status: { $in: ["ringing", "active", "accepted"] },
    }).sort({ createdAt: -1 });

    res.json(call ? {
      callId: call._id,
      roomName: call.roomName,
      domain: call.domain,
      status: call.status,
    } : null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
