(() => {
  "use strict";

  const API_BASE = window.API_BASE || window.location.origin;

  const PLACEHOLDER =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="900" height="900">
        <rect width="100%" height="100%" fill="#eef3f0"/>
        <text
          x="50%"
          y="50%"
          text-anchor="middle"
          dominant-baseline="middle"
          fill="#688076"
          font-family="Arial"
          font-size="42">
          NgoXi Product
        </text>
      </svg>
    `);

  const $ = (selector) => document.querySelector(selector);
  const params = new URLSearchParams(window.location.search);

  const state = {
    product: null,
    images: [],
    activeImage: 0,
    variant: null,
    size: null,
    quantity: 1,
  };

  const els = {
    loading: $("#loadingState"),
    error: $("#errorState"),
    errorMessage: $("#errorMessage"),
    page: $("#productPage"),
    buyBar: $("#buyBar"),

    mainImage: $("#mainImage"),
    imageCount: $("#imageCount"),
    thumbs: $("#thumbnailGallery"),

    name: $("#productName"),
    category: $("#category"),
    modeBadge: $("#modeBadge"),
    rating: $("#ratingText"),
    price: $("#productPrice"),
    description: $("#description"),
    delivery: $("#deliveryInfo"),

    sellerName: $("#sellerName"),
    sellerAvatar: $("#sellerAvatar"),
    visitStore: $("#visitStoreBtn"),

    stickyTotal: $("#stickyTotal"),
    favorite: $("#favoriteBtn"),

    overlay: $("#selectionOverlay"),
    sheet: $("#selectionSheet"),
    closeSheet: $("#closeSheet"),

    sheetImage: $("#sheetImage"),
    sheetName: $("#sheetName"),
    sheetUnitPrice: $("#sheetUnitPrice"),

    variantSection: $("#variantSection"),
    variantChoices: $("#variantChoices"),

    sizeSection: $("#sizeSection"),
    sizeChoices: $("#sizeChoices"),

    minus: $("#minusQty"),
    plus: $("#plusQty"),
    quantity: $("#quantity"),
    sheetTotal: $("#sheetTotal"),
    continueButton: $("#continueButton"),
  };

  function money(value) {
    return `TSh ${Number(value || 0).toLocaleString("en-US")}`;
  }

  function safeNumber(value) {
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : 0;
  }

  function imageUrl(value) {
    if (typeof value === "string") return value;
    return value?.url || "";
  }

  function sellerObject() {
    if (typeof state.product?.sellerId === "object") {
      return state.product.sellerId;
    }

    return null;
  }

  function getSellerId() {
    return sellerObject()?._id || state.product?.sellerId || "";
  }

  function getVariantImage(variant) {
    return imageUrl(variant?.image);
  }

  function getSelectedSize() {
    if (!state.size) return null;

    if (typeof state.size === "string") {
      return {
        label: state.size,
        priceDiff: 0,
      };
    }

    return state.size;
  }

  function unitPrice() {
    const basePrice = safeNumber(state.product?.price);
    const variantDifference = safeNumber(state.variant?.priceDiff);
    const sizeDifference = safeNumber(getSelectedSize()?.priceDiff);

    return basePrice + variantDifference + sizeDifference;
  }

  function orderTotal() {
    return unitPrice() * state.quantity;
  }

  function collectImages(product) {
    const urls = [];

    urls.push(imageUrl(product.cover));

    if (Array.isArray(product.images)) {
      product.images.forEach((image) => {
        urls.push(imageUrl(image));
      });
    }

    if (Array.isArray(product.variants)) {
      product.variants.forEach((variant) => {
        urls.push(getVariantImage(variant));
      });
    }

    return [...new Set(urls.filter(Boolean))];
  }

  async function loadProduct() {
    const id = params.get("id");

    if (!id) {
      throw new Error("The product link is missing its product ID.");
    }

    const response = await fetch(
      `${API_BASE}/api/products/${encodeURIComponent(id)}`,
      {
        credentials: "include",
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "This product is unavailable.");
    }

    state.product = data.product || data;
    state.images = collectImages(state.product);
    state.variant = null;
    state.size = null;
  }

  function renderGallery() {
    if (!state.images.length) {
      state.images = [PLACEHOLDER];
    }

    const currentImage = state.images[state.activeImage] || state.images[0];

    els.mainImage.src = currentImage;
    els.mainImage.alt = state.product.name || "Product";

    els.imageCount.textContent =
      state.images.length > 1
        ? `${state.activeImage + 1} / ${state.images.length}`
        : "";

    els.thumbs.innerHTML = "";

    if (state.images.length < 2) return;

    state.images.forEach((url, index) => {
      const thumbnail = document.createElement("img");

      thumbnail.className =
        index === state.activeImage ? "thumb active" : "thumb";

      thumbnail.src = url;
      thumbnail.alt = `${state.product.name || "Product"} image ${index + 1}`;

      thumbnail.addEventListener("click", () => {
        state.activeImage = index;
        renderGallery();
      });

      els.thumbs.appendChild(thumbnail);
    });
  }

  function showVariantImage(variant) {
    const url = getVariantImage(variant);

    if (!url) return;

    const index = state.images.indexOf(url);

    if (index >= 0) {
      state.activeImage = index;
      renderGallery();
    }
  }

  function deliveryText(value) {
    const key = String(value || "pickup").toLowerCase();

    const labels = {
      pickup:
        "Pickup or delivery details will be agreed directly with the seller.",

      samecity:
        "Same-city delivery is available. Final details are confirmed with the seller.",

      "same-city":
        "Same-city delivery is available. Final details are confirmed with the seller.",

      intercity:
        "Intercity delivery is available through the selected transport route.",

      "inter-city":
        "Intercity delivery is available through the selected transport route.",
    };

    return (
      labels[key] ||
      `Delivery option: ${String(value).replaceAll("-", " ")}. Confirm timing with the seller.`
    );
  }

  function renderProduct() {
    const product = state.product;

    document.title = `${product.name || "Product"} | NgoXi`;

    els.name.textContent = product.name || "Product";

    els.category.textContent = (
      product.category || "NgoXi marketplace"
    ).replaceAll("-", " ");

    els.price.textContent = money(product.price);

    els.description.textContent =
      product.description || "No description supplied by the seller.";

    els.delivery.textContent = deliveryText(product.deliveryTime);

    const rating = safeNumber(product.rating || product.averageRating);

    const reviewCount = safeNumber(product.reviewCount || product.reviewsCount);

    if (rating) {
      els.rating.textContent =
        `${rating.toFixed(1)}` +
        (reviewCount ? ` (${reviewCount} reviews)` : "");
    } else {
      els.rating.textContent = "New product";
    }

    const mode = product.mode || (product.isMamba ? "Mamba" : "");

    if (mode) {
      els.modeBadge.textContent = mode;
      els.modeBadge.hidden = false;
    }

    const seller = sellerObject();

    const sellerName =
      product.sellerName || seller?.storeName || seller?.name || "NgoXi Seller";

    els.sellerName.textContent = sellerName;

    els.sellerAvatar.textContent =
      sellerName.trim().charAt(0).toUpperCase() || "N";

    renderGallery();
    updatePrices();
  }

  function renderSelections() {
    const variants = Array.isArray(state.product.variants)
      ? state.product.variants
      : [];

    const sizes = Array.isArray(state.product.sizes) ? state.product.sizes : [];

    els.variantChoices.innerHTML = "";
    els.sizeChoices.innerHTML = "";

    els.variantSection.hidden = !variants.length;
    els.sizeSection.hidden = !sizes.length;

    variants.forEach((variant) => {
      const button = document.createElement("button");

      button.type = "button";

      button.className =
        state.variant === variant ? "variant-choice active" : "variant-choice";

      const image =
        getVariantImage(variant) ||
        imageUrl(state.product.cover) ||
        PLACEHOLDER;

      const priceDifference = safeNumber(variant.priceDiff);

      button.innerHTML = `
        <img
          src="${escapeAttribute(image)}"
          alt="${escapeAttribute(variant.name || "Variant")}"
        >

        <span>
          <strong>
            ${escapeHTML(variant.name || "Variant")}
          </strong>

          <small>
            ${priceDifference ? `+${money(priceDifference)}` : "No extra cost"}
          </small>
        </span>
      `;

      button.addEventListener("click", () => {
        state.variant = variant;

        showVariantImage(variant);
        renderSelections();
        updatePrices();
      });

      els.variantChoices.appendChild(button);
    });

    sizes.forEach((sizeValue) => {
      const size =
        typeof sizeValue === "string"
          ? {
              label: sizeValue,
              priceDiff: 0,
            }
          : sizeValue;

      const button = document.createElement("button");

      button.type = "button";

      button.className =
        state.size === sizeValue ? "size-choice active" : "size-choice";

      const priceDifference = safeNumber(size.priceDiff);

      button.innerHTML = `
        <strong>${escapeHTML(size.label || "Size")}</strong>

        ${priceDifference ? `<small> +${money(priceDifference)}</small>` : ""}
      `;

      button.addEventListener("click", () => {
        state.size = sizeValue;

        renderSelections();
        updatePrices();
      });

      els.sizeChoices.appendChild(button);
    });
  }

  function updatePrices() {
    els.stickyTotal.textContent = money(state.product ? unitPrice() : 0);

    els.sheetUnitPrice.textContent = money(unitPrice());

    els.sheetTotal.textContent = money(orderTotal());

    els.quantity.textContent = String(state.quantity);

    els.sheetImage.src =
      getVariantImage(state.variant) ||
      imageUrl(state.product?.cover) ||
      state.images[0] ||
      PLACEHOLDER;

    els.sheetName.textContent = state.product?.name || "Product";
  }

  function openSheet() {
    state.quantity = 1;

    renderSelections();
    updatePrices();

    els.overlay.hidden = false;
    els.sheet.hidden = false;

    document.body.style.overflow = "hidden";
  }

  function closeSheet() {
    els.overlay.hidden = true;
    els.sheet.hidden = true;

    document.body.style.overflow = "";
  }

  function validateSelection() {
    const variants = Array.isArray(state.product.variants)
      ? state.product.variants
      : [];

    const sizes = Array.isArray(state.product.sizes) ? state.product.sizes : [];

    if (variants.length && !state.variant) {
      alert("Please choose a variant.");
      return false;
    }

    if (sizes.length && !state.size) {
      alert("Please choose a size.");
      return false;
    }

    return true;
  }

  function continueToSeller() {
    if (!validateSelection()) return;

    const selectedSize = getSelectedSize();

    const selection = {
      productId: state.product._id,
      sellerId: getSellerId(),

      productName: state.product.name,

      cover: getVariantImage(state.variant) || imageUrl(state.product.cover),

      basePrice: safeNumber(state.product.price),

      variant: state.variant
        ? {
            name: state.variant.name,
            priceDiff: safeNumber(state.variant.priceDiff),
            image: getVariantImage(state.variant),
          }
        : null,

      size: selectedSize
        ? {
            label: selectedSize.label,
            priceDiff: safeNumber(selectedSize.priceDiff),
          }
        : null,

      quantity: state.quantity,
      unitPrice: unitPrice(),
      total: orderTotal(),

      category: state.product.category || "",

      mode:
        state.product.mode || (state.product.isMamba ? "mamba" : "standard"),

      groupSaleId: state.product.groupSaleId || null,

      createdAt: new Date().toISOString(),
    };

    sessionStorage.setItem("ngoxi_pending_purchase", JSON.stringify(selection));

    window.location.href = `/home.html?chat=${encodeURIComponent(selection.sellerId)}&buy=1`;
  }

  function updateFavoriteButton() {
    const saved = JSON.parse(localStorage.getItem("ngx_favorites") || "[]");

    const active = saved.includes(state.product._id);

    els.favorite.classList.toggle("active", active);
    els.favorite.textContent = active ? "♥" : "♡";
  }

  function toggleFavorite() {
    const key = "ngx_favorites";

    const saved = JSON.parse(localStorage.getItem(key) || "[]");

    const productId = state.product._id;

    const updated = saved.includes(productId)
      ? saved.filter((id) => id !== productId)
      : [...saved, productId];

    localStorage.setItem(key, JSON.stringify(updated));

    updateFavoriteButton();
  }

  async function shareProduct() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: state.product.name,
          url: window.location.href,
        });

        return;
      }

      await navigator.clipboard.writeText(window.location.href);

      alert("Product link copied.");
    } catch {
      // User cancelled sharing.
    }
  }

  function visitSellerStore() {
    const id = getSellerId();

    if (!id) return;

    window.location.href = `/store.html?seller=${encodeURIComponent(id)}`;
  }

  function initEvents() {
    $("#backBtn").addEventListener("click", () => {
      if (history.length > 1) {
        history.back();
      } else {
        window.location.assign("/buyer");
      }
    });

    $("#shareBtn").addEventListener("click", shareProduct);

    $("#buyButton").addEventListener("click", openSheet);

    els.closeSheet.addEventListener("click", closeSheet);

    els.overlay.addEventListener("click", closeSheet);

    els.minus.addEventListener("click", () => {
      state.quantity = Math.max(1, state.quantity - 1);

      updatePrices();
    });

    els.plus.addEventListener("click", () => {
      state.quantity += 1;
      updatePrices();
    });

    els.continueButton.addEventListener("click", continueToSeller);

    els.favorite.addEventListener("click", toggleFavorite);

    els.visitStore.addEventListener("click", visitSellerStore);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function escapeAttribute(value) {
    return escapeHTML(value);
  }

  async function init() {
    initEvents();

    try {
      await loadProduct();

      renderProduct();
      updateFavoriteButton();

      els.loading.hidden = true;
      els.page.hidden = false;
      els.buyBar.hidden = false;
    } catch (error) {
      console.error("Product page error:", error);

      els.loading.hidden = true;

      els.errorMessage.textContent =
        error.message || "This product could not be loaded.";

      els.error.hidden = false;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
