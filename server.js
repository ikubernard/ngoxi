// ============================
// NGOXI FULL SERVER (FIXED + CLEAN)
// Express + MongoDB + Socket.io + Static Serving (ESM Safe)
// ============================

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
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
const allowedOrigins = [
  "https://ngoxi.onrender.com",
  "https://ngoxi.app",
  "http://127.0.0.1:5000",
  "http://localhost:5000",
  "http://127.0.0.1:5500",
];

app.use(
  cors({
    origin(origin, callback) {
      /*
        Requests with no Origin can happen from
        same-origin navigation/tools.
      */
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },

    credentials: true,

    allowedHeaders: ["Content-Type", "Authorization"],

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.set("trust proxy", 1);

// ===== Body Parsers =====
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

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
import buyerRoutes from "./routes/buyer.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import orderRoutes from "./routes/orders.js";
import adminRoutes from "./routes/admin.js";

app.use("/api/auth", authRoutes);
app.use("/api/buyer", buyerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/orders", orderRoutes);
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
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});
function parseCookieHeader(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");

    if (index === -1) {
      return cookies;
    }

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (key) {
      cookies[key] = decodeURIComponent(value);
    }

    return cookies;
  }, {});
}

io.use((socket, next) => {
  try {
    const cookies = parseCookieHeader(socket.handshake.headers.cookie || "");

    const token = cookies.ngoxi_auth;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = String(decoded.id || decoded._id || "");

    if (!userId) {
      return next(new Error("Invalid session"));
    }

    socket.data.userId = userId;

    socket.data.roles = Array.isArray(decoded.roles)
      ? decoded.roles.map((role) => String(role).toLowerCase())
      : [];

    next();
  } catch (error) {
    console.error("Socket authentication failed:", error.message);

    next(new Error("Invalid or expired session"));
  }
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
  const userId = socket.data.userId;
  const roles = socket.data.roles || [];

  console.log("✅ Authenticated socket connected:", socket.id, userId, roles);

  socket.join(`user:${userId}`);

  if (roles.includes("buyer")) {
    globalThis.online.buyers.add(userId);
  }

  if (roles.includes("seller")) {
    globalThis.online.sellers.add(userId);
  }

  if (roles.includes("admin")) {
    globalThis.online.admins.add(userId);
    socket.join("admin-room");
  }

  io.emit("onlineCounts", {
    buyers: globalThis.online.buyers.size,
    sellers: globalThis.online.sellers.size,
    admins: globalThis.online.admins.size,
  });

  // =====================================
  // YOUR OTHER SOCKET EVENTS STAY HERE
  // chat:dm, chat:broadcast, etc.
  // =====================================

  // =====================================
  // DISCONNECT - PUT IT NEAR THE BOTTOM
  // =====================================
  socket.on("disconnect", () => {
    const userId = socket.data.userId;
    const roles = socket.data.roles || [];

    if (userId) {
      if (roles.includes("buyer")) {
        globalThis.online.buyers.delete(userId);
      }

      if (roles.includes("seller")) {
        globalThis.online.sellers.delete(userId);
      }

      if (roles.includes("admin")) {
        globalThis.online.admins.delete(userId);
      }
    }

    io.emit("onlineCounts", {
      buyers: globalThis.online.buyers.size,
      sellers: globalThis.online.sellers.size,
      admins: globalThis.online.admins.size,
    });

    console.log("❌ Authenticated socket disconnected:", socket.id);
  });
}); // ← io.on("connection") ENDS HERE

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
