import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    description: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    staff: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // 🛠️ SERVICE CATEGORIES
    services: [
      {
        name: { type: String, required: true },
        estimatedDuration: { type: Number, default: 5 }, // in minutes
      },
    ],
    // 📍 MAP LOCATION (Percentages for responsiveness)
    location: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

const Department = mongoose.model("Department", departmentSchema);

export default Department;
