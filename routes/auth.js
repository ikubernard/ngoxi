import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../model/User.js";

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id, roles: user.roles, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

// ======================
// POST /api/auth/signup
// ======================
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role = "buyer", adminCode } = req.body;

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
      return res.json({
        merged: true,
        message: "Role merged",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles,
        },
        token,
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
    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
      token,
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
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ error: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
      return res.status(401).json({ error: "Invalid email or password" });

    const token = signToken(user);
    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
      token,
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
