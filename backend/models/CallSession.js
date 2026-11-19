import mongoose from "mongoose";

const callSessionSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    roomName: {
      type: String,
      required: true,
      unique: true,
    },
    domain: {
      type: String,
      default: "meet.jit.si",
    },
    status: {
      type: String,
      enum: ["ringing", "active", "accepted", "rejected", "ended"],
      default: "ringing",
    },
    startedAt: Date,
    acceptedAt: Date,
    endedAt: Date,
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

callSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("CallSession", callSessionSchema);
