import mongoose from "mongoose";

const supportRequestSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    category: {
      type: String,
      enum: ["term-registration", "college-email", "erp", "documents", "other"],
      default: "other",
    },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "visit-required", "closed"],
      default: "open",
    },
    staffResponse: { type: String, default: "", maxlength: 2000 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supportRequestSchema.index({ department: 1, status: 1, createdAt: -1 });
supportRequestSchema.index({ student: 1, createdAt: -1 });

export default mongoose.model("SupportRequest", supportRequestSchema);
