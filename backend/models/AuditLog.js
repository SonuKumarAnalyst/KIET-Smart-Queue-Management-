import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String, // e.g., "CREATE_DEPARTMENT", "DELETE_DEPARTMENT", "ASSIGN_STAFF"
    required: true,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  details: {
    type: String,
    required: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  ipAddress: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("AuditLog", auditLogSchema);
