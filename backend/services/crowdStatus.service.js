import Ticket from "../models/Ticket.js";
import Queue from "../models/Queue.js";
import Department from "../models/Department.js";

/**
 * Crowd Status Service
 * -------------------
 * Calculates real-time crowd signal for a department
 */

const DEFAULT_SERVICE_TIME = 5;

/**
 * Get crowd status for a department
 * @param {String} departmentId
 */
export const getCrowdStatusByDepartment = async (departmentId) => {
  if (!departmentId) {
    throw new Error("Department ID is required");
  }

  // 1️⃣ Find queue for department
  const queue = await Queue.findOne({ department: departmentId });

  if (!queue) {
    return {
      queueLength: 0,
      estimatedWaitTime: 0,
      crowdLevel: "GREEN",
    };
  }

  // 2️⃣ Count active tickets (waiting)
  const waitingTickets = await Ticket.find({
    queue: queue._id,
    status: "waiting",
  });

  const queueLength = waitingTickets.length;

  // 2.5️⃣ Get currently serving tickets (for real-time multi-staff display)
  const servingTickets = await Ticket.find({
    queue: queue._id,
    status: "serving",
  }).select("ticketNumber servedBy").populate("servedBy", "fullName");

  // 3️⃣ SMART PREDICTION: Calculate dynamic average service time
  // Based on last 10 completed tickets for this queue
  const recentCompletedTickets = await Ticket.find({
    queue: queue._id,
    status: "completed",
    calledAt: { $ne: null },
    servedAt: { $ne: null }
  })
  .sort({ servedAt: -1 })
  .limit(10);

  let dynamicAvgTime = DEFAULT_SERVICE_TIME;

  if (recentCompletedTickets.length > 0) {
    const totalServiceTime = recentCompletedTickets.reduce((acc, ticket) => {
      const duration = (new Date(ticket.servedAt) - new Date(ticket.calledAt)) / 60000;
      return acc + duration;
    }, 0);
    dynamicAvgTime = totalServiceTime / recentCompletedTickets.length;
    
    // Safety boundaries (not too fast, not too slow)
    dynamicAvgTime = Math.max(2, Math.min(20, dynamicAvgTime));
  }

  // 4️⃣ Calculate total estimated wait time for the queue
  // Sum up durations of specific services for waiting tickets
  const totalServiceDuration = waitingTickets.reduce((acc, t) => acc + (t.serviceDuration || dynamicAvgTime), 0);

  // 🔥 REAL-TIME: Get actual number of staff assigned to this department
  const department = await Department.findById(departmentId).select("staff");
  const activeStaffCount = Math.max(1, department?.staff?.length || 1);

  let estimatedWaitTime = Math.ceil(totalServiceDuration / activeStaffCount);

  // 5️⃣ Decide crowd level
  let crowdLevel = "GREEN";

  if (estimatedWaitTime > 30) {
    crowdLevel = "RED";
  } else if (estimatedWaitTime > 15) {
    crowdLevel = "YELLOW";
  }

  // 6️⃣ Return final result
  return {
    queueLength,
    servingTickets,
    estimatedWaitTime,
    crowdLevel,
    dynamicAvgTime: Math.round(dynamicAvgTime * 10) / 10
  };
};
