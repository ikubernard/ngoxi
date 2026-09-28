import express from "express";
import mongoose from "mongoose";

import Chat from "../model/chatModel.js";
import User from "../model/User.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

function hasRole(user, role) {
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

function getMongoId(value) {
  if (!value) return "";

  return String(value._id || value.id || value);
}

function isParticipant(chat, userId) {
  const userIdString = getMongoId(userId);

  const buyerId = getMongoId(chat?.buyer);

  const sellerId = getMongoId(chat?.seller);

  return buyerId === userIdString || sellerId === userIdString;
}

/* =========================================================
   GET MY CONVERSATIONS

   GET /api/chats

   Seller:
   returns conversations where seller = logged-in user

   Buyer:
   returns conversations where buyer = logged-in user
========================================================= */

router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        error: "Not authorized",
      });
    }

    const requestedRole = String(req.query?.as || "")
      .trim()
      .toLowerCase();

    if (requestedRole !== "buyer" && requestedRole !== "seller") {
      return res.status(400).json({
        error: "Choose chat context with ?as=buyer or ?as=seller",
      });
    }

    if (!hasRole(req.user, requestedRole)) {
      return res.status(403).json({
        error: `${requestedRole} access required`,
      });
    }

    const query =
      requestedRole === "seller" ? { seller: userId } : { buyer: userId };

    const chats = await Chat.find(query)
      .populate("buyer", "name email")
      .populate("seller", "name storeName sellerProfile.avatar")
      .sort({
        lastMessageAt: -1,
      })
      .lean();

    return res.status(200).json({
      conversations: chats,
    });
  } catch (error) {
    console.error("❌ GET /api/chats failed:", error);

    return res.status(500).json({
      error: "Could not load conversations",
    });
  }
});
/* =========================================================
   START / FIND BUYER-SELLER CONVERSATION

   POST /api/chats/start

   Buyer sends only:
   {
     sellerId: "..."
   }

   Buyer identity comes from verifyToken.
========================================================= */

router.post("/start", verifyToken, async (req, res) => {
  try {
    const buyerId = req.user?._id;

    if (!buyerId) {
      return res.status(401).json({
        error: "Not authorized",
      });
    }

    if (!hasRole(req.user, "buyer")) {
      return res.status(403).json({
        error: "Only buyers can start seller conversations",
      });
    }

    const sellerId = String(req.body?.sellerId || "").trim();

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({
        error: "Invalid seller ID",
      });
    }

    if (String(buyerId) === sellerId) {
      return res.status(400).json({
        error: "You cannot start a conversation with yourself",
      });
    }

    const seller = await User.findById(sellerId).select(
      "name storeName roles sellerProfile",
    );

    if (!seller) {
      return res.status(404).json({
        error: "Seller not found",
      });
    }

    if (!hasRole(seller, "seller")) {
      return res.status(400).json({
        error: "Selected user is not a seller",
      });
    }

    let chat = await Chat.findOneAndUpdate(
      {
        buyer: buyerId,
        seller: sellerId,
      },

      {
        $setOnInsert: {
          buyer: buyerId,
          seller: sellerId,
          messages: [],
          lastMessageAt: new Date(),
        },
      },

      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    chat = await Chat.findById(chat._id)
      .populate("buyer", "name email")
      .populate(
        "seller",
        "name storeName sellerProfile.avatar sellerProfile.paymentMethods sellerProfile.pickupLocations sellerProfile.contact",
      );

    return res.status(200).json({
      conversation: chat,
    });
  } catch (error) {
    console.error("❌ POST /api/chats/start failed:", error);

    return res.status(500).json({
      error: "Could not start conversation",
    });
  }
});
/* =========================================================
   GET ONE CONVERSATION

   GET /api/chats/:conversationId
========================================================= */

router.get("/:conversationId", verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        error: "Invalid conversation ID",
      });
    }

    const chat = await Chat.findById(conversationId)
      .populate("buyer", "name email")
      .populate(
        "seller",
        "name storeName sellerProfile.avatar sellerProfile.paymentMethods sellerProfile.pickupLocations sellerProfile.contact",
      );

    if (!chat) {
      return res.status(404).json({
        error: "Conversation not found",
      });
    }

    if (!isParticipant(chat, req.user._id)) {
      return res.status(403).json({
        error: "You cannot access this conversation",
      });
    }

    return res.status(200).json({
      conversation: chat,
    });
  } catch (error) {
    console.error("❌ GET conversation failed:", error);

    return res.status(500).json({
      error: "Could not load conversation",
    });
  }
});

