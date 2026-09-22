import Ticket from "../models/Ticket.js";

// ==============================
// HELPER: CALCULATE TICKET POSITION
// ==============================
export const calculatePosition = async (ticketId) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket || ticket.status === "serving") return 1;

  const aheadCount = await Ticket.countDocuments({
    queue: ticket.queue,
    _id: { $ne: ticket._id },
    status: { $in: ["waiting", "serving"] },
    $or: [
      { status: "serving" },
      {
        status: "waiting",
        $or: [
          { priority: { $gt: ticket.priority } },
          { priority: ticket.priority, createdAt: { $lt: ticket.createdAt } }
        ]
      }
    ]
  });

  return aheadCount + 1;
};
