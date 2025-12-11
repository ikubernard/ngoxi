// utils/multer.js
import multer from "multer";

const storage = multer.memoryStorage(); // we’ll stream buffers to Cloudinary
export const upload = multer({ storage });
