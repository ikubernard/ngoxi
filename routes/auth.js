import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../model/User.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id, roles: user.roles, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

function authCookieOptions() {
  const production = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,

    secure: production,

    sameSite: "lax",

    /*
      Cookie works across the whole NgoXi site.
    */
    path: "/",

    /*
      Match current JWT lifetime.
      We'll shorten/rotate sessions later
      during auth hardening.
    */
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function setAuthCookie(res, token) {
  res.cookie("ngoxi_auth", token, authCookieOptions());
}

function clearAuthCookie(res) {
  const production = process.env.NODE_ENV === "production";

  res.clearCookie("ngoxi_auth", {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
  });
}

// ======================
// POST /api/auth/signup
// ======================
router.post("/signup", async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const role = req.body.role || "buyer";
    const adminCode = req.body.adminCode;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["buyer", "seller"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    let user = await User.findOne({ email });

    // ----- ADMIN CHECK (NEW) -----
    const wantsAdmin = adminCode === "NgoXi_master2025";

    if (user) {
      const ok = await bcrypt.compare(password, user.password);

      if (!ok) {
        return res.status(401).json({
          error:
            "Account already exists with a different password. Please log in with your original password.",
        });
      }

      // merge selected role
      if (!user.roles.includes(role)) {
        user.roles.push(role);
      }

      // merge admin role if master key is valid
      if (wantsAdmin && !user.roles.includes("admin")) {
        user.roles.push("admin");
      }

      await user.save();

      const token = signToken(user);

      setAuthCookie(res, token);

      return res.json({
        merged: true,

        message: "Role merged",

        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles,
        },
      });
    }

    // new user
    const hashed = await bcrypt.hash(password, 10);
    const roles = [role];

    if (wantsAdmin && !roles.includes("admin")) {
      roles.push("admin");
    }

    user = await User.create({
      name,
      email,
      password: hashed,
      roles,
    });

    const token = signToken(user);

    setAuthCookie(res, token);

    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    });
  } catch (e) {
    console.error("Signup error:", e);
    res.status(500).json({ error: "Signup failed" });
  }
});

// ======================
// POST /api/auth/login
// ======================
router.post("/login", async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ error: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
      return res.status(401).json({ error: "Invalid email or password" });

    const token = signToken(user);

    setAuthCookie(res, token);

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Login failed" });
  }
});

// ======================
// POST /api/auth/logout
// ======================

router.post("/logout", (req, res) => {
  clearAuthCookie(res);

  return res.status(200).json({
    message: "Logged out",
  });
});

// ======================
// GET /api/auth/me
// ======================

router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "name email roles storeName sellerProfile.avatar",
    );

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json({
      user,
    });
  } catch (error) {
    console.error("GET /api/auth/me failed:", error);

    return res.status(500).json({
      error: "Could not load session",
    });
  }
});

export default router;
