import express from "express";
import User from "../model/User.js";
import Product from "../model/product.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Seller's own products (JWT only)
router.get("/my-products", verifyToken, async (req, res) => {
  try {
    const sellerId = req.user?._id;
    if (!sellerId) return res.status(401).json({ error: "Not authorized" });

    if (req.query.countOnly === "1") {
      const count = await Product.countDocuments({ sellerId });
      return res.json({ plan: "free", count }); // plug actual plan later
    }

    const products = await Product.find({ sellerId }).sort({ createdAt: -1 });
    return res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load seller products" });
  }
});

/* =========================================================
   GET MY SELLER PROFILE

   GET /api/seller/profile
========================================================= */

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const sellerId = req.user?._id;

    if (!sellerId) {
      return res.status(401).json({
        error: "Not authorized",
      });
    }

    const seller = await User.findById(sellerId).select(
      "name email roles storeName sellerProfile ngoXiPlan",
    );

    if (!seller) {
      return res.status(404).json({
        error: "Seller not found",
      });
    }

    if (!Array.isArray(seller.roles) || !seller.roles.includes("seller")) {
      return res.status(403).json({
        error: "Seller access required",
      });
    }

    return res.status(200).json({
      seller,
    });
  } catch (error) {
    console.error("❌ GET /api/seller/profile failed:", error);

    return res.status(500).json({
      error: "Could not load seller profile",
    });
  }
});

/* =========================================================
   UPDATE MY SELLER PROFILE

   PATCH /api/seller/profile

   Only whitelisted profile fields can be changed here.
========================================================= */

router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const sellerId = req.user?._id;

    if (!sellerId) {
      return res.status(401).json({
        error: "Not authorized",
      });
    }

    const seller = await User.findById(sellerId);

    if (!seller) {
      return res.status(404).json({
        error: "Seller not found",
      });
    }

    if (!Array.isArray(seller.roles) || !seller.roles.includes("seller")) {
      return res.status(403).json({
        error: "Seller access required",
      });
    }

    const body = req.body || {};

    /* =====================================================
       BASIC SELLER INFORMATION
    ===================================================== */

    if (typeof body.storeName === "string") {
      seller.storeName = body.storeName.trim();
    }

    if (typeof body.name === "string") {
      seller.name = body.name.trim();
    }

    if (typeof body.email === "string") {
      seller.email = body.email.trim().toLowerCase();
    }

    /* =====================================================
       MAKE SURE sellerProfile EXISTS
    ===================================================== */

    if (!seller.sellerProfile) {
      seller.sellerProfile = {};
    }

    if (!seller.sellerProfile.contact) {
      seller.sellerProfile.contact = {};
    }

    /* =====================================================
       CONTACT
    ===================================================== */

    if (typeof body.phone === "string") {
      seller.sellerProfile.contact.phone = body.phone.trim();
    }

    if (typeof body.whatsapp === "string") {
      seller.sellerProfile.contact.whatsapp = body.whatsapp.trim();
    }

    /* =====================================================
       TEXT ADDRESS

       For now we store this inside pickupLocations[0].
       No map required.
    ===================================================== */

    if (typeof body.address === "string") {
      const address = body.address.trim();

      if (!Array.isArray(seller.sellerProfile.pickupLocations)) {
        seller.sellerProfile.pickupLocations = [];
      }

      if (!seller.sellerProfile.pickupLocations.length) {
        seller.sellerProfile.pickupLocations.push({
          name: "Main pickup location",
          address,
          active: true,
        });
      } else {
        seller.sellerProfile.pickupLocations[0].address = address;

        if (!seller.sellerProfile.pickupLocations[0].name) {
          seller.sellerProfile.pickupLocations[0].name = "Main pickup location";
        }

        seller.sellerProfile.pickupLocations[0].active = true;
      }
    }

    /* =====================================================
       MULTIPLE PAYMENT METHODS
    ===================================================== */

    if (Array.isArray(body.paymentMethods)) {
      const cleanedPaymentMethods = body.paymentMethods
        .map((method) => {
          const type = String(method?.type || "").trim();

          const provider = String(method?.provider || "").trim();

          const accountName = String(method?.accountName || "").trim();

          const number = String(
            method?.number || method?.accountNumber || "",
          ).trim();

          const note = String(
            method?.note || method?.instructions || "",
          ).trim();

          const allowedTypes = [
            "bank",
            "mpesa",
            "airtel-money",
            "halopesa",
            "tigo-pesa",
            "lipa-namba",
            "other",
          ];

          if (!allowedTypes.includes(type)) {
            return null;
          }

          if (!number) {
            return null;
          }

          return {
            type,
            provider,
            label: String(method?.label || provider || "").trim(),

            accountName,
            number,
            note,

            active: method?.active === false ? false : true,
          };
        })
        .filter(Boolean);

      seller.sellerProfile.paymentMethods = cleanedPaymentMethods;
    }

    await seller.save();

    const updatedSeller = await User.findById(sellerId).select(
      "name email roles storeName sellerProfile ngoXiPlan",
    );

    return res.status(200).json({
      seller: updatedSeller,
    });
  } catch (error) {
    console.error("❌ PATCH /api/seller/profile failed:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        error: "That email is already being used",
      });
    }

    return res.status(500).json({
      error: "Could not save seller profile",
    });
  }
});

// Public seller store view
router.get("/:id", async (req, res) => {
  try {
    const seller = await User.findById(req.params.id).select("-password");
    if (!seller) return res.status(404).json({ error: "Seller not found" });
    const products = await Product.find({ sellerId: seller._id }).sort({
      createdAt: -1,
    });
    return res.status(200).json({ seller, products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load seller store" });
  }
});

export default router;
