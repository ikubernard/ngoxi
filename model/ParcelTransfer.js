import mongoose from "mongoose";

const parcelTransferSchema = new mongoose.Schema(
  {
    parcel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parcel",
      required: true,
      index: true,
    },

    fromStation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      required: true,
    },

    toStation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "in-transit", "received", "exception"],
      default: "pending",
    },

    dispatchedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    dispatchedAt: Date,

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    receivedAt: Date,

    transport: {
      company: { type: String, default: "" },
      vehiclePlate: { type: String, default: "" },
      driverName: { type: String, default: "" },
      reference: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

// Only one unfinished transfer per parcel.
parcelTransferSchema.index(
  { parcel: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "in-transit"] },
    },
  },
);

export default mongoose.models.ParcelTransfer ||
  mongoose.model("ParcelTransfer", parcelTransferSchema);
