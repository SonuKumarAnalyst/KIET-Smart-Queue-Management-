import Department from "../models/Department.js";
import SupportRequest from "../models/SupportRequest.js";
import User from "../models/User.js";
import { io } from "../server.js";

const studentOnly = (req, res) => {
  if (req.user.role !== "student") {
    res.status(403).json({ message: "Students only" });
    return false;
  }
  return true;
};

export const createSupportRequest = async (req, res) => {
  try {
    if (!studentOnly(req, res)) return;
    const { departmentId, category, subject, description } = req.body;

    if (!departmentId || !subject?.trim() || !description?.trim()) {
      return res.status(400).json({ message: "Department, subject, and description are required" });
    }

    const department = await Department.findOne({ _id: departmentId, isActive: true });
    if (!department) return res.status(404).json({ message: "Department not available" });

    const request = await SupportRequest.create({
      student: req.user.id,
      department: department._id,
      category: category || "other",
      subject: subject.trim(),
      description: description.trim(),
    });

    io.to(`department_${department._id}`).emit("support_request_created", {
      requestId: request._id,
      subject: request.subject,
    });

    res.status(201).json({ message: "Support request sent successfully", request });
  } catch (error) {
    console.error("Create support request error:", error);
    res.status(500).json({ message: "Unable to send support request" });
  }
};

export const getMySupportRequests = async (req, res) => {
  try {
    if (!studentOnly(req, res)) return;
    const requests = await SupportRequest.find({ student: req.user.id })
      .populate("department", "name")
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: "Unable to load support requests" });
  }
};

export const getDepartmentSupportRequests = async (req, res) => {
  try {
    if (req.user.role !== "staff") return res.status(403).json({ message: "Staff only" });
    const staff = await User.findById(req.user.id);
    if (!staff?.department) return res.status(400).json({ message: "Staff is not assigned to a department" });

    const requests = await SupportRequest.find({ department: staff.department })
      .populate("student", "fullName email")
      .populate("department", "name")
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: "Unable to load department requests" });
  }
};

export const updateSupportRequest = async (req, res) => {
  try {
    if (req.user.role !== "staff") return res.status(403).json({ message: "Staff only" });
    const staff = await User.findById(req.user.id);
    if (!staff?.department) return res.status(400).json({ message: "Staff is not assigned to a department" });

    const { status, staffResponse } = req.body;
    const allowedStatuses = ["open", "in-progress", "resolved", "visit-required", "closed"];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ message: "Invalid support status" });

    const request = await SupportRequest.findOne({ _id: req.params.id, department: staff.department });
    if (!request) return res.status(404).json({ message: "Support request not found" });

    request.status = status;
    request.staffResponse = (staffResponse || "").trim();
    request.resolvedBy = staff._id;
    request.respondedAt = new Date();
    await request.save();

    io.to(`user_${request.student}`).emit("support_request_updated", {
      requestId: request._id,
      status: request.status,
      staffResponse: request.staffResponse,
    });

    res.json({ message: "Support request updated", request });
  } catch (error) {
    console.error("Update support request error:", error);
    res.status(500).json({ message: "Unable to update support request" });
  }
};