/* =========================================================
   SEND MESSAGE

   POST /api/chats/:conversationId/messages
========================================================= */

router.post("/:conversationId/messages", verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    const text = String(req.body?.text || "").trim();

    const image = String(req.body?.image || "").trim();

    if (!text && !image) {
      return res.status(400).json({
        error: "Message cannot be empty",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        error: "Invalid conversation ID",
      });
    }

    const chat = await Chat.findById(conversationId);

    if (!chat) {
      return res.status(404).json({
        error: "Conversation not found",
      });
    }

    if (!isParticipant(chat, req.user._id)) {
      return res.status(403).json({
        error: "You cannot send messages to this conversation",
      });
    }

    let senderRole;

    if (String(chat.seller) === String(req.user._id)) {
      senderRole = "seller";
    } else {
      senderRole = "buyer";
    }

    chat.messages.push({
      sender: req.user._id,
      senderRole,
      text,
      image,
      status: "sent",
    });

    chat.lastMessageAt = new Date();

    await chat.save();

    const message = chat.messages[chat.messages.length - 1];

    return res.status(201).json({
      message,
    });
  } catch (error) {
    console.error("❌ POST chat message failed:", error);

    return res.status(500).json({
      error: "Could not send message",
    });
  }
});
/* =========================================================
   DELETE MY MESSAGE

   DELETE /api/chats/:conversationId/messages/:messageId
========================================================= */

router.delete(
  "/:conversationId/messages/:messageId",
  verifyToken,
  async (req, res) => {
    try {
      const { conversationId, messageId } = req.params;
      const userId = req.user?._id;

      if (!userId) {
        return res.status(401).json({
          error: "Not authorized",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(conversationId) ||
        !mongoose.Types.ObjectId.isValid(messageId)
      ) {
        return res.status(400).json({
          error: "Invalid conversation or message ID",
        });
      }

      const chat = await Chat.findById(conversationId);

      if (!chat) {
        return res.status(404).json({
          error: "Conversation not found",
        });
      }

      if (!isParticipant(chat, userId)) {
        return res.status(403).json({
          error: "You cannot access this conversation",
        });
      }

      const message = chat.messages.id(messageId);

      if (!message) {
        return res.status(404).json({
          error: "Message not found",
        });
      }

      // Only the person who sent the message can delete it.
      if (String(message.sender) !== String(userId)) {
        return res.status(403).json({
          error: "You can only delete your own messages",
        });
      }

      message.deleteOne();

      // Recalculate conversation timestamp from newest remaining message.
      const newestMessage = chat.messages[chat.messages.length - 1];

      chat.lastMessageAt =
        newestMessage?.createdAt || chat.updatedAt || new Date();

      await chat.save();

      return res.status(200).json({
        success: true,
        messageId,
        conversationId,
      });
    } catch (error) {
      console.error("❌ DELETE chat message failed:", error);

      return res.status(500).json({
        error: "Could not delete message",
      });
    }
  },
);
router.patch(
  "/:conversationId/messages/:messageId",
  verifyToken,
  async (req, res) => {
    try {
      const { conversationId, messageId } = req.params;

      const text = String(req.body?.text || "").trim();

      if (!text) {
        return res.status(400).json({
          error: "Message cannot be empty",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(conversationId) ||
        !mongoose.Types.ObjectId.isValid(messageId)
      ) {
        return res.status(400).json({
          error: "Invalid conversation or message ID",
        });
      }

      const chat = await Chat.findById(conversationId);

      if (!chat) {
        return res.status(404).json({
          error: "Conversation not found",
        });
      }

      if (!isParticipant(chat, req.user._id)) {
        return res.status(403).json({
          error: "You cannot access this conversation",
        });
      }

      const message = chat.messages.id(messageId);

      if (!message) {
        return res.status(404).json({
          error: "Message not found",
        });
      }

      if (String(message.sender) !== String(req.user._id)) {
        return res.status(403).json({
          error: "You can only edit your own messages",
        });
      }
      const EDIT_WINDOW_MS = 15 * 60 * 1000;

      const createdAt = new Date(message.createdAt).getTime();

      if (!createdAt || Date.now() - createdAt > EDIT_WINDOW_MS) {
        return res.status(403).json({
          error: "This message can no longer be edited",
        });
      }
      message.text = text;

      await chat.save();

      return res.json({
        success: true,
        message,
      });
    } catch (error) {
      console.error("❌ Edit message failed:", error);

      return res.status(500).json({
        error: "Could not edit message",
      });
    }
  },
);
export default router;
