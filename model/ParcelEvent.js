import mongoose from "mongoose";

const parcelEventSchema = new mongoose.Schema(
  {
    parcel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parcel",
      required: true,
      index: true,
    },

    station: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      default: null,
    },

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "registered",
        "received",
        "label-printed",
        "dispatched",
        "arrived",
        "sorted",
        "ready-for-pickup",
        "out-for-delivery",
        "delivered",
        "exception",
      ],
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

parcelEventSchema.index({
  parcel: 1,
  createdAt: -1,
});

export default mongoose.models.ParcelEvent ||
  mongoose.model("ParcelEvent", parcelEventSchema);
