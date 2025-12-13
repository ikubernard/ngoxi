import express from "express";
import User from "../model/User.js";
import Product from "../model/product.js";
import jwt from "jsonwebtoken";

const router = express.Router();

/* ---------------- Auth helpers (admin only) ---------------- */
function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
function requireAdmin(req, res, next) {
  if (req.user?.roles?.includes("admin")) return next();
  return res.status(403).json({ error: "Admin only" });
}

// Utility: safe project for list items
const pickBasic = (u) => ({
  id: u._id.toString(),
  name: u.name,
  email: u.email,
  role:
    u.roles.includes("seller") && u.ngoXiPlan === "standard"
      ? "standard"
      : u.roles.includes("seller")
      ? "free"
      : u.roles[0] || "user",
  plan: u.ngoXiPlan,
});

/* ---------------- Overview stats ---------------- */
// GET /api/admin/stats  -> { users, sellers, buyers, products }
router.get("/stats", verifyToken, requireAdmin, async (req, res) => {
  try {
    const [users, sellers, buyers, products] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ roles: "seller" }),
      User.countDocuments({ roles: "buyer" }),
      Product.countDocuments(),
    ]);
    res.json({ users, sellers, buyers, products });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

/* ---------------- Sellers panel ---------------- */
// GET /api/admin/sellers -> { paid:[], unpaid:[], online:[] }
router.get("/sellers", verifyToken, requireAdmin, async (req, res) => {
  try {
    const [paid, unpaid] = await Promise.all([
      User.find({ roles: "seller", ngoXiPlan: "standard" }).limit(200),
      User.find({ roles: "seller", ngoXiPlan: "free" }).limit(200),
    ]);

    // online sets come from server (see server.js patch)
    const onlineSellers = Array.from(globalThis.online?.sellers || []);
    // get user docs for online ids
    const onlineDocs = onlineSellers.length
      ? await User.find({ _id: { $in: onlineSellers } }).limit(200)
      : [];

    res.json({
      paid: paid.map(pickBasic),
      unpaid: unpaid.map((u) => ({ ...pickBasic(u), upgradable: true })),
      online: onlineDocs.map(pickBasic),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load sellers" });
  }
});

/* ---------------- Buyers panel ---------------- */
// GET /api/admin/buyers -> { online:[], all:[] }
router.get("/buyers", verifyToken, requireAdmin, async (req, res) => {
  try {
    const onlineBuyers = Array.from(globalThis.online?.buyers || []);
    const [onlineDocs, allBuyers] = await Promise.all([
      onlineBuyers.length
        ? User.find({ _id: { $in: onlineBuyers } }).limit(200)
        : [],
      User.find({ roles: "buyer" }).limit(200),
    ]);
    res.json({
      online: onlineDocs.map(pickBasic),
      all: allBuyers.map(pickBasic),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load buyers" });
  }
});

/* ---------------- Manual upgrade ---------------- */
// PATCH /api/admin/upgrade/:userId  -> sets ngoXiPlan:"standard"
router.patch(
  "/upgrade/:userId",
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const u = await User.findByIdAndUpdate(
        req.params.userId,
        { $set: { ngoXiPlan: "standard" } },
        { new: true }
      );
      if (!u) return res.status(404).json({ error: "User not found" });
      res.json({ ok: true, user: pickBasic(u) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to upgrade" });
    }
  }
);

/* ---------------- Revenue placeholder ---------------- */
// GET /api/admin/revenue -> { total }
router.get("/revenue", verifyToken, requireAdmin, async (req, res) => {
  // Hook LemonSqueezy later; for now return 0
  res.json({ total: "TSh 0" });
});

/* ---------------- Info: reports + today signups ---------------- */
// GET /api/admin/info -> { reports:[], signups:[] }
router.get("/info", verifyToken, requireAdmin, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const signups = await User.find({ createdAt: { $gte: startOfDay } }).limit(
      100
    );
    // reports not implemented yet; return empty list for now
    res.json({
      reports: [],
      signups: signups.map(pickBasic),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load info" });
  }
});

export default router;
