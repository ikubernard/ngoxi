import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "" },
    // Product placement
    mode: {
      type: String,
      enum: ["standard", "mamba", "trendy", "group"],
      default: "standard",
      index: true,
    },

    // Discount information
    // price = final amount the buyer pays
    // originalPrice = price before discount
    originalPrice: {
      type: Number,
      default: null,
    },

    discountPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // ✅ cover image (primary display image)
    cover: {
      url: { type: String, required: false },
      public_id: { type: String, required: false },
    },

    // ✅ gallery images (multiple)
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
      },
    ],

    // ✅ variants e.g. red|1000
    variants: [
      {
        name: {
          type: String,
          required: true,
        },

        priceDiff: {
          type: Number,
          default: 0,
        },

        image: {
          url: String,
          public_id: String,
        },
      },
    ],

    // ✅ size with price difference
    sizes: [
      {
        label: { type: String },
        priceDiff: { type: Number, default: 0 },
      },
    ],

    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    deliveryTime: { type: String, default: "pickup" },

    visibility: {
      type: String,
      enum: ["visible", "hidden"],
      default: "visible",
    },
  },
  { timestamps: true },
);

export default mongoose.models.Product ||
  mongoose.model("Product", productSchema);
