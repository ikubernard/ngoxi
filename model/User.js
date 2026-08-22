import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // multiple roles instead of single role
    roles: {
      type: [String],
      enum: ["seller", "buyer", "admin"],
      default: ["buyer"], // or seller if you prefer
    },

    ngoXiPlan: {
      type: String,
      default: "free",
      enum: ["free", "standard"],
    },

    storeName: {
      type: String,
      default: "",
      trim: true,
    },

    sellerProfile: {
      avatar: {
        url: {
          type: String,
          default: "",
        },

        publicId: {
          type: String,
          default: "",
        },
      },

      contact: {
        phone: {
          type: String,
          default: "",
          trim: true,
        },

        whatsapp: {
          type: String,
          default: "",
          trim: true,
        },
      },

      paymentMethods: [
        {
          type: {
            type: String,
            enum: [
              "bank",
              "mpesa",
              "airtel-money",
              "halopesa",
              "tigo-pesa",
              "lipa-namba",
              "other",
            ],
            required: true,
          },

          provider: {
            type: String,
            default: "",
          },

          label: {
            type: String,
            default: "",
          },

          accountName: {
            type: String,
            default: "",
          },

          number: {
            type: String,
            required: true,
          },

          note: {
            type: String,
            default: "",
          },

          active: {
            type: Boolean,
            default: true,
          },
        },
      ],

      pickupLocations: [
        {
          name: {
            type: String,
            required: true,
          },

          city: {
            type: String,
            default: "",
          },

          address: {
            type: String,
            default: "",
          },

          latitude: Number,
          longitude: Number,

          active: {
            type: Boolean,
            default: true,
          },
        },
      ],
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
