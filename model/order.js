import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productSnapshot: {
      name: String,
      image: String,

      variant: String,
      size: String,

      quantity: {
        type: Number,
        default: 1,
      },

      unitPrice: Number,
      totalPrice: Number,
    },

    status: {
      type: String,

      enum: [
        "placed",
        "awaiting-payment",
        "receipt-uploaded",
        "payment-confirmed",
        "preparing",
        "ready",
        "shipping",
        "delivered",
        "cancelled",
      ],

      default: "awaiting-payment",

      index: true,
    },

    payment: {
      status: {
        type: String,

        enum: ["waiting", "receipt-uploaded", "confirmed", "rejected"],

        default: "waiting",
      },

      methodId: mongoose.Schema.Types.ObjectId,

      receiptUrl: String,
      receiptPublicId: String,

      uploadedAt: Date,
      confirmedAt: Date,
    },

    delivery: {
      pickupLocationId: mongoose.Schema.Types.ObjectId,

      city: String,
      address: String,
      phone: String,

      receiverName: String,

      status: {
        type: String,
        default: "waiting",
      },
    },

    inbound: {
      chinaTrackingNumber: {
        type: String,
        trim: true,
        index: true,
      },

      chinaCarrier: String,

      supplier: String,

      status: {
        type: String,

        enum: [
          "not-set",
          "awaiting-supplier",
          "in-china",
          "exported",
          "arrived-tanzania",
          "scanned-tanzania",
          "sorted",
          "ready-for-delivery",
          "delivered",
        ],

        default: "not-set",
        index: true,
      },

      scannedAtTanzania: Date,

      scannedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      localLabelCode: {
        type: String,
        index: true,
      },
    },
  },
  {
    timestamps: true,
  },
);

orderSchema.index({
  seller: 1,
  "inbound.chinaTrackingNumber": 1,
});

export default mongoose.models.Order || mongoose.model("Order", orderSchema);
