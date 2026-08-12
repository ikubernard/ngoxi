import express from "express";
import Product from "../model/product.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import cloudinary from "../Utils/cloudinary.js";
import { upload } from "../Utils/multer.js";

const router = express.Router();

/* HELPER FUNCTIONS */
function ensureSellerOwnership(req, product) {
  if (!req?.user?._id) return false;
  return String(product.sellerId) === String(req.user._id) || isAdmin(req);
}
function isAdmin(req) {
  return req?.user?.role === "admin";
}
function uploadBufferToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

/* =========================================================
   POST /api/products/add  (Create product)
   ========================================================= */
router.post(
  "/add",
  verifyToken,
  upload.fields([
    { name: "cover", maxCount: 1 },
    { name: "gallery", maxCount: 8 },
    { name: "variantImages", maxCount: 12 },
  ]),
  async (req, res) => {
    try {
      const ownerId = req.user?._id;
      if (!ownerId)
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });

      const {
        name,
        price,
        description,
        category,
        mode,
        discountPercent,
        deliveryTime,
        variants,
        sizes,
      } = req.body;
      if (!name || !price || !description)
        return res
          .status(400)
          .json({ success: false, message: "Missing required fields" });

      if (!req.files?.cover?.[0])
        return res
          .status(400)
          .json({ success: false, message: "Cover image is required" });
      // Categories must use the exact same values as the buyer homepage
      const allowedCategories = new Set([
        "fashion",
        "electronics",
        "beauty",
        "home",
        "phones",
        "computers",
        "shoes",
        "bags",
        "sports",
        "automotive",
        "food",
        "baby",
        "health",
        "gaming",
        "accessories",
      ]);

      const normalizedCategory = String(category || "")
        .trim()
        .toLowerCase();

      if (!allowedCategories.has(normalizedCategory)) {
        return res.status(400).json({
          success: false,
          message: "Please select a valid product category",
        });
      }

      // Product modes
      const allowedModes = new Set(["standard", "mamba", "trendy", "group"]);

      const normalizedMode = String(mode || "standard")
        .trim()
        .toLowerCase();

      if (!allowedModes.has(normalizedMode)) {
        return res.status(400).json({
          success: false,
          message: "Please select a valid product mode",
        });
      }

      // Calculate the real selling price on the server
      const originalPrice = Number(price);
      const normalizedDiscount = Number(discountPercent || 0);

      if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid product price",
        });
      }

      if (
        !Number.isFinite(normalizedDiscount) ||
        normalizedDiscount < 0 ||
        normalizedDiscount > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Discount must be between 0 and 100 percent",
        });
      }

      const finalPrice = Math.round(
        originalPrice * (1 - normalizedDiscount / 100),
      );
      // upload cover
      let cover = null;
      try {
        const c = await uploadBufferToCloudinary(req.files.cover[0].buffer, {
          folder: "ngoxi/products/cover",
          resource_type: "image",
          transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
        });
        cover = { url: c.secure_url, public_id: c.public_id };
      } catch (err) {
        console.error("❌ Cover upload failed:", err);
        return res
          .status(500)
          .json({ success: false, message: "Cover upload failed" });
      }

      // upload gallery
      const images = [];
      if (req.files?.gallery?.length) {
        for (const file of req.files.gallery) {
          try {
            const g = await uploadBufferToCloudinary(file.buffer, {
              folder: "ngoxi/products/gallery",
              resource_type: "image",
              transformation: [
                { quality: "auto:good" },
                { fetch_format: "auto" },
              ],
            });
            images.push({ url: g.secure_url, public_id: g.public_id });
          } catch (err) {
            console.error("❌ Gallery upload failed:", err);
          }
        }
      }

      let variantArr = [];
      let sizeArr = [];

      try {
        variantArr = variants ? JSON.parse(variants) : [];

        sizeArr = sizes ? JSON.parse(sizes) : [];
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid variants or sizes data",
        });
      }

      /* Upload variant images */

      const uploadedVariantImages = [];
      const variantFiles = req.files?.variantImages || [];

      console.log("✅ Variant image files received:", variantFiles.length);

      for (const file of variantFiles) {
        try {
          const uploaded = await uploadBufferToCloudinary(file.buffer, {
            folder: "ngoxi/products/variants",
            resource_type: "image",

            transformation: [
              {
                quality: "auto:good",
              },
              {
                fetch_format: "auto",
              },
            ],
          });

          uploadedVariantImages.push({
            url: uploaded.secure_url,
            public_id: uploaded.public_id,
          });
        } catch (error) {
          console.error("❌ Variant image upload failed:", error);

          uploadedVariantImages.push(null);
        }
      }

      /* Connect each image to its variant */

      variantArr = variantArr
        .map((variant, variantPosition) => {
          let imageIndex = variantPosition;

          if (
            variant.imageIndex !== null &&
            variant.imageIndex !== undefined &&
            variant.imageIndex !== "" &&
            Number.isInteger(Number(variant.imageIndex))
          ) {
            imageIndex = Number(variant.imageIndex);
          }

          const variantImage =
            uploadedVariantImages[imageIndex] ||
            uploadedVariantImages[variantPosition] ||
            undefined;

          return {
            name: String(variant.name || "").trim(),

            priceDiff: Number(variant.priceDiff || 0),

            image: variantImage,
          };
        })
        .filter((variant) => variant.name);

      /* Clean size information */

      sizeArr = sizeArr
        .map((size) => ({
          label: String(size.label || "").trim(),

          priceDiff: Number(size.priceDiff || 0),
        }))
        .filter((size) => size.label);

      /* Save complete product */
      const product = await Product.create({
        name,

        // Final amount paid by the buyer
        price: finalPrice,

        // Used for the crossed-out price on discounted product cards
        originalPrice: normalizedDiscount > 0 ? originalPrice : null,

        discountPercent: normalizedDiscount,

        description,
        category: normalizedCategory,
        mode: normalizedMode,
        deliveryTime,
        sellerId: ownerId,

        variants: variantArr,
        sizes: sizeArr,

        cover,
        images,
        visibility: "visible",
      });

      return res.status(201).json({ success: true, product });
    } catch (err) {
      console.error("❌ Internal product creation error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

/* =========================================================
   GET /api/products (Paginated, only visible)
   ========================================================= */
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {
      visibility: "visible",
      blockedByAdmin: { $ne: true },
    };

    if (req.query.mode) {
      query.mode = req.query.mode;
    }
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      products,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("❌ Paginated fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================================================
   GET /api/products/:id (Public)
   ========================================================= */
router.get("/:id", async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Product not found" });
    if (p.visibility === "hidden" || p.blockedByAdmin)
      return res.status(404).json({ message: "Product not available" });
    res.json(p);
  } catch {
    res.status(500).json({ message: "Error fetching product" });
  }
});
/* =========================================================
   OWNER ROUTES: hide/unhide + delete
   ========================================================= */

// PATCH /api/products/:id/visibility  (hide / unhide a product)
router.patch("/:id/visibility", verifyToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if (!ensureSellerOwnership(req, product)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    // toggle visibility
    product.visibility = product.visibility === "hidden" ? "visible" : "hidden";
    await product.save();

    return res.json({
      success: true,
      hidden: product.visibility === "hidden",
      visibility: product.visibility,
    });
  } catch (err) {
    console.error("❌ Toggle visibility error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE /api/products/:id  (permanent delete for owner / admin)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if (!ensureSellerOwnership(req, product)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    // TODO later: delete product.cover / product.images from Cloudinary
    await Product.deleteOne({ _id: product._id });

    return res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    console.error("❌ Delete product error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
