import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 🔥 Use absolute path to avoid confusion with working directory
    const uploadPath = path.join(__dirname, "../uploads/emergency_proofs");
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and PDF files are allowed"), false);
  }
};

const uploadEmergency = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export default uploadEmergency;
