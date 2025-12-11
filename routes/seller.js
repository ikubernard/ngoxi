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

// Public seller store view
router.get("/:id", async (req, res) => {
  try {
    const seller = await User.findById(req.params.id).select("-password");
    if (!seller) return res.status(404).json({ error: "Seller not found" });
    const products = await Product.find({ sellerId: seller._id }).sort({ createdAt: -1 });
    return res.status(200).json({ seller, products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load seller store" });
  }
});

export default router;
