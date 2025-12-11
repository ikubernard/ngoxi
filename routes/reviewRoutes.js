import express from "express";
import Review from "../model/reviewModel.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { product } = req.query;
    const reviews = await Review.find(product ? { product } : {}).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: "Error fetching reviews" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { product, userName, rating, comment } = req.body;
    if (!product || !userName || !rating || !comment)
      return res.status(400).json({ message: "Missing fields" });
    const review = await Review.create({ product, userName, rating, comment });
    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ message: "Error adding review" });
  }
});

export default router;
