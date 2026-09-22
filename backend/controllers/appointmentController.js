import Appointment from "../models/Appointment.js";
import Department from "../models/Department.js";
import Queue from "../models/Queue.js";
import Ticket from "../models/Ticket.js";
import { io } from "../server.js";
import mongoose from "mongoose";

// Define standard operating hours/slots (10:00 AM - 4:00 PM, 30 min intervals)
const TIME_SLOTS = [
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", 
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"
];

const MAX_BOOKINGS_PER_SLOT = 3; // Number of people who can book the same slot

export const bookAppointment = async (req, res) => {
  try {
    const { departmentId, appointmentDate, timeSlot, purpose } = req.body;
    const userId = req.user.id;

    // Check if slot is valid
    if (!TIME_SLOTS.includes(timeSlot)) {
      return res.status(400).json({ message: "Invalid time slot" });
    }

    // Check if slot is already full for that department/date
    const bookingCount = await Appointment.countDocuments({
      department: departmentId,
      appointmentDate: new Date(appointmentDate),
      timeSlot,
      status: "booked"
    });

    if (bookingCount >= MAX_BOOKINGS_PER_SLOT) {
      return res.status(400).json({ message: "This time slot is full. Please choose another." });
    }

    const appointment = await Appointment.create({
      user: userId,
      department: departmentId,
      appointmentDate: new Date(appointmentDate),
      timeSlot,
      purpose,
    });

    res.status(201).json({ message: "Appointment booked successfully", appointment });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "You already have an appointment with this department on this day." });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getMyAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ user: req.user.id })
      .populate("department", "name")
      .sort({ appointmentDate: 1, timeSlot: 1 });

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Filter out past appointments for today (unless they are checked-in or cancelled which are history)
    const filtered = appointments.filter(appt => {
      const apptDate = new Date(appt.appointmentDate);
      if (apptDate.toDateString() !== now.toDateString()) return true; // Keep other days
      
      // If it's today, only keep if it's in the future OR already has a final status
      if (appt.status !== "booked") return true; 
      
      const [slotHour, slotMinute] = appt.timeSlot.split(":").map(Number);
      return slotHour > currentHour || (slotHour === currentHour && slotMinute > currentMinute);
    });

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findOne({ _id: id, user: req.user.id });

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    appointment.status = "cancelled";
    await appointment.save();

    res.json({ message: "Appointment cancelled" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAvailableSlots = async (req, res) => {
  try {
    const { departmentId, date } = req.query;
    
    // Count existing bookings per slot
    const bookings = await Appointment.aggregate([
      { $match: { 
          department: new mongoose.Types.ObjectId(departmentId), 
          appointmentDate: new Date(date),
          status: "booked"
        } 
      },
      { $group: { _id: "$timeSlot", count: { $sum: 1 } } }
    ]);

    const now = new Date();
    const isToday = new Date(date).toDateString() === now.toDateString();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const availability = TIME_SLOTS.map(slot => {
      // Check if slot is in the past (only if date is today)
      let isPast = false;
      if (isToday) {
        const [slotHour, slotMinute] = slot.split(":").map(Number);
        if (slotHour < currentHour || (slotHour === currentHour && slotMinute <= currentMinute)) {
          isPast = true;
        }
      }

      const b = bookings.find(item => item._id === slot);
      return {
        time: slot,
        available: !isPast && (b ? b.count : 0) < MAX_BOOKINGS_PER_SLOT,
        remaining: isPast ? 0 : MAX_BOOKINGS_PER_SLOT - (b ? b.count : 0),
        isPast
      };
    });

    res.json(availability);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const checkInAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. Find the appointment
    const appointment = await Appointment.findOne({ _id: id, user: userId, status: "booked" });
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found or already checked-in" });
    }

    // 2. Validate it's for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const apptDate = new Date(appointment.appointmentDate);
    apptDate.setHours(0, 0, 0, 0);

    if (today.getTime() !== apptDate.getTime()) {
      return res.status(400).json({ message: "You can only check-in on the day of your appointment." });
    }

    // 3. Find the queue
    let queue = await Queue.findOne({ department: appointment.department });
    if (!queue) {
      queue = await Queue.create({ department: appointment.department });
    }

    // 4. Create a priority ticket
    const waitingCount = await Ticket.countDocuments({
      queue: queue._id,
      status: "waiting",
    });

    const ticketNumber = `APP${String(waitingCount + 1).padStart(3, "0")}`;

    const ticket = await Ticket.create({
      ticketNumber,
      queue: queue._id,
      user: userId,
      serviceName: "Scheduled Visit",
      serviceDuration: 10,
      priority: 1, // 1 = Appointment Priority
      appointment: appointment._id,
      source: "app",
      status: "waiting",
    });

    // 5. Update appointment status
    appointment.status = "checked-in";
    await appointment.save();

    // 6. Notify department
    io.to(`department_${appointment.department}`).emit("ticket_joined", {
      ticketNumber,
      position: waitingCount + 1,
    });

    res.json({ message: "Checked-in successfully! You are now in the prioritized queue.", ticket });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDepartmentAppointments = async (req, res) => {
  try {
    const { date, departmentId } = req.query;
    
    // If specific department is provided (admin view), use it. 
    // Otherwise, use staff's own department.
    let deptId = departmentId;
    if (!deptId) {
      if (req.user.role !== "staff") {
        return res.status(403).json({ message: "Department ID or Staff Role required" });
      }
      // Need to find staff's department
      const User = mongoose.model("User");
      const staff = await User.findById(req.user.id);
      if (!staff || !staff.department) {
        return res.status(400).json({ message: "Staff not assigned to department" });
      }
      deptId = staff.department;
    }

    const query = { department: deptId };
    if (date) {
      const start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setUTCHours(23, 59, 59, 999);
      query.appointmentDate = { $gte: start, $lte: end };
    }

    console.log("🔍 Fetching appointments with query:", JSON.stringify(query));

    const appointments = await Appointment.find(query)
      .populate("user", "fullName email studentID")
      .sort({ appointmentDate: 1, timeSlot: 1 });

    // Filter out past appointments for today (unless they are already checked-in)
    const now = new Date();
    const isToday = date && new Date(date).toDateString() === now.toDateString();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const realTimeAppointments = isToday ? appointments.filter(appt => {
      if (appt.status === "checked-in") return true;
      const [slotHour, slotMinute] = appt.timeSlot.split(":").map(Number);
      return slotHour > currentHour || (slotHour === currentHour && slotMinute > currentMinute);
    }) : appointments;

    console.log(`✅ Found ${realTimeAppointments.length} real-time appointments`);

    res.json(realTimeAppointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
