import express from "express";
import Chat from "../model/chatModel.js";

const router = express.Router();

// Get chat by buyer/seller/product
router.get("/", async (req, res) => {
  const { buyer, seller, product } = req.query;
  const chat = await Chat.findOne({ buyer, seller, product });
  if (!chat) return res.json([]);
  res.json(chat.messages);
});

// Post new message
router.post("/", async (req, res) => {
  const { buyer, seller, product, sender, text } = req.body;
  if (!text) return res.status(400).json({ message: "Empty message" });

  let chat = await Chat.findOne({ buyer, seller, product });
  if (!chat) chat = await Chat.create({ buyer, seller, product, messages: [] });
  chat.messages.push({ sender, text });
  await chat.save();
  res.json(chat.messages);
});

export default router;
