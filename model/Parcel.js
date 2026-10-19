import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const parcelSchema = new mongoose.Schema(
  {
    // Permanent NgoXi parcel identifier
    trackingCode: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: () =>
        `NGX-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    // Original Chinese tracking information
    chinaTrackingNumber: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },

    chinaCarrier: {
      type: String,
      trim: true,
      default: "",
    },

    // Current location
    currentStation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      default: null,
    },

    // Final destination
    destinationStation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "registered",
        "in-china",
        "arrived-dar",
        "received-at-station",
        "in-transit",
        "arrived-destination",
        "ready-for-pickup",
        "out-for-delivery",
        "delivered",
        "exception",
      ],
      default: "registered",
      index: true,
    },

    // Current receiving/transfer details
    lastScannedAt: Date,

    lastScannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Label information
    label: {
      printedAt: Date,
      printedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      printCount: {
        type: Number,
        default: 0,
      },
    },

    // Final delivery confirmation
    deliveredAt: Date,

    deliveredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

parcelSchema.index({
  destinationStation: 1,
  status: 1,
});

export default mongoose.models.Parcel || mongoose.model("Parcel", parcelSchema);
