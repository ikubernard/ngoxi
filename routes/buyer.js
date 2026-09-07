import express from "express";

import User from "../model/User.js";

import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================================
   GET MY BUYER PROFILE

   GET /api/buyer/profile
========================================================= */

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const buyerId = req.user?._id;

    if (!buyerId) {
      return res.status(401).json({
        error: "Not authorized",
      });
    }

    const buyer = await User.findById(buyerId).select(
      "name email roles buyerProfile",
    );

    if (!buyer) {
      return res.status(404).json({
        error: "Buyer not found",
      });
    }

    if (!Array.isArray(buyer.roles) || !buyer.roles.includes("buyer")) {
      return res.status(403).json({
        error: "Buyer access required",
      });
    }

    return res.status(200).json({
      buyer,
    });
  } catch (error) {
    console.error("GET /api/buyer/profile failed:", error);

    return res.status(500).json({
      error: "Could not load buyer profile",
    });
  }
});

/* =========================================================
   UPDATE MY BUYER PROFILE

   PATCH /api/buyer/profile
========================================================= */

router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const buyerId = req.user?._id;

    if (!buyerId) {
      return res.status(401).json({
        error: "Not authorized",
      });
    }

    const buyer = await User.findById(buyerId);

    if (!buyer) {
      return res.status(404).json({
        error: "Buyer not found",
      });
    }

    if (!Array.isArray(buyer.roles) || !buyer.roles.includes("buyer")) {
      return res.status(403).json({
        error: "Buyer access required",
      });
    }

    const body = req.body || {};

    /* -------------------------
         ACCOUNT INFORMATION
      ------------------------- */

    if (typeof body.name === "string") {
      const name = body.name.trim();

      if (name) {
        buyer.name = name;
      }
    }

    /* -------------------------
         MAKE PROFILE EXIST
      ------------------------- */

    if (!buyer.buyerProfile) {
      buyer.buyerProfile = {};
    }

    if (!buyer.buyerProfile.contact) {
      buyer.buyerProfile.contact = {};
    }

    if (!buyer.buyerProfile.delivery) {
      buyer.buyerProfile.delivery = {};
    }

    /* -------------------------
         CONTACT
      ------------------------- */

    if (typeof body.phone === "string") {
      buyer.buyerProfile.contact.phone = body.phone.trim();
    }

    /* -------------------------
         DELIVERY
      ------------------------- */

    if (typeof body.city === "string") {
      buyer.buyerProfile.delivery.city = body.city.trim();
    }

    if (typeof body.address === "string") {
      buyer.buyerProfile.delivery.address = body.address.trim();
    }

    if (typeof body.receiverName === "string") {
      buyer.buyerProfile.delivery.receiverName = body.receiverName.trim();
    }

    if (typeof body.receiverPhone === "string") {
      buyer.buyerProfile.delivery.receiverPhone = body.receiverPhone.trim();
    }

    await buyer.save();

    const safeBuyer = await User.findById(buyer._id).select(
      "name email roles buyerProfile",
    );

    return res.status(200).json({
      buyer: safeBuyer,
    });
  } catch (error) {
    console.error("PATCH /api/buyer/profile failed:", error);

    return res.status(500).json({
      error: "Could not save buyer profile",
    });
  }
});

export default router;
