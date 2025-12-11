import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // multiple roles instead of single role
  roles: {
    type: [String],
    enum: ["seller", "buyer", "admin"],
    default: ["buyer"]  // or seller if you prefer
  },

  ngoXiPlan: {
  type: String,
  default: "free",
  enum: ["free", "standard"]
   }, 

  storeName: { type: String, default: "" },
  contact: { type: String, default: "" },
  paymentInfo: { type: Object, default: {} },
  address: { type: String, default: "" },
}, { timestamps: true });

export default mongoose.model("User", userSchema);


