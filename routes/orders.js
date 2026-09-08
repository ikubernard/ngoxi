import express from "express";
import mongoose from "mongoose";

import Order from "../model/order.js";
import Product from "../model/product.js";
import Chat from "../model/chatModel.js";

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

function validId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

/*
  Convert an Order document into something both
  buyer and seller frontends can consume easily.
*/
function normalizeOrder(order) {
  const raw = typeof order?.toObject === "function" ? order.toObject() : order;

  const seller = raw?.seller || {};

  return {
    ...raw,

    id: String(raw?._id || ""),

    productName: raw?.productSnapshot?.name || raw?.product?.name || "Product",

    productImage: raw?.productSnapshot?.image || raw?.product?.cover?.url || "",

    variant: raw?.productSnapshot?.variant || "",

    size: raw?.productSnapshot?.size || "",

    quantity: Number(raw?.productSnapshot?.quantity || 1),

    price: Number(raw?.productSnapshot?.totalPrice || 0),

    orderStatus: raw?.status || "awaiting-payment",

    paymentMethods: Array.isArray(seller?.sellerProfile?.paymentMethods)
      ? seller.sellerProfile.paymentMethods.filter(
          (method) => method?.active !== false,
        )
      : [],
  };
}

/* =========================================================
   CREATE ORDER
   POST /api/orders

   Buyer sends:
   {
     conversationId,
     productId,
     variant,
     size,
     quantity,
     delivery: {
       city,
       address,
       phone,
       receiverName
     }
   }

   IMPORTANT:
   buyer, seller and price are NOT trusted from browser.
========================================================= */

router.post("/", verifyToken, async (req, res) => {
  try {
    const buyerId = req.user?._id;

    if (!buyerId) {
      return res.status(401).json({
        error: "Not authorized",
      });
    }

    if (!hasRole(req.user, "buyer")) {
      return res.status(403).json({
        error: "Buyer access required",
      });
    }

    const conversationId = String(req.body?.conversationId || "").trim();

    const productId = String(req.body?.productId || "").trim();

    if (!validId(conversationId)) {
      return res.status(400).json({
        error: "Invalid conversation ID",
      });
    }

    if (!validId(productId)) {
      return res.status(400).json({
        error: "Invalid product ID",
      });
    }

    const [conversation, product] = await Promise.all([
      Chat.findById(conversationId),

      Product.findById(productId),
    ]);

    if (!conversation) {
      return res.status(404).json({
        error: "Conversation not found",
      });
    }

    if (!product) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    /*
        Buyer must actually own this conversation.
      */

    if (getMongoId(conversation.buyer) !== getMongoId(buyerId)) {
      return res.status(403).json({
        error: "This conversation does not belong to you",
      });
    }

    const sellerId = getMongoId(conversation.seller);

    /*
        Product seller must be exactly the
        seller in this conversation.
      */

    const productSellerId = getMongoId(product.sellerId || product.seller);

    if (!sellerId || productSellerId !== sellerId) {
      return res.status(400).json({
        error: "Product and conversation seller do not match",
      });
    }

    /* -------------------------
         QUANTITY
      ------------------------- */

    const quantity = Math.max(
      1,
      Math.min(99, Number(req.body?.quantity || 1) || 1),
    );

    /* -------------------------
         VARIANT
      ------------------------- */

    const requestedVariant = String(req.body?.variant || "").trim();

    let variantName = "";
    let variantPriceDiff = 0;

    if (requestedVariant) {
      const variant = Array.isArray(product.variants)
        ? product.variants.find(
            (item) => String(item?.name || "") === requestedVariant,
          )
        : null;

      if (!variant) {
        return res.status(400).json({
          error: "Invalid product variant",
        });
      }

      variantName = variant.name || "";

      variantPriceDiff = Number(variant.priceDiff || 0);
    }

    /* -------------------------
         SIZE
      ------------------------- */

    const requestedSize = String(req.body?.size || "").trim();

    let sizeName = "";
    let sizePriceDiff = 0;

    if (requestedSize) {
      const size = Array.isArray(product.sizes)
        ? product.sizes.find(
            (item) => String(item?.label || item?.name || "") === requestedSize,
          )
        : null;

      if (!size) {
        return res.status(400).json({
          error: "Invalid product size",
        });
      }

      sizeName = size.label || size.name || "";

      sizePriceDiff = Number(size.priceDiff || 0);
    }

    /* -------------------------
         SERVER-COMPUTED PRICE

         Never accept price from browser.
      ------------------------- */

    const basePrice = Number(product.price || 0);

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      return res.status(500).json({
        error: "Product has invalid price",
      });
    }

    const unitPrice = basePrice + variantPriceDiff + sizePriceDiff;

    const totalPrice = unitPrice * quantity;

    /* -------------------------
         PRODUCT IMAGE SNAPSHOT
      ------------------------- */

    const productImage =
      product?.cover?.url ||
      product?.coverImage?.url ||
      product?.images?.[0]?.url ||
      "";

    /* -------------------------
         DELIVERY
      ------------------------- */

    const delivery =
      req.body?.delivery && typeof req.body.delivery === "object"
        ? req.body.delivery
        : {};

    /* -------------------------
         CREATE DATABASE ORDER
      ------------------------- */

    let order = await Order.create({
      buyer: buyerId,

      seller: sellerId,

      conversation: conversation._id,

      product: product._id,

      productSnapshot: {
        name: product.name || "Product",

        image: productImage,

        variant: variantName,

        size: sizeName,

        quantity,

        unitPrice,

        totalPrice,
      },

      status: "awaiting-payment",

      payment: {
        status: "waiting",
      },

      delivery: {
        city: String(delivery.city || "").trim(),

        address: String(delivery.address || "").trim(),

        phone: String(delivery.phone || "").trim(),

        receiverName: String(delivery.receiverName || "").trim(),

        status: "waiting",
      },
    });

    /*
        Populate information needed by the
        transaction interfaces.
      */

    order = await Order.findById(order._id)
      .populate("buyer", "name email buyerProfile")
      .populate("seller", "name storeName sellerProfile")
      .populate("product", "name cover");

    return res.status(201).json({
      order: normalizeOrder(order),
    });
  } catch (error) {
    console.error("❌ POST /api/orders failed:", error);

    return res.status(500).json({
      error: "Could not create order",
    });
  }
});

