// ============================
// NGOXI FULL SERVER (FIXED + CLEAN)
// Express + MongoDB + Socket.io + Static Serving (ESM Safe)
// ============================

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import { Server } from "socket.io";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Convert ES module paths => __dirname, __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Load ENV =====
dotenv.config();
const app = express();
const allowed =
  process.env.NODE_ENV === "production"
    ? ["https://ngoxi.app"]
    : ["http://127.0.0.1:5000", "http://localhost:5000"];

// ===== CORS (allow everything in dev) =====
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5000",
      "http://localhost:5000",
      "http://127.0.0.1:5500",
    ],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

app.set("trust proxy", 1);

// ===== Body Parsers =====
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ============================
// ✅ STATIC FILES (THE IMPORTANT FIX)
// ============================
// ============================
// ✅ STATIC FILES + PAGE ROUTES
// ============================
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "views")));

// Clean page routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "auth.html"));
});

app.get("/auth", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "auth.html"));
});

app.get("/seller", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "seller.html"));
});

app.get("/buyer", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin.html"));
});

app.get("/role-select", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "role-select.html"));
});

// ============================
// ✅ DATABASE CONNECTION
// ============================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ============================
// ✅ ROUTES
// ============================
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/product.js";
import sellerRoutes from "./routes/seller.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import adminRoutes from "./routes/admin.js";

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/seller", sellerRoutes);

// admin routes
app.use("/api/admin", adminRoutes);
app.use("/api/admin/dashboard", adminRoutes);

// Root API index
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "auth.html"));
});

app.get("/auth", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "auth.html"));
});

app.get("/seller", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "seller.html"));
});

app.get("/buyer", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin.html"));
});

app.get("/role-select", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "role-select.html"));
});

// ============================
// ✅ SOCKET.IO SERVER
// ============================
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// ---- Track online users ----
globalThis.online = {
  buyers: new Set(),
  sellers: new Set(),
  admins: new Set(),
};

// ---- Chat log storage ----
const DATA_DIR = path.join(__dirname, "data");
const CHAT_LOG = path.join(DATA_DIR, "chats.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(CHAT_LOG)) fs.writeFileSync(CHAT_LOG, "[]");

function saveChat(msg) {
  try {
    const arr = JSON.parse(fs.readFileSync(CHAT_LOG, "utf8"));
    arr.push(msg);
    fs.writeFileSync(CHAT_LOG, JSON.stringify(arr, null, 2));
  } catch (err) {
    console.log("❌ Chat log error:", err);
  }
}

// ============================
// ✅ SOCKET EVENTS
// ============================
io.on("connection", (socket) => {
  console.log("✅ New socket connected:", socket.id);

  socket.on("join", ({ userId, role }) => {
    if (!userId) return;

    const r = (role || "buyer").toLowerCase();
    socket.data.userId = userId;
    socket.data.role = r;

    socket.join(userId);
    if (r === "admin") socket.join("admin-room");

    if (r === "buyer") globalThis.online.buyers.add(userId);
    if (r === "seller") globalThis.online.sellers.add(userId);
    if (r === "admin") globalThis.online.admins.add(userId);

    io.emit("onlineCounts", {
      buyers: globalThis.online.buyers.size,
      sellers: globalThis.online.sellers.size,
      admins: globalThis.online.admins.size,
    });
  });

  // --- Direct DM chat ---
  socket.on("chat:dm", (msg) => {
    const payload = { ...msg, ts: new Date() };
    saveChat(payload);

    if (msg.toId) io.to(msg.toId).emit("chat:dm", payload);
    if (msg.fromId) io.to(msg.fromId).emit("chat:dm", payload);
  });

  // --- Admin broadcast ---
  socket.on("chat:broadcast", ({ fromId, segment, text }) => {
    const payload = {
      fromId,
      fromRole: "admin",
      text,
      ts: new Date(),
      broadcast: segment || "all",
    };
    saveChat(payload);

    const seg = (segment || "all").toLowerCase();

    if (seg === "buyers") {
      globalThis.online.buyers.forEach((id) =>
        io.to(id).emit("chat:notice", payload),
      );
    } else if (seg === "sellers") {
      globalThis.online.sellers.forEach((id) =>
        io.to(id).emit("chat:notice", payload),
      );
    } else if (seg === "admins") {
      io.to("admin-room").emit("chat:notice", payload);
    } else {
      io.emit("chat:notice", payload);
    }
  });

  // --- Disconnect ---
  socket.on("disconnect", () => {
    const { userId, role } = socket.data || {};

    if (userId && role) {
      if (role === "buyer") globalThis.online.buyers.delete(userId);
      if (role === "seller") globalThis.online.sellers.delete(userId);
      if (role === "admin") globalThis.online.admins.delete(userId);

      io.emit("onlineCounts", {
        buyers: globalThis.online.buyers.size,
        sellers: globalThis.online.sellers.size,
        admins: globalThis.online.admins.size,
      });
    }

    console.log("❌ Socket disconnected", socket.id);
  });
});

// --- Chat history API ---
app.get("/api/chat/history", (req, res) => {
  const { a, b } = req.query;
  try {
    const all = JSON.parse(fs.readFileSync(CHAT_LOG, "utf8"));
    const history = all.filter(
      (m) =>
        (m.fromId === a && m.toId === b) || (m.fromId === b && m.toId === a),
    );
    res.json(history);
  } catch {
    res.status(500).json({ error: "Chat history read failed" });
  }
});

// --- Online count fallback ---
app.get("/api/admin/dashboard/online", (req, res) => {
  try {
    res.json({
      buyers: globalThis.online.buyers.size,
      sellers: globalThis.online.sellers.size,
      admins: globalThis.online.admins.size,
    });
  } catch {
    res.status(500).json({ error: "Failed to read online counts" });
  }
});

// ============================
// ✅ START SERVER
// ============================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () =>
  console.log(`🚀 NgoXi server + WebSocket running on port ${PORT}`),
);