/* =========================================================
   LIST MY ORDERS

   GET /api/orders?as=buyer
   GET /api/orders?as=seller
========================================================= */

router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        error: "Not authorized",
      });
    }

    const context = String(req.query?.as || "")
      .trim()
      .toLowerCase();

    if (context !== "buyer" && context !== "seller") {
      return res.status(400).json({
        error: "Choose order context with ?as=buyer or ?as=seller",
      });
    }

    if (!hasRole(req.user, context)) {
      return res.status(403).json({
        error: `${context} access required`,
      });
    }

    const query =
      context === "buyer"
        ? {
            buyer: userId,
          }
        : {
            seller: userId,
          };

    const orders = await Order.find(query)
      .populate("buyer", "name email buyerProfile")
      .populate("seller", "name storeName sellerProfile")
      .populate("product", "name cover")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      orders: orders.map(normalizeOrder),
    });
  } catch (error) {
    console.error("❌ GET /api/orders failed:", error);

    return res.status(500).json({
      error: "Could not load orders",
    });
  }
});

/* =========================================================
   GET ONE ORDER

   GET /api/orders/:orderId

   Only the buyer or seller attached to it can read it.
========================================================= */

router.get("/:orderId", verifyToken, async (req, res) => {
  try {
    const userId = req.user?._id;

    const orderId = String(req.params?.orderId || "");

    if (!userId) {
      return res.status(401).json({
        error: "Not authorized",
      });
    }

    if (!validId(orderId)) {
      return res.status(400).json({
        error: "Invalid order ID",
      });
    }

    const order = await Order.findById(orderId)
      .populate("buyer", "name email buyerProfile")
      .populate("seller", "name storeName sellerProfile")
      .populate("product", "name cover");

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    const participant =
      getMongoId(order.buyer) === getMongoId(userId) ||
      getMongoId(order.seller) === getMongoId(userId);

    if (!participant) {
      return res.status(403).json({
        error: "You cannot access this order",
      });
    }

    return res.status(200).json({
      order: normalizeOrder(order),
    });
  } catch (error) {
    console.error("❌ GET order failed:", error);

    return res.status(500).json({
      error: "Could not load order",
    });
  }
});

export default router;
