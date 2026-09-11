/* ==========================================================
   NGOXI SELLER DASHBOARD — FINAL STABLE JS (Part 1/3)
   Notes:
   - Assumes backend baseURL http://localhost:5000
   - Expects /api/products/add (FormData) with keys:
       name, description, price, category?, deliveryTime, variants[], sizes[], cover, gallery[]
   - Expects /api/seller/my-products (GET) -> seller-owned products
   - Expects /api/products/:id/visibility (PATCH)
   - Expects /api/products/:id (DELETE)
   - HTML is the seller.html you shared earlier (ids/classes referenced below)
   ========================================================== */

const API_BASE =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
    ? "http://127.0.0.1:5000"
    : window.location.origin;
// Generic remote placeholder (only used if backend sends no image)
const PLACEHOLDER = "https://via.placeholder.com/400x400?text=NgoXi";

/* ----------------------------------------------------------
   1) SAFE BOOT: splash + token + expose helpers
   ---------------------------------------------------------- */
window.addEventListener("load", async () => {
  console.log("✅ Seller.js initialized");

  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "include",
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      window.location.href = "/auth";
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || "Could not verify session");
    }

    const user = data.user;

    if (!Array.isArray(user?.roles) || !user.roles.includes("seller")) {
      alert("Seller access required.");
      window.location.href = "/role-select.html";
      return;
    }

    const splash = document.getElementById("splash");

    setTimeout(() => {
      if (splash) splash.remove();

      const dash = document.getElementById("dashboard");

      if (dash) {
        dash.style.display = "block";
      }
    }, 800);

    const hdr = document.getElementById("storeNameHeader");

    if (hdr) {
      hdr.textContent = user.storeName || user.name || "Your Store";
    }
  } catch (error) {
    console.error("Seller session check failed:", error);

    window.location.href = "/auth";
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const splash = document.getElementById("splash");
  const dash = document.getElementById("dashboard");
  if (!splash || !dash) return;

  setTimeout(() => {
    splash.style.opacity = "0";
    setTimeout(() => {
      splash.style.display = "none";
      dash.style.display = "block";
    }, 600); // match CSS transition
  }, 3500);
});

/* ----------------------------------------------------------
   2) TOASTS
   ---------------------------------------------------------- */
function showToast(msg, type = "info") {
  const box = document.getElementById("toast-container");
  if (!box) return console.log(`[toast:${type}]`, msg);
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 250);
  }, 2600);
}

/* ----------------------------------------------------------
   3) THEME (with memory)
   ---------------------------------------------------------- */
const THEME_KEY = "theme";
function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
}
applyTheme(localStorage.getItem(THEME_KEY) || "light");

document.getElementById("themeBtn")?.addEventListener("click", () => {
  const newTheme = document.body.classList.contains("dark") ? "light" : "dark";
  applyTheme(newTheme);
  const chk = document.getElementById("darkMode");
  if (chk) chk.checked = newTheme === "dark";
  showToast(`Theme: ${newTheme}`, "success");
});
document.getElementById("darkMode")?.addEventListener("change", (e) => {
  applyTheme(e.target.checked ? "dark" : "light");
  showToast("Preference saved", "success");
});

/* ----------------------------------------------------------
   4) NAVIGATION (Home / My Products / Chat / Me)
   ---------------------------------------------------------- */
function showTab(id) {
  document
    .querySelectorAll(".tab")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const view = btn.dataset.view;
    showTab(view);
    if (view === "chat") document.getElementById("chatDot").hidden = true;
  });
});

/* ----------------------------------------------------------
   5) AUTH HELPERS
   ---------------------------------------------------------- */
async function authorizedFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { ...(options.headers || {}) };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}

async function authorizedUpload(url, formData) {
  const token = localStorage.getItem("token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  // NOTE: do NOT set Content-Type for FormData
  return fetch(url, {
    method: "POST",
    body: formData,
    headers,
    credentials: "include",
  });
}

/* ----------------------------------------------------------
   6) HOME: plan line + recently added + stats
   ---------------------------------------------------------- */
async function renderPlanLine() {
  try {
    const r = await authorizedFetch(`${API_BASE}/api/seller/my-products`);
    const list = await r.json();
    const planLine = document.getElementById("planLine");
    if (planLine)
      planLine.textContent = `Plan: Free (Products: ${
        Array.isArray(list) ? list.length : 0
      })`;
  } catch {
    const planLine = document.getElementById("planLine");
    if (planLine) planLine.textContent = "Plan: Free (Products: 0)";
  }
}

async function loadProductsForHome() {
  // You can swap to a public /api/products list if desired
  try {
    const res = await authorizedFetch(`${API_BASE}/api/seller/my-products`);
    const arr = await res.json();
    renderRecent(Array.isArray(arr) ? arr : []);
    document.getElementById("statProducts").textContent = Array.isArray(arr)
      ? arr.length
      : 0;
  } catch {
    renderRecent([]);
    document.getElementById("statProducts").textContent = 0;
  }
}
/* ==============================
   RECENT PRODUCTS ON HOME
   ============================== */
function renderRecent(list) {
  const box = document.getElementById("recentProducts");
  if (!box) return;
  box.innerHTML = "";
  if (!list || list.length === 0) {
    box.innerHTML = "<div class='muted'>No products yet.</div>";
    return;
  }

  // Show all posted products (including hidden), scrollable via CSS
  list.forEach((p) => {
    const name = sanitize(p.name);
    const price = Number(p.price || 0);
    const cover =
      p.cover?.url ||
      p.coverImage?.url ||
      (Array.isArray(p.images) && (p.images[0]?.url || p.images[0])) ||
      PLACEHOLDER;

    const isHidden = p.visibility === "hidden";

    const card = document.createElement("div");
    card.className = "recent-card card";
    if (isHidden) {
      card.classList.add("recent-card--hidden");
    }
    card.addEventListener("click", () => {
      showTab("products");
      document
        .querySelectorAll(".nav-btn")
        .forEach((b) =>
          b.classList.toggle("active", b.dataset.view === "products"),
        );

      // Smooth scroll to Posted Products grid
      setTimeout(() => {
        const grid = document.getElementById("postedGrid");
        if (grid) grid.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    });

    card.innerHTML = `
      <div class="rc-img" style="background-image:url('${cover}')"></div>
      <div class="rc-top">
        <div class="rc-title">${name}</div>
        <div class="rc-price">TSh ${price.toLocaleString()}</div>
      </div>
    `;
    box.appendChild(card);
  });
}

/* ----------------------------------------------------------
   7) “MY PRODUCTS” → tabs (Post / Posted)
   ---------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const postFormSection = document.getElementById("productForm");
  const postedSection = document.getElementById("postedProduct");
  const tabBtns = document.querySelectorAll(".prod-tab-btn");

  if (!postFormSection || !postedSection || !tabBtns.length) return;

  // Default view
  postFormSection.style.display = "block";
  postedSection.style.display = "none";

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const which = btn.dataset.prodtab; // "post" | "posted"
      if (which === "post") {
        postFormSection.style.display = "block";
        postedSection.style.display = "none";
      } else {
        postFormSection.style.display = "none";
        postedSection.style.display = "block";
        // refresh list
        loadMyProducts();
      }
    });
  });
});

document.getElementById("saveOrderUpdateBtn")?.addEventListener("click", () => {
  if (!activeOrderDetailsId) return;

  const o = findOrderById(activeOrderDetailsId);
  if (!o) return showToast("Order not found.", "error");
  if ((o.status || "unfilled") !== "completed") {
    showToast("Shipping updates only allowed in Active shipping.", "error");
    return;
  }

  const plate = document.getElementById("busPlateInput")?.value?.trim() || "";
  const tripBtn = document.querySelector("#orderModalBody [data-trip].active");
  const tripStatus = tripBtn?.dataset?.trip || "pending";

  const updated = updateTrip(activeOrderDetailsId, {
    busPlate: plate,
    tripStatus,
  });

  if (!updated) return showToast("Failed to save update.", "error");

  // Update chat dot based on order status
  if (updated.chatId) {
    const chat = findSellerConversation(updated.chatId);
    if (chat) {
      chat.orderState = updated.status === "done" ? "completed" : "completed"; // orange either way once confirmed/shipping
      loadSellerConversations();
    }
  }

  showToast("Shipping update saved ✅", "success");

  // Refresh modal content (in case it turned DONE)
  openOrderDetails(activeOrderDetailsId);

  // Refresh orders list (respect active filter)
  const activePill = document.querySelector("[data-order].active");
  renderOrders(activePill?.dataset?.order || "completed");
});

/* ----------------------------------------------------------
   8) POST FORM: Variants + Sizes UI helpers
   ---------------------------------------------------------- */
// SIZES
let sizesData = []; // [{ label, priceDiff }]

function renderSizes() {
  const list = document.getElementById("sizesList");
  if (!list) return;

  list.innerHTML = "";

  sizesData.forEach((s, i) => {
    const el = document.createElement("div");
    el.className = "size-chip";

    el.innerHTML = `
      <span>
        <strong>${sanitize(s.label)}</strong>
        ${s.priceDiff ? ` · +TSh ${Number(s.priceDiff).toLocaleString()}` : ""}
      </span>

      <button 
        class="chip-remove"
        data-i="${i}"
        type="button">
        ✖
      </button>
    `;

    list.appendChild(el);
  });

  list.querySelectorAll(".chip-remove").forEach((btn) => {
    btn.onclick = () => {
      sizesData.splice(Number(btn.dataset.i), 1);

      renderSizes();
    };
  });
}

document.getElementById("addSizeBtn")?.addEventListener("click", () => {
  document.getElementById("sizeNameInput").value = "";
  document.getElementById("sizeDiffInput").value = "0";

  document.getElementById("sizeModal")?.setAttribute("aria-hidden", "false");
});

document.getElementById("sizeSaveBtn")?.addEventListener("click", () => {
  const label = document.getElementById("sizeNameInput").value.trim();

  const priceDiff = Number(document.getElementById("sizeDiffInput").value || 0);

  if (!label) {
    showToast("Enter size", "error");
    return;
  }

  sizesData.push({
    label,
    priceDiff,
  });

  renderSizes();

  document.getElementById("sizeModal")?.setAttribute("aria-hidden", "true");
});

// VARIANTS — each variant now has its own image
document.getElementById("addVariant")?.addEventListener("click", () => {
  const row = document.createElement("div");
  row.className = "variant-row";
  row.innerHTML = `
    <input class="v-name" placeholder="Variant (e.g., Red / 42)">
    <input class="v-price" type="number" placeholder="Variant Price (TSh)">
    <input class="v-image" type="file" accept="image/*" title="Variant image">
    <button class="v-del" type="button" title="Remove">✖</button>
  `;
  row.querySelector(".v-del").onclick = () => row.remove();
  document.getElementById("variants")?.appendChild(row);
});

// Collectors used by POST
// We collect BOTH variant data and attached image files,
// so backend can map gallery[index] -> that variant.
function collectVariantsAndFiles() {
  const rows = [...document.querySelectorAll("#variants .variant-row")];

  const variants = [];
  const variantImages = [];

  rows.forEach((row) => {
    const name = row.querySelector(".v-name")?.value.trim();

    if (!name) return;

    const priceDiff = Number(row.querySelector(".v-price")?.value || 0);

    const file = row.querySelector(".v-image")?.files?.[0];

    let imageIndex = null;

    if (file) {
      imageIndex = variantImages.length;

      variantImages.push(file);
    }

    variants.push({
      name,

      priceDiff,

      imageIndex,
    });
  });

  return {
    variants,
    variantImages,
  };
}

function collectSizesArray() {
  return Array.isArray(sizesData) ? sizesData : [];
}

/* ----------------------------------------------------------
   9) POST PRODUCT: preview + submit
   ---------------------------------------------------------- */
// GALLERY — multiple photos, preview and removal
let galleryFiles = [];

function renderGalleryPreview() {
  const wrap = document.getElementById("galleryPreview");
  if (!wrap) return;

  wrap.innerHTML = "";

  galleryFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "gallery-preview-item";

    const imageUrl = URL.createObjectURL(file);

    item.innerHTML = `
      <img
        src="${imageUrl}"
        alt="${sanitize(file.name)}"
      />

      <button
        type="button"
        data-remove-gallery="${index}"
        aria-label="Remove image"
      >
        ×
      </button>
    `;

    item
      .querySelector("img")
      ?.addEventListener("load", () => URL.revokeObjectURL(imageUrl), {
        once: true,
      });

    item.querySelector("button")?.addEventListener("click", () => {
      galleryFiles.splice(index, 1);
      renderGalleryPreview();
    });

    wrap.appendChild(item);
  });
}

document.getElementById("p_gallery")?.addEventListener("change", (event) => {
  const incomingFiles = Array.from(event.target.files || []);

  const availableSlots = 8 - galleryFiles.length;

  if (availableSlots <= 0) {
    showToast("Gallery limit is 8 photos.", "error");
    event.target.value = "";
    return;
  }

  galleryFiles.push(...incomingFiles.slice(0, availableSlots));

  if (incomingFiles.length > availableSlots) {
    showToast("Only the first 8 gallery photos were added.", "info");
  }

  // Reset input so the same image can be selected again
  event.target.value = "";

  renderGalleryPreview();
});

// DISCOUNT CALCULATOR
function calculateDiscountPreview() {
  const originalPrice = Number(document.getElementById("p_price")?.value || 0);

  const discountInput = document.getElementById("p_discount");

  let discount = Number(discountInput?.value || 0);

  if (!Number.isFinite(discount)) {
    discount = 0;
  }

  discount = Math.min(100, Math.max(0, discount));

  const finalPrice = Math.round(originalPrice * (1 - discount / 100));

  const oldPriceElement = document.getElementById("discountOldPrice");

  const newPriceElement = document.getElementById("discountNewPrice");

  const discountBadge = document.getElementById("discountBadge");

  if (oldPriceElement) {
    oldPriceElement.textContent = `TSh ${originalPrice.toLocaleString()}`;

    oldPriceElement.hidden = originalPrice <= 0 || discount <= 0;
  }

  if (newPriceElement) {
    newPriceElement.textContent = `TSh ${finalPrice.toLocaleString()}`;
  }

  if (discountBadge) {
    discountBadge.textContent = `${discount}% OFF`;
    discountBadge.hidden = discount <= 0;
  }
}

document
  .getElementById("p_price")
  ?.addEventListener("input", calculateDiscountPreview);

document
  .getElementById("p_discount")
  ?.addEventListener("input", calculateDiscountPreview);

calculateDiscountPreview();

// Clear form helper
document.getElementById("clearProduct")?.addEventListener("click", () => {
  const ids = ["p_title", "p_desc", "p_price", "p_cat"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const cover = document.getElementById("p_cover");
  if (cover) cover.value = "";
  const galleryInput = document.getElementById("p_gallery");

  if (galleryInput) {
    galleryInput.value = "";
  }

  galleryFiles = [];
  renderGalleryPreview();

  const modeInput = document.getElementById("p_mode");

  if (modeInput) {
    modeInput.value = "standard";
  }

  const discountInput = document.getElementById("p_discount");

  if (discountInput) {
    discountInput.value = "0";
  }

  calculateDiscountPreview();
  sizesData = [];
  renderSizes();
});

// Submit new product
document.getElementById("postProduct")?.addEventListener("click", async () => {
  try {
    const name = document.getElementById("p_title").value.trim();
    const description = document.getElementById("p_desc").value.trim();
    const price = Number(document.getElementById("p_price").value);
    const category = document.getElementById("p_cat")?.value || "";

    const mode = document.getElementById("p_mode")?.value || "standard";

    const discountPercent = Number(
      document.getElementById("p_discount")?.value || 0,
    );

    const deliveryTime = document.getElementById("deliveryOption").value;

    const cover = document.getElementById("p_cover")?.files?.[0];

    if (!name || !description || !Number.isFinite(price) || price <= 0) {
      showToast("Name, description, and a valid price are required.", "error");
      return;
    }
    if (!cover) {
      showToast("Cover image is required.", "error");
      return;
    }
    if (!category) {
      showToast("Select a product category.", "error");
      return;
    }

    if (
      !Number.isFinite(discountPercent) ||
      discountPercent < 0 ||
      discountPercent > 100
    ) {
      showToast("Discount must be between 0 and 100%.", "error");

      return;
    }

    const fd = new FormData();
    fd.append("name", name);
    fd.append("description", description);
    fd.append("price", String(price));
    fd.append("category", category);
    fd.append("mode", mode);
    fd.append("discountPercent", String(discountPercent));
    fd.append("deliveryTime", deliveryTime);

    // Collect variants + their images
    const { variants, variantImages } = collectVariantsAndFiles();
    fd.append("variants", JSON.stringify(variants));

    // Sizes stay as before
    fd.append("sizes", JSON.stringify(collectSizesArray()));

    // Cover image
    fd.append("cover", cover);
    // Gallery images
    galleryFiles.forEach((file) => {
      fd.append("gallery", file);
    });
    // Variant images
    variantImages.forEach((file) => {
      fd.append("variantImages", file);
    });

    const res = await authorizedUpload(`${API_BASE}/api/products/add`, fd);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false)
      throw new Error(data?.message || "Upload failed");

    showToast("✅ Product posted", "success");
    document.getElementById("clearProduct")?.click();

    // Switch to "Posted" tab and refresh everywhere
    document.querySelector('[data-prodtab="posted"]')?.click();
    await refreshProductsEverywhere();
  } catch (e) {
    console.error(e);
    showToast(e.message || "Failed to post", "error");
  }
});

/* ----------------------------------------------------------
   10) UTIL
   ---------------------------------------------------------- */
function sanitize(s = "") {
  return s.replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );
}
/* ==========================================================
   PART 2 — PRODUCT CARDS + MINI TABS WORKING + SMALL IMAGES
   ========================================================== */

/* ---- MINI TABS (inside Me -> Settings / Orders / QR) ---- */
function showMeSub(id) {
  document
    .querySelectorAll(".sub-content")
    .forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(`sub-${id}`);
  if (el) el.classList.add("active");
}

document.querySelectorAll(".me-pill")?.forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".me-pill")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const which = btn.dataset.sub;
    showMeSub(which);

    if (which === "orders") renderOrders("unfilled");
    if (which === "qr") generateQR();
  });
});
/* ==============================
   SETTINGS MINI-TABS HANDLER
   ============================== */
function showMini(id) {
  document
    .querySelectorAll(".mini-content")
    .forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(`mini-${id}`);
  if (el) el.classList.add("active");
}

document.querySelectorAll(".mini-pill")?.forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".mini-pill")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    showMini(btn.dataset.mini);
  });
});

/* =========================================================
   SELLER PROFILE + PAYMENT METHODS V2
   MongoDB is the source of truth.
========================================================= */

const sellerProfileState = {
  seller: null,
  paymentMethods: [],
  editingPaymentIndex: null,
};

/* =========================================================
   SMALL HELPERS
========================================================= */

function sellerFieldValue(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function setSellerFieldValue(id, value = "") {
  const element = document.getElementById(id);

  if (element) {
    element.value = value || "";
  }
}

function setProfileSaveStatus(text = "") {
  const status = document.getElementById("sellerProfileSaveStatus");

  if (status) {
    status.textContent = text;
  }
}

function normalizePaymentType(uiType, provider = "") {
  if (uiType === "bank") {
    return "bank";
  }

  if (uiType === "other") {
    return "other";
  }

  const value = String(provider).trim().toLowerCase();

  if (value.includes("m-pesa") || value.includes("mpesa")) {
    return "mpesa";
  }

  if (value.includes("airtel")) {
    return "airtel-money";
  }

  if (value.includes("halo") || value.includes("halopesa")) {
    return "halopesa";
  }

  if (
    value.includes("tigo") ||
    value.includes("mixx") ||
    value.includes("yas")
  ) {
    return "tigo-pesa";
  }

  if (value.includes("lipa") || value.includes("till")) {
    return "lipa-namba";
  }

  return "other";
}

function paymentTypeForEditor(method = {}) {
  if (method.type === "bank") {
    return "bank";
  }

  if (method.type === "other") {
    return "other";
  }

  return "mobile_money";
}

/* =========================================================
   LOAD PROFILE FROM MONGODB
========================================================= */

async function loadSellerProfile() {
  try {
    const response = await authorizedFetch(`${API_BASE}/api/seller/profile`);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Could not load seller profile");
    }

    const seller = data.seller;

    if (!seller) {
      throw new Error("Seller profile was not returned");
    }

    sellerProfileState.seller = seller;

    sellerProfileState.paymentMethods = Array.isArray(
      seller?.sellerProfile?.paymentMethods,
    )
      ? seller.sellerProfile.paymentMethods
      : [];

    /* -------------------------
       PERSONAL FIELDS
    ------------------------- */

    setSellerFieldValue("storeName", seller.storeName);

    setSellerFieldValue("sellerName", seller.name);

    setSellerFieldValue("sellerPhone", seller?.sellerProfile?.contact?.phone);

    setSellerFieldValue(
      "sellerWhatsapp",
      seller?.sellerProfile?.contact?.whatsapp,
    );

    setSellerFieldValue("sellerEmail", seller.email);

    setSellerFieldValue(
      "sellerAddress",
      seller?.sellerProfile?.pickupLocations?.[0]?.address || "",
    );

    /* -------------------------
       PROFILE PHOTO
    ------------------------- */

    const profilePreview = document.getElementById("profilePreview");

    const avatarUrl = seller?.sellerProfile?.avatar?.url;

    if (profilePreview && avatarUrl) {
      profilePreview.src = avatarUrl;
    }

    /* -------------------------
       HEADER STORE NAME
    ------------------------- */

    const header = document.getElementById("storeNameHeader");

    if (header) {
      header.textContent = seller.storeName || "Your Store";
    }

    renderSellerPaymentMethods();

    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (error) {
    console.error("❌ Failed loading seller profile:", error);

    showToast(error.message || "Could not load seller settings", "error");
  }
}

/* =========================================================
   SAVE PERSONAL PROFILE
========================================================= */

document
  .getElementById("saveSellerProfile")
  ?.addEventListener("click", async () => {
    const saveButton = document.getElementById("saveSellerProfile");

    try {
      const storeName = sellerFieldValue("storeName");

      const name = sellerFieldValue("sellerName");

      const phone = sellerFieldValue("sellerPhone");

      const whatsapp = sellerFieldValue("sellerWhatsapp");

      const email = sellerFieldValue("sellerEmail");

      const address = sellerFieldValue("sellerAddress");

      if (!storeName) {
        showToast("Enter your store name.", "error");

        return;
      }

      if (!name) {
        showToast("Enter seller or business name.", "error");

        return;
      }

      if (!email) {
        showToast("Enter an email address.", "error");

        return;
      }

      if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
      }

      setProfileSaveStatus("Saving...");

      const response = await authorizedFetch(`${API_BASE}/api/seller/profile`, {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          storeName,
          name,
          phone,
          whatsapp,
          email,
          address,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not save seller profile");
      }

      sellerProfileState.seller = data.seller;

      const header = document.getElementById("storeNameHeader");

      if (header) {
        header.textContent = data.seller?.storeName || "Your Store";
      }

      /*
          Keep the cached login user reasonably
          fresh, but MongoDB remains truth.
        */

      const cachedUser = JSON.parse(localStorage.getItem("user") || "{}");

      localStorage.setItem(
        "user",
        JSON.stringify({
          ...cachedUser,

          name: data.seller?.name || cachedUser.name,

          email: data.seller?.email || cachedUser.email,

          storeName: data.seller?.storeName || cachedUser.storeName,
        }),
      );

      setProfileSaveStatus("Saved ✓");

      showToast("Seller profile saved ✅", "success");
    } catch (error) {
      console.error("❌ Save seller profile failed:", error);

      setProfileSaveStatus("Save failed");

      showToast(error.message || "Could not save profile", "error");
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
      }
    }
  });

/* =========================================================
   PROFILE PHOTO PREVIEW

   IMPORTANT:
   This only previews the selected image for now.
   Actual image upload comes in the avatar-upload patch.
========================================================= */

const photoBtn = document.getElementById("changePhotoBtn");

const photoInput = document.getElementById("profilePhotoInput");

photoBtn?.addEventListener("click", () => {
  photoInput?.click();
});

photoInput?.addEventListener("change", () => {
  const file = photoInput.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    showToast("Choose an image file.", "error");

    return;
  }

  const preview = document.getElementById("profilePreview");

  if (preview) {
    const temporaryUrl = URL.createObjectURL(file);

    preview.src = temporaryUrl;

    preview.onload = () => {
      URL.revokeObjectURL(temporaryUrl);
    };
  }

  showToast("Photo selected. Image upload will be connected next.", "info");
});

/* =========================================================
   PAYMENT EDITOR
========================================================= */

function openSellerPaymentEditor(method = null, index = null) {
  const editor = document.getElementById("sellerPaymentEditor");

  if (!editor) {
    return;
  }

  sellerProfileState.editingPaymentIndex = Number.isInteger(index)
    ? index
    : null;

  const editing = sellerProfileState.editingPaymentIndex !== null;

  const title = document.getElementById("sellerPaymentEditorTitle");

  const saveButton = document.getElementById("saveSellerPaymentMethod");

  if (title) {
    title.textContent = editing ? "Edit payment method" : "Add payment method";
  }

  if (saveButton) {
    saveButton.textContent = editing ? "Save Changes" : "Add Method";
  }

  setSellerFieldValue("sellerPaymentProvider", method?.provider || "");

  setSellerFieldValue("sellerPaymentAccountName", method?.accountName || "");

  setSellerFieldValue("sellerPaymentAccountNumber", method?.number || "");

  setSellerFieldValue("sellerPaymentInstructions", method?.note || "");

  const typeSelect = document.getElementById("sellerPaymentType");

  if (typeSelect) {
    typeSelect.value = paymentTypeForEditor(method || {});
  }

  editor.hidden = false;

  editor.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeSellerPaymentEditor() {
  const editor = document.getElementById("sellerPaymentEditor");

  if (editor) {
    editor.hidden = true;
  }

  sellerProfileState.editingPaymentIndex = null;
}

document
  .getElementById("addSellerPaymentMethod")
  ?.addEventListener("click", () => {
    openSellerPaymentEditor();
  });

document
  .getElementById("closeSellerPaymentEditor")
  ?.addEventListener("click", closeSellerPaymentEditor);

document
  .getElementById("cancelSellerPaymentMethod")
  ?.addEventListener("click", closeSellerPaymentEditor);

/* =========================================================
   RENDER PAYMENT METHODS
========================================================= */

function renderSellerPaymentMethods() {
  const list = document.getElementById("sellerPaymentMethodsList");

  const empty = document.getElementById("sellerPaymentMethodsEmpty");

  if (!list) {
    return;
  }

  /*
    Keep the empty-state element,
    remove only generated cards.
  */

  list
    .querySelectorAll(".seller-payment-method-card")
    .forEach((card) => card.remove());

  const methods = sellerProfileState.paymentMethods;

  if (empty) {
    empty.hidden = methods.length > 0;
  }

  methods.forEach((method, index) => {
    const card = document.createElement("article");

    card.className = "seller-payment-method-card";

    card.innerHTML = `
        <div class="seller-payment-method-card-top">

          <div class="seller-payment-provider">

            <div class="seller-payment-provider-icon">
              <i data-lucide="${
                method.type === "bank" ? "landmark" : "wallet-cards"
              }"></i>
            </div>

            <div class="seller-payment-provider-copy">

              <strong>
                ${sanitize(method.provider || method.label || "Payment method")}
              </strong>

              <small>
                ${sanitize(
                  method.type === "bank" ? "Bank account" : "Payment account",
                )}
              </small>

            </div>

          </div>

          <div class="seller-payment-card-actions">

            <button
              type="button"
              data-edit-payment="${index}"
              aria-label="Edit payment method"
            >
              <i data-lucide="pencil"></i>
            </button>

            <button
              type="button"
              data-delete-payment="${index}"
              aria-label="Delete payment method"
            >
              <i data-lucide="trash-2"></i>
            </button>

          </div>

        </div>

        <div class="seller-payment-account-number">
          ${sanitize(method.number || "")}
        </div>

        ${
          method.accountName
            ? `
              <div class="seller-payment-account-name">
                ${sanitize(method.accountName)}
              </div>
            `
            : ""
        }

        ${
          method.note
            ? `
              <div class="seller-payment-method-note">
                ${sanitize(method.note)}
              </div>
            `
            : ""
        }

      `;

    list.appendChild(card);
  });

  list.querySelectorAll("[data-edit-payment]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.editPayment);

      const method = sellerProfileState.paymentMethods[index];

      if (!method) {
        return;
      }

      openSellerPaymentEditor(method, index);
    });
  });

  list.querySelectorAll("[data-delete-payment]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.deletePayment);

      await deleteSellerPaymentMethod(index);
    });
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

/* =========================================================
   SAVE PAYMENT ARRAY TO MONGODB
========================================================= */

async function saveSellerPaymentMethods() {
  const response = await authorizedFetch(`${API_BASE}/api/seller/profile`, {
    method: "PATCH",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      paymentMethods: sellerProfileState.paymentMethods,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Could not save payment methods");
  }

  sellerProfileState.seller = data.seller;

  sellerProfileState.paymentMethods = Array.isArray(
    data.seller?.sellerProfile?.paymentMethods,
  )
    ? data.seller.sellerProfile.paymentMethods
    : [];

  renderSellerPaymentMethods();
}

/* =========================================================
   ADD / EDIT PAYMENT METHOD
========================================================= */

document
  .getElementById("saveSellerPaymentMethod")
  ?.addEventListener("click", async () => {
    const saveButton = document.getElementById("saveSellerPaymentMethod");

    try {
      const uiType = sellerFieldValue("sellerPaymentType");

      const provider = sellerFieldValue("sellerPaymentProvider");

      const accountName = sellerFieldValue("sellerPaymentAccountName");

      const number = sellerFieldValue("sellerPaymentAccountNumber");

      const note = sellerFieldValue("sellerPaymentInstructions");

      if (!provider) {
        showToast("Enter the payment provider.", "error");

        return;
      }

      if (!number) {
        showToast("Enter the payment number or account.", "error");

        return;
      }

      const method = {
        type: normalizePaymentType(uiType, provider),

        provider,

        label: provider,

        accountName,

        number,

        note,

        active: true,
      };

      const editIndex = sellerProfileState.editingPaymentIndex;

      if (Number.isInteger(editIndex)) {
        sellerProfileState.paymentMethods[editIndex] = method;
      } else {
        sellerProfileState.paymentMethods.push(method);
      }

      if (saveButton) {
        saveButton.disabled = true;

        saveButton.textContent = "Saving...";
      }

      await saveSellerPaymentMethods();

      closeSellerPaymentEditor();

      showToast("Payment method saved ✅", "success");
    } catch (error) {
      console.error("❌ Payment save failed:", error);

      showToast(error.message || "Could not save payment method", "error");

      /*
          Reload from MongoDB if the PATCH failed,
          preventing browser state from drifting.
        */

      await loadSellerProfile();
    } finally {
      if (saveButton) {
        saveButton.disabled = false;

        saveButton.textContent = "Add Method";
      }
    }
  });

/* =========================================================
   DELETE PAYMENT METHOD
========================================================= */

async function deleteSellerPaymentMethod(index) {
  const method = sellerProfileState.paymentMethods[index];

  if (!method) {
    return;
  }

  const confirmed = window.confirm(
    `Remove ${method.provider || "this payment method"}?`,
  );

  if (!confirmed) {
    return;
  }

  const previous = [...sellerProfileState.paymentMethods];

  try {
    sellerProfileState.paymentMethods.splice(index, 1);

    await saveSellerPaymentMethods();

    showToast("Payment method removed.", "success");
  } catch (error) {
    sellerProfileState.paymentMethods = previous;

    renderSellerPaymentMethods();

    console.error("❌ Delete payment method failed:", error);

    showToast(error.message || "Could not remove payment method", "error");
  }
}

/* =========================================================
   INITIAL PROFILE LOAD
========================================================= */

loadSellerProfile();
/* ==========================================================
   PART 3 — FINAL WIRING: cards, actions, QR, orders, init
   ========================================================== */

/* ---------- Shared helpers ---------- */
function getProductThumb(p) {
  // Prefer backend image fields (objects or strings)
  let cover =
    (p.cover && p.cover.url) || // cover: { url: ... }
    (p.coverImage && p.coverImage.url) || // coverImage: { url: ... }
    p.cover || // cover: "https://..."
    (Array.isArray(p.images) && (p.images[0]?.url || p.images[0])) ||
    PLACEHOLDER;

  // If backend returns relative URLs like "/uploads/xyz.jpg", prefix with host
  if (typeof cover === "string" && cover.startsWith("/")) {
    cover = `http://localhost:5000${cover}`;
  }

  return cover;
}

/* ---------- Replace loadMyProducts with FINAL version ---------- */
async function loadMyProducts() {
  const grid = document.getElementById("postedGrid");
  const empty = document.getElementById("myProductsEmpty");
  if (!grid) return;

  grid.innerHTML = "";
  try {
    const r = await authorizedFetch(`${API_BASE}/api/seller/my-products`);
    const products = await r.json();

    if (!Array.isArray(products) || products.length === 0) {
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    const frag = document.createDocumentFragment();

    products.forEach((p) => {
      const img = getProductThumb(p);
      const price = Number(p.price || 0);
      const hiddenBadge =
        p.visibility === "hidden"
          ? `<span class="badge muted">Hidden</span>`
          : "";

      const card = document.createElement("div");
      card.className = "posted-card";
      card.innerHTML = `
  <div class="pc-img small" style="background-image:url('${img}')"></div>

  <button class="pc-kebab" data-kebab="${p._id}" aria-label="Actions">⋮</button>
  <div class="pc-menu" id="menu-${p._id}">
    <button data-edit="${p._id}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25zM19.71 7.04c.19-.19.29-.44.29-.71
                 0-.27-.1-.52-.29-.71l-1.34-1.34a1.003 1.003 0 0 0-1.42 0L15 4.59l2.75 2.75 1.96-2.3z"/>
      </svg>
      <span>Edit</span>
    </button>
    <button data-toggle="${p._id}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1
                 0-10 5 5 0 0 1 0 10z"/>
      </svg>
      <span>${p.visibility === "hidden" ? "Unhide" : "Hide"}</span>
    </button>
    <button data-del="${p._id}" class="danger">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 3v1H4v2h16V4h-5V3H9zm-1 6v9h2V9H8zm4 0v9h2V9h-2zm4
                 0v9h2V9h-2z"/>
      </svg>
      <span>Delete</span>
    </button>
  </div>

  <div class="pc-body">
    <div class="pc-title">${sanitize(p.name || "Product")}</div>
    <div class="pc-meta">
      <span class="pc-price">TSh ${price.toLocaleString()}</span>
      ${hiddenBadge}
    </div>
  </div>
`;

      frag.appendChild(card);
    });

    grid.appendChild(frag);
    attachProductActions();
  } catch (err) {
    console.error(err);
    if (empty) empty.style.display = "block";
  }
}

/* ---------- Kebab action handlers ---------- */
async function onToggleVisibility(id) {
  try {
    const res = await authorizedFetch(
      `${API_BASE}/api/products/${id}/visibility`,
      {
        method: "PATCH",
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Toggle failed");
    showToast(
      data.hidden ? "Product hidden 👁" : "Product visible ✅",
      "success",
    );
    await refreshProductsEverywhere();
  } catch (e) {
    console.error(e);
    showToast("Failed to toggle visibility", "error");
  }
}

async function onDeleteProduct(id) {
  if (!confirm("Delete this product permanently?")) return;
  try {
    const res = await authorizedFetch(`${API_BASE}/api/products/${id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Delete failed");
    showToast("Product deleted ✅", "success");
    await refreshProductsEverywhere();
  } catch (e) {
    console.error(e);
    showToast("Failed to delete", "error");
  }
}

function onEditProduct(id) {
  // Simple prefill into the Post form (same page edit)
  // You can expand this to an Edit modal if you like.
  authorizedFetch(`${API_BASE}/api/products/${id}`)
    .then((r) => r.json())
    .then((p) => {
      if (!p || !p._id) return showToast("Product not found", "error");
      document.querySelector('[data-prodtab="post"]')?.click(); // switch to form
      // fill fields we have
      const n = document.getElementById("p_title");
      const d = document.getElementById("p_desc");
      const pr = document.getElementById("p_price");
      const cat = document.getElementById("p_cat");
      const del = document.getElementById("deliveryOption");

      if (n) n.value = p.name || "";
      if (d) d.value = p.description || "";
      if (pr) pr.value = p.price || "";
      if (cat) cat.value = p.category || "";
      if (del) del.value = p.deliveryTime || "pickup";

      showToast("Loaded into form. Update and post to save changes.", "info");
    })
    .catch((e) => {
      console.error(e);
      showToast("Failed to load product", "error");
    });
}
// Close modal when clicking outside (backdrop)
document.getElementById("orderModal")?.addEventListener("click", (e) => {
  const sheet = document.querySelector("#orderModal .modal-sheet");
  if (sheet && !sheet.contains(e.target)) closeOrderModal();
});

// Close modal on ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const m = document.getElementById("orderModal");
    if (m && m.getAttribute("aria-hidden") === "false") closeOrderModal();
  }
});

/* ---------- Attach actions to kebab menus ---------- */
function attachProductActions() {
  document.querySelectorAll("[data-kebab]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.kebab;
      document
        .querySelectorAll(".pc-menu")
        .forEach((m) => (m.style.display = "none"));
      const menu = document.getElementById(`menu-${id}`);
      if (menu) menu.style.display = "block";
    });
  });

  document.addEventListener("click", () => {
    document
      .querySelectorAll(".pc-menu")
      .forEach((m) => (m.style.display = "none"));
  });

  document.querySelectorAll("[data-toggle]").forEach((b) => {
    b.addEventListener("click", async () => {
      await onToggleVisibility(b.dataset.toggle);
    });
  });

  document.querySelectorAll("[data-del]").forEach((b) => {
    b.addEventListener("click", async () => {
      await onDeleteProduct(b.dataset.del);
    });
  });

  document.querySelectorAll("[data-edit]").forEach((b) => {
    b.addEventListener("click", () => onEditProduct(b.dataset.edit));
  });
}

const ORDER_STATUS = {
  UNFILLED: "unfilled",
  FILLED: "filled",
  COMPLETED: "completed",
  DONE: "done",
  CANCELLED: "cancelled",
};

/*
  Seller orders now come from MongoDB.
  No business order data should live in localStorage.
*/
let sellerOrdersState = [];

let activeOrderDetailsId = null;

function mapMongoOrderStatus(status = "") {
  switch (status) {
    case "placed":
    case "awaiting-payment":
      return ORDER_STATUS.UNFILLED;

    case "receipt-uploaded":
      return ORDER_STATUS.FILLED;

    case "payment-confirmed":
    case "preparing":
    case "ready":
    case "shipping":
      return ORDER_STATUS.COMPLETED;

    case "delivered":
      return ORDER_STATUS.DONE;

    case "cancelled":
      return ORDER_STATUS.CANCELLED;

    default:
      return ORDER_STATUS.UNFILLED;
  }
}

function normalizeSellerOrder(order = {}) {
  const delivery = order.delivery || {};
  const snapshot = order.productSnapshot || {};
  const buyer = order.buyer || {};

  const conversationId = String(
    order.conversation?._id || order.conversation || "",
  );

  return {
    ...order,

    id: String(order.id || order._id || ""),

    mongoStatus: order.status || "awaiting-payment",

    status: mapMongoOrderStatus(order.status),

    conversationId,

    chatId: conversationId,

    productId: String(order.product?._id || order.product || ""),

    productName:
      order.productName ||
      snapshot.name ||
      order.product?.name ||
      "NgoXi Order",

    productImage:
      order.productImage || snapshot.image || order.product?.cover?.url || "",

    variant: order.variant || snapshot.variant || "",

    size: order.size || snapshot.size || "",

    qty: Number(order.quantity || snapshot.quantity || 1),

    quantity: Number(order.quantity || snapshot.quantity || 1),

    price: Number(order.price || snapshot.totalPrice || 0),

    unitPrice: Number(snapshot.unitPrice || 0),

    buyerId: String(buyer._id || order.buyer || ""),

    buyerName: buyer.name || order.buyerName || "Buyer",

    buyerCity: delivery.city || "",

    receiverName: delivery.receiverName || buyer.name || "",

    receiverPhone: delivery.phone || "",

    address: delivery.address || "",

    receiptImage: order.payment?.receiptUrl || null,

    shipping: {
      plateNumber: order.inbound?.busPlate || "",

      tripStatus:
        order.status === "delivered"
          ? "arrived"
          : order.status === "shipping"
            ? "on_the_way"
            : "pending",
    },

    createdAt: order.createdAt || Date.now(),

    updatedAt: order.updatedAt || Date.now(),
  };
}

function statusLabel(st) {
  if (st === ORDER_STATUS.UNFILLED) return "Awaiting payment";
  if (st === ORDER_STATUS.FILLED) return "Paid (waiting confirmation)";
  if (st === ORDER_STATUS.COMPLETED) return "Active shipping";
  if (st === ORDER_STATUS.DONE) return "Arrived (Done)";
  return "Unknown";
}

function updateTrip(id, data) {
  const all = getAllOrders();
  const idx = all.findIndex((o) => o.id === id);
  if (idx < 0) return null;

  const current = all[idx];
  current.shipping = {
    ...(current.shipping || {}),
    plateNumber: data.busPlate ?? current.shipping?.plateNumber ?? "",
    tripStatus: data.tripStatus ?? current.shipping?.tripStatus ?? "pending",
  };

  if (current.shipping.tripStatus === "arrived") {
    current.status = ORDER_STATUS.DONE;
  }

  current.updatedAt = Date.now();
  all[idx] = current;
  saveAllOrders(all);
  return current;
}

function renderOrders(filter) {
  const box = document.getElementById("orders");
  if (!box) return;

  const all = getAllOrders();

  const cur = all.filter((o) => {
    const st = o.status || ORDER_STATUS.UNFILLED;
    if (filter === "unfilled") return st === ORDER_STATUS.UNFILLED;
    if (filter === "filled") return st === ORDER_STATUS.FILLED;
    if (filter === "completed")
      return st === ORDER_STATUS.COMPLETED || st === ORDER_STATUS.DONE;
    return false;
  });

  box.innerHTML = "";
  if (cur.length === 0) {
    box.innerHTML = "<div class='muted'>No orders here.</div>";
    return;
  }

  cur.forEach((o) => {
    const row = document.createElement("div");
    row.className = "order-row card";

    const orderStatusLabel =
      o.status === ORDER_STATUS.UNFILLED
        ? "Awaiting payment"
        : o.status === ORDER_STATUS.FILLED
          ? "Receipt uploaded"
          : o.status === ORDER_STATUS.COMPLETED
            ? "Active order"
            : o.status === ORDER_STATUS.DONE
              ? "Delivered"
              : "Cancelled";

    row.innerHTML = `
      <div class="or-left">
        <div class="or-title">${sanitize(
          o.productName || o.product || "Order",
        )}</div>
        <div class="or-sub">${orderStatusLabel} • ${new Date(
          o.createdAt || o.ts,
        ).toLocaleString()}</div>
      </div>

      <div class="or-right">
        <div class="or-price">TSh ${Number(o.price || 0).toLocaleString()}</div>
      </div>

    <div class="or-actions">
  <button
    class="btn btn-ghost sm"
    data-act="details"
  >
    Details
  </button>
</div>
    `;

    row.addEventListener("click", (e) => {
      const act = e.target?.dataset?.act;
      if (!act) return;

      if (act === "details") {
        openOrderDetails(o.id);
        return;
      }
    });

    box.appendChild(row);
  });
}

// Bind order filter buttons
document.querySelectorAll("[data-order]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll("[data-order]")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderOrders(btn.dataset.order);
  });
});

function openOrderDetails(orderId) {
  const o = findOrderById(orderId);
  if (!o) return showToast("Order not found.", "error");

  activeOrderDetailsId = orderId;

  const title = document.getElementById("orderModalTitle");
  const body = document.getElementById("orderModalBody");
  const saveBtn = document.getElementById("saveOrderUpdateBtn");

  if (title)
    title.textContent = `Order • ${o.productName || o.product || "NgoXi"}`;
  if (!body) return;

  const st = o.status || "unfilled";
  const badgeClass = st;

  const buyerName = o.buyerName || "—";
  const buyerCity = o.buyerCity || "—";
  const sellerCity = o.sellerCity || "—";

  const receiverName = o.receiverName || o.logistics?.receiverName || "—";
  const receiverPhone = o.receiverPhone || o.logistics?.receiverPhone || "—";
  const busCompany = o.busCompany || o.logistics?.busCompany || "—";
  const busStation = o.busStation || o.logistics?.busStation || "—";

  const receipt = o.receiptImage || o.payment?.receiptUrl || o.receipt || null;

  const isIntercity =
    o.type === "intercity" || busCompany !== "—" || busStation !== "—";

  //"Shipping updates will be enabled after the MongoDB shipping API is connected."
  const shippingEditable = false;
  const readOnly = st === "done";

  const busPlate = o.shipping?.plateNumber || o.logistics?.busPlate || "";
  const tripStatus =
    o.shipping?.tripStatus || o.logistics?.tripStatus || "pending";

  body.innerHTML = `
  <div class="od-page">
    <div class="od-topbar">
      <div>
        <div class="od-order-id">Order ID: ${sanitize(o.id || "—")}</div>
        <div class="od-order-date">${new Date(o.createdAt || Date.now()).toLocaleString()}</div>
      </div>
      <div class="od-badge ${badgeClass}">${statusLabel(st)}</div>
    </div>

    <div class="od-hero">
      <div class="od-hero-left">
        <div class="od-product">${sanitize(o.productName || o.product || "—")}</div>
        <div class="od-price">TSh ${Number(o.price || 0).toLocaleString()}</div>
      </div>
      <div class="od-hero-right">
        <div class="od-qty">Qty: ${Number(o.qty || 1)}</div>
        <div class="od-type">${isIntercity ? "Intercity delivery" : "Local / pickup"}</div>
      </div>
    </div>

    <div class="od-section">
      <div class="od-section-title">Buyer Details</div>
      <div class="od-grid od-grid-2">
        <div class="od-card"><span>Name</span><strong>${sanitize(buyerName)}</strong></div>
        <div class="od-card"><span>Buyer City</span><strong>${sanitize(buyerCity)}</strong></div>
        <div class="od-card"><span>Seller City</span><strong>${sanitize(sellerCity)}</strong></div>
        <div class="od-card"><span>Route</span><strong>${sanitize(sellerCity)} → ${sanitize(buyerCity)}</strong></div>
      </div>
    </div>

    ${
      isIntercity
        ? `
      <div class="od-section">
        <div class="od-section-title">Bus / Receiver Details</div>
        <div class="od-grid od-grid-2">
          <div class="od-card"><span>Bus Company</span><strong>${sanitize(busCompany)}</strong></div>
          <div class="od-card"><span>Bus Station</span><strong>${sanitize(busStation)}</strong></div>
          <div class="od-card"><span>Receiver Name</span><strong>${sanitize(receiverName)}</strong></div>
          <div class="od-card"><span>Receiver Phone</span><strong>${sanitize(receiverPhone)}</strong></div>
        </div>
      </div>
    `
        : ""
    }

    ${
      receipt
        ? `
      <div class="od-section">
        <div class="od-section-title">Payment Receipt</div>
        <div class="od-receipt-wrap">
          <img src="${receipt}" alt="Payment receipt" class="od-receipt-img" />
        </div>
      </div>
    `
        : `
      <div class="od-section">
        <div class="od-section-title">Payment Receipt</div>
        <div class="od-empty">No receipt uploaded yet.</div>
      </div>
    `
    }

    <div class="od-section">
      <div class="od-section-title">Shipping Update</div>
      <div class="od-grid od-grid-2">
        <label class="od-field">
          <span>Bus Plate Number</span>
          <input id="busPlateInput" type="text" value="${sanitize(busPlate)}" ${shippingEditable ? "" : "disabled"} />
        </label>

        <div class="od-field">
          <span>Trip Status</span>
          <div class="od-trip-pills">
            <button class="od-trip ${tripStatus === "pending" ? "active" : ""}" data-trip="pending" ${shippingEditable ? "" : "disabled"}>Pending</button>
            <button class="od-trip ${tripStatus === "on_the_way" ? "active" : ""}" data-trip="on_the_way" ${shippingEditable ? "" : "disabled"}>On the way</button>
            <button class="od-trip ${tripStatus === "arrived" ? "active" : ""}" data-trip="arrived" ${shippingEditable ? "" : "disabled"}>Arrived</button>
          </div>
        </div>
      </div>
      <div class="od-note">
        ${shippingEditable ? "Seller can update the plate number and trip status here." : readOnly ? "This order is completed and locked." : "Shipping becomes editable after payment is confirmed."}
      </div>
    </div>

  
  </div>
`;

  // Trip pills behavior (only if editable)
  body.querySelectorAll("[data-trip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!shippingEditable) return;
      body
        .querySelectorAll("[data-trip]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Save button only for completed
  if (saveBtn) {
    saveBtn.style.display = shippingEditable ? "inline-block" : "none";
  }

  openOrderModal();
}

function openOrderModal() {
  const m = document.getElementById("orderModal");
  if (m) m.setAttribute("aria-hidden", "false");
}
function closeOrderModal() {
  const m = document.getElementById("orderModal");
  if (m) m.setAttribute("aria-hidden", "true");
  activeOrderDetailsId = null;
}
function normalizeMoney(n) {
  const x = Number(n || 0);
  return isFinite(x) ? x : 0;
}

function renderOrderDetails(order = {}) {
  const buyer =
    order.buyerName || order.buyer?.name || order.customerName || "Buyer";

  const status = order.status || "pending";

  const items = order.items || order.cartItems || order.products || [];

  const total =
    normalizeMoney(order.total) ||
    normalizeMoney(order.amount) ||
    normalizeMoney(order.totalAmount) ||
    items.reduce(
      (s, it) =>
        s +
        normalizeMoney(it.price) * normalizeMoney(it.qty || it.quantity || 1),
      0,
    );

  const itemsHtml = items.length
    ? items
        .map((it) => {
          const name = it.name || it.title || "Item";
          const qty = it.qty ?? it.quantity ?? 1;
          const price = normalizeMoney(it.price);
          const line = price * normalizeMoney(qty);
          return `
            <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.08)">
              <div>
                <div style="font-weight:700">${name}</div>
                <div style="opacity:.75;font-size:13px">Qty: ${qty}</div>
              </div>
              <div style="font-weight:800">TSh ${line.toLocaleString()}</div>
            </div>
          `;
        })
        .join("")
    : `<div style="opacity:.7;padding:10px 0">No items found for this order.</div>`;

  return `
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">
      <div><b>Order:</b> ${order.id || order._id || "—"}</div>
      <div><b>Status:</b> ${status}</div>
      <div><b>Buyer:</b> ${buyer}</div>
    </div>

    <div style="margin-top:10px">
      <div style="font-weight:800;margin-bottom:6px">Items</div>
      ${itemsHtml}
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid rgba(0,0,0,.10)">
      <div style="font-weight:800">Total</div>
      <div style="font-size:18px;font-weight:900">TSh ${total.toLocaleString()}</div>
    </div>
  `;
}

document
  .querySelectorAll("[data-close-order]")
  .forEach((b) => b.addEventListener("click", closeOrderModal));

function makeOrder({
  productId,
  productName,
  price,
  buyerId,
  buyerName,
  buyerCity,
  sellerCity,
  type = "local", // "local" | "intercity"
  busCompany = "",
  busStation = "",
  receiverName = "",
  receiverPhone = "",
  chatId = "",
}) {
  return {
    id: `o${Date.now()}`,
    productId: productId || "",
    productName: productName || "NgoXi Order",
    price: Number(price || 0),

    buyerId: buyerId || "",
    buyerName: buyerName || "",
    buyerCity: buyerCity || "",
    sellerCity: sellerCity || "",

    type, // local | intercity

    // intercity only
    busCompany,
    busStation,
    receiverName,
    receiverPhone,

    receiptImage: null,

    status: ORDER_STATUS.UNFILLED,

    shipping: {
      plateNumber: "",
      tripStatus: "pending", // pending | on_the_way | arrived
    },

    createdAt: Date.now(),
    updatedAt: Date.now(),
    chatId: chatId || "",
  };
}

function getAllOrders() {
  return sellerOrdersState;
}

function attachSellerOrdersToConversations() {
  sellerChatState.conversations.forEach((conversation) => {
    const conversationId = String(conversation._id || conversation.id || "");

    const orders = sellerOrdersState.filter(
      (order) => String(order.conversationId || "") === conversationId,
    );

    conversation.orders = orders;
    conversation.orderCount = orders.length;

    /*
        Old seller UI sometimes expects
        one current orderId.
        Give it the newest non-finished order.
      */
    const activeOrder =
      orders.find(
        (order) =>
          order.status !== ORDER_STATUS.DONE &&
          order.status !== ORDER_STATUS.CANCELLED,
      ) ||
      orders[0] ||
      null;

    conversation.orderId = activeOrder?.id || null;

    conversation.orderState = activeOrder
      ? activeOrder.status === ORDER_STATUS.COMPLETED
        ? "completed"
        : "open"
      : null;
  });

  renderSellerConversationList();

  if (activeChatId) {
    renderChatMessages();
  }
  if (activeChatId) {
    renderSellerTransactionCenter();
  }
}

async function loadSellerOrders() {
  try {
    const response = await authorizedFetch(`${API_BASE}/api/orders?as=seller`);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Could not load seller orders");
    }

    sellerOrdersState = Array.isArray(data.orders)
      ? data.orders.map(normalizeSellerOrder)
      : [];

    attachSellerOrdersToConversations();

    updateOverview();

    const activeFilter =
      document.querySelector("[data-order].active")?.dataset?.order ||
      "unfilled";

    renderOrders(activeFilter);

    return sellerOrdersState;
  } catch (error) {
    console.error("❌ Failed loading seller orders:", error);

    sellerOrdersState = [];

    updateOverview();
    renderOrders("unfilled");

    return [];
  }
}

/*
  Temporary compatibility helper.

  Do NOT persist orders here.
  Real writes will go through /api/orders endpoints.
*/
function saveAllOrders(arr) {
  sellerOrdersState = Array.isArray(arr) ? arr : [];
}
function seedDevOrders() {
  const existing = getAllOrders();
  if (Array.isArray(existing) && existing.length) return;

  const seed = [
    {
      id: "ORD-1001",
      productId: "p-demo-1",
      productName: "Nike Air Max 90",
      price: 185000,
      buyerId: "b1",
      buyerName: "Ibrahim Musa",
      buyerCity: "Dar es Salaam",
      sellerCity: "Dar es Salaam",
      type: "local",
      busCompany: "",
      busStation: "",
      receiverName: "",
      receiverPhone: "",
      receiptImage: null,
      status: ORDER_STATUS.UNFILLED,
      shipping: {
        plateNumber: "",
        tripStatus: "pending",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chatId: "buyer1",
      qty: 1,
    },
    {
      id: "ORD-1002",
      productId: "p-demo-2",
      productName: "iPhone 13 Pro Max",
      price: 2100000,
      buyerId: "b2",
      buyerName: "Amina Yusuf",
      buyerCity: "Mbeya",
      sellerCity: "Dar es Salaam",
      type: "intercity",
      busCompany: "ABOOD",
      busStation: "Magufuli Bus Terminal",
      receiverName: "Amina Yusuf",
      receiverPhone: "0767123456",
      receiptImage: "../assets/logo.png",
      status: ORDER_STATUS.FILLED,
      shipping: {
        plateNumber: "",
        tripStatus: "pending",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chatId: "buyer1",
      qty: 1,
    },
    {
      id: "ORD-1003",
      productId: "p-demo-3",
      productName: "Samsung Smart TV",
      price: 1450000,
      buyerId: "b3",
      buyerName: "Kelvin James",
      buyerCity: "Mwanza",
      sellerCity: "Dar es Salaam",
      type: "intercity",
      busCompany: "Shabiby",
      busStation: "Ubungo",
      receiverName: "Kelvin James",
      receiverPhone: "0711223344",
      receiptImage: "../assets/logo.png",
      status: ORDER_STATUS.COMPLETED,
      shipping: {
        plateNumber: "T 345 ABC",
        tripStatus: "on_the_way",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chatId: "buyer1",
      qty: 1,
    },
  ];

  saveAllOrders(seed);
}
function findOrderById(id) {
  return getAllOrders().find((o) => o.id === id) || null;
}
function markOrderPaid(orderId, receiptDataUrl) {
  const all = getAllOrders();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;

  const o = all[idx];
  o.status = ORDER_STATUS.FILLED;
  o.receiptImage = receiptDataUrl || o.receiptImage || null;
  o.updatedAt = Date.now();

  all[idx] = o;
  saveAllOrders(all);
  return o;
}

function confirmOrder(orderId) {
  const all = getAllOrders();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;

  const o = all[idx];
  o.status = ORDER_STATUS.COMPLETED;
  if (!o.shipping) o.shipping = { plateNumber: "", tripStatus: "pending" };
  if (!o.shipping.tripStatus) o.shipping.tripStatus = "pending";
  o.updatedAt = Date.now();

  all[idx] = o;
  saveAllOrders(all);
  return o;
}

/* ---------- QR Generator ---------- */
function getSellerId() {
  // Your backend likely returns sellerId in JWT; for now store once at login.
  return localStorage.getItem("sellerId") || "demo123";
}
function generateQR() {
  const id = getSellerId();
  const url = `http://localhost:5000/store.html?sellerId=${encodeURIComponent(
    id,
  )}`;
  const imgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    url,
  )}`;
  const img = document.getElementById("qrImage");
  if (img) {
    img.src = imgUrl;
    img.alt = `QR for ${url}`;
  }
}
document.getElementById("regenQR")?.addEventListener("click", () => {
  generateQR();
  showToast("QR regenerated", "success");
});
document.getElementById("downloadQR")?.addEventListener("click", async () => {
  const img = document.getElementById("qrImage");
  if (!img?.src) return;
  const canvas = document.createElement("canvas");
  canvas.width = 220;
  canvas.height = 220;
  const ctx = canvas.getContext("2d");
  const tmp = new Image();
  tmp.crossOrigin = "anonymous";
  tmp.onload = () => {
    ctx.drawImage(tmp, 0, 0, 220, 220);
    const a = document.createElement("a");
    a.download = "NgoXi-Store-QR.png";
    a.href = canvas.toDataURL();
    a.click();
  };
  tmp.src = img.src;
});

/* ---------- Home Overview stats ---------- */
function updateOverview() {
  const orders = getAllOrders();

  const revenue = orders
    .filter(
      (order) =>
        order.mongoStatus === "payment-confirmed" ||
        order.mongoStatus === "preparing" ||
        order.mongoStatus === "ready" ||
        order.mongoStatus === "shipping" ||
        order.mongoStatus === "delivered",
    )
    .reduce((sum, order) => sum + Number(order.price || 0), 0);

  const ordersCount = orders.length;

  const revenueElement = document.getElementById("statRevenue");

  const ordersElement = document.getElementById("statOrders");

  if (revenueElement) {
    revenueElement.textContent = `TSh ${revenue.toLocaleString()}`;
  }

  if (ordersElement) {
    ordersElement.textContent = String(ordersCount);
  }
}
/* ---------- Messages tab: WhatsApp-like front-only chat ---------- */

let activeChatId = null;
let sellerTransactionOrderIndex = 0;
let sellerTransactionHidden = false;

/* =========================================================
   SELLER CHAT STATE

   This is temporary frontend state only.
   MongoDB remains the source of truth.
========================================================= */

const sellerChatState = {
  conversations: [],
  activeConversation: null,
  loading: false,
  filter: "all",
  search: "",
};

function findSellerConversation(id) {
  if (!id) return null;

  return (
    sellerChatState.conversations.find(
      (conversation) =>
        String(conversation._id || conversation.id || "") === String(id),
    ) || null
  );
}

function getActiveSellerConversation() {
  return findSellerConversation(activeChatId);
}

function getSellerConversationOrders() {
  const conversation = getActiveSellerConversation();

  if (!conversation) {
    return [];
  }

  return Array.isArray(conversation.orders) ? conversation.orders : [];
}

function getCurrentSellerOrder() {
  const orders = getSellerConversationOrders();

  if (!orders.length) {
    return null;
  }

  sellerTransactionOrderIndex = Math.max(
    0,
    Math.min(sellerTransactionOrderIndex, orders.length - 1),
  );

  return orders[sellerTransactionOrderIndex];
}

function sellerOrderStatusText(order) {
  const status = order?.mongoStatus || order?.status || "";

  switch (status) {
    case "placed":
    case "awaiting-payment":
    case "unfilled":
      return "Awaiting payment";

    case "receipt-uploaded":
    case "filled":
      return "Receipt uploaded";

    case "payment-confirmed":
      return "Payment confirmed";

    case "preparing":
      return "Preparing order";

    case "ready":
      return "Ready";

    case "shipping":
      return "Shipping";

    case "delivered":
    case "done":
      return "Delivered";

    case "cancelled":
      return "Cancelled";

    default:
      return "Order active";
  }
}

function renderSellerTransactionCenter() {
  const center = document.getElementById("sellerTransactionCenter");

  if (!center) {
    return;
  }

  const orders = getSellerConversationOrders();

  /*
    No active conversation or no orders:
    hide Transaction Center.
  */
  if (!activeChatId || !orders.length || sellerTransactionHidden) {
    center.hidden = true;
    return;
  }

  center.hidden = false;

  const order = getCurrentSellerOrder();

  if (!order) {
    center.hidden = true;
    return;
  }

  /* -------------------------
     ORDER COUNTER
  ------------------------- */

  const counter = document.getElementById("sellerOrderCounter");

  if (counter) {
    counter.textContent = `${sellerTransactionOrderIndex + 1} / ${orders.length}`;
  }

  /* -------------------------
     PRODUCT IMAGE
  ------------------------- */

  const image = document.getElementById("sellerTransactionProductImage");

  if (image) {
    image.src = order.productImage || "/assets/default-product.png";

    image.onerror = () => {
      image.src = "/assets/default-product.png";
    };
  }

  /* -------------------------
     ORDER ID
  ------------------------- */

  const orderId = document.getElementById("sellerTransactionOrderId");

  if (orderId) {
    orderId.textContent = `Order #${order.id || "—"}`;
  }

  /* -------------------------
     PRODUCT
  ------------------------- */

  const productName = document.getElementById("sellerTransactionProductName");

  if (productName) {
    productName.textContent = order.productName || "Product";
  }

  /* -------------------------
     VARIANT / SIZE / QTY
  ------------------------- */

  const variant = document.getElementById("sellerTransactionVariant");

  if (variant) {
    const pieces = [];

    if (order.variant) {
      pieces.push(`Variant: ${order.variant}`);
    }

    if (order.size) {
      pieces.push(`Size: ${order.size}`);
    }

    pieces.push(`Qty: ${order.quantity || order.qty || 1}`);

    variant.textContent = pieces.join(" • ");
  }

  /* -------------------------
     PRICE
  ------------------------- */

  const price = document.getElementById("sellerTransactionPrice");

  if (price) {
    price.textContent = `TSh ${Number(order.price || 0).toLocaleString()}`;
  }

  /* -------------------------
     ORDER STATUS
  ------------------------- */

  const status = document.getElementById("sellerTransactionStatus");

  if (status) {
    status.innerHTML = `
      <div class="ngx-order-progress-copy">

        <strong>
          ${sanitize(sellerOrderStatusText(order))}
        </strong>

        <small>
          Buyer:
          ${sanitize(order.buyerName || "Buyer")}
        </small>

      </div>
    `;
  }

  /* -------------------------
     ORDER ACTION
  ------------------------- */

  const orderActions = document.getElementById("sellerOrderActions");

  if (orderActions) {
    orderActions.innerHTML = `
      <button
        type="button"
        class="ngx-secondary-btn"
        id="sellerOpenOrderDetails"
      >
        View order details
      </button>
    `;

    document
      .getElementById("sellerOpenOrderDetails")
      ?.addEventListener("click", () => {
        openOrderDetails(order.id);
      });
  }

  renderSellerPaymentSlide(order);

  syncSellerTransactionArrows();
}

function renderSellerPaymentSlide(order) {
  const title = document.getElementById("sellerPaymentTitle");

  const amount = document.getElementById("sellerPaymentAmount");

  const product = document.getElementById("sellerPaymentProduct");

  const details = document.getElementById("sellerPaymentDetails");

  const receiptPanel = document.getElementById("sellerReceiptPanel");

  const receiptId = document.getElementById("sellerReceiptId");

  const confirmButton = document.getElementById("sellerConfirmPaymentBtn");

  const rejectButton = document.getElementById("sellerRejectPaymentBtn");

  const paymentStatus = order.payment?.status || "waiting";

  if (amount) {
    amount.textContent = `TSh ${Number(order.price || 0).toLocaleString()}`;
  }

  if (product) {
    product.textContent = order.productName || "Product";
  }

  if (title) {
    if (paymentStatus === "receipt-uploaded") {
      title.textContent = "Receipt uploaded";
    } else if (paymentStatus === "confirmed") {
      title.textContent = "Payment confirmed";
    } else if (paymentStatus === "rejected") {
      title.textContent = "Payment problem";
    } else {
      title.textContent = "Waiting for payment";
    }
  }

  if (details) {
    details.innerHTML = `
      <div>
        <small>Buyer</small>
        <strong>
          ${sanitize(order.buyerName || "Buyer")}
        </strong>
      </div>

      <div>
        <small>Receiver</small>
        <strong>
          ${sanitize(order.receiverName || order.buyerName || "—")}
        </strong>
      </div>

      <div>
        <small>Phone</small>
        <strong>
          ${sanitize(order.receiverPhone || "—")}
        </strong>
      </div>

      <div>
        <small>City</small>
        <strong>
          ${sanitize(order.buyerCity || "—")}
        </strong>
      </div>
    `;
  }

  const receiptUrl = order.payment?.receiptUrl || order.receiptImage || null;

  if (receiptPanel) {
    receiptPanel.hidden = !receiptUrl;
  }

  if (receiptId) {
    receiptId.textContent = receiptUrl ? `Order #${order.id}` : "";
  }

  /*
    Keep actions disabled until
    real backend payment endpoints exist.
  */
  if (confirmButton) {
    confirmButton.hidden = true;
  }

  if (rejectButton) {
    rejectButton.hidden = true;
  }

  const viewReceiptButton = document.getElementById("sellerViewReceiptBtn");

  if (viewReceiptButton) {
    viewReceiptButton.onclick = () => {
      if (!receiptUrl) {
        showToast("No receipt uploaded yet.", "info");
        return;
      }

      window.open(receiptUrl, "_blank", "noopener,noreferrer");
    };
  }
}

function syncSellerTransactionArrows() {
  const orders = getSellerConversationOrders();

  const previous = document.getElementById("sellerPrevOrder");

  const next = document.getElementById("sellerNextOrder");

  const disabled = orders.length <= 1;

  if (previous) {
    previous.disabled = disabled;
  }

  if (next) {
    next.disabled = disabled;
  }
}

document.getElementById("sellerPrevOrder")?.addEventListener("click", () => {
  const orders = getSellerConversationOrders();

  if (!orders.length) {
    return;
  }

  sellerTransactionOrderIndex =
    sellerTransactionOrderIndex === 0
      ? orders.length - 1
      : sellerTransactionOrderIndex - 1;

  renderSellerTransactionCenter();
});

document.getElementById("sellerNextOrder")?.addEventListener("click", () => {
  const orders = getSellerConversationOrders();

  if (!orders.length) {
    return;
  }

  sellerTransactionOrderIndex =
    (sellerTransactionOrderIndex + 1) % orders.length;

  renderSellerTransactionCenter();
});

function setSellerTransactionTab(tab) {
  const ordersTab = document.getElementById("sellerOrdersTab");

  const paymentTab = document.getElementById("sellerPaymentTab");

  const ordersSlide = document.getElementById("sellerOrdersSlide");

  const paymentSlide = document.getElementById("sellerPaymentSlide");

  const paymentActive = tab === "payment";

  ordersTab?.classList.toggle("active", !paymentActive);

  paymentTab?.classList.toggle("active", paymentActive);

  ordersSlide?.classList.toggle("active", !paymentActive);

  paymentSlide?.classList.toggle("active", paymentActive);
}

document.getElementById("sellerOrdersTab")?.addEventListener("click", () => {
  setSellerTransactionTab("orders");
});

document.getElementById("sellerPaymentTab")?.addEventListener("click", () => {
  setSellerTransactionTab("payment");
});

document
  .getElementById("sellerToggleTransaction")
  ?.addEventListener("click", () => {
    sellerTransactionHidden = !sellerTransactionHidden;

    const button = document.getElementById("sellerToggleTransaction");

    if (button) {
      button.textContent = sellerTransactionHidden
        ? "Show transaction card"
        : "Hide transaction card";
    }

    renderSellerTransactionCenter();

    closeChatOptions();
  });

function normalizeSellerConversation(conversation = {}) {
  const buyer = conversation.buyer || {};

  return {
    ...conversation,

    id: String(conversation._id || conversation.id || ""),

    name: buyer.name || conversation.name || "Buyer",

    phone:
      buyer?.buyerProfile?.contact?.phone ||
      buyer.phone ||
      conversation.phone ||
      "",

    avatar:
      buyer?.buyerProfile?.avatar?.url ||
      buyer.avatar ||
      buyer.profileImage ||
      conversation.avatar ||
      "/assets/default-avatar.jpeg",

    messages: Array.isArray(conversation.messages)
      ? conversation.messages.map((message) => {
          const senderRole = message.senderRole || message.from || "";

          return {
            ...message,

            senderRole,

            from: senderRole,

            text: message.text || "",

            image: message.image || "",

            ts: message.createdAt || message.ts || Date.now(),
          };
        })
      : [],
  };
}

async function loadSellerConversations() {
  const listEl = document.getElementById("sellerConversationList");

  const emptyEl = document.getElementById("sellerChatEmpty");

  if (!listEl) return;

  sellerChatState.loading = true;

  listEl.innerHTML = `
    <div class="ngx-chat-list-empty">
      Loading conversations...
    </div>
  `;

  try {
    const response = await authorizedFetch(`${API_BASE}/api/chats?as=seller`);

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`);
    }

    const data = await response.json();
    console.table(
      (data.conversations || []).map((chat) => ({
        chatId: chat._id,
        buyerId: chat.buyer?._id,
        buyerName: chat.buyer?.name,
        sellerId: chat.seller?._id,
        sellerName: chat.seller?.name,
        messages: chat.messages?.length || 0,
      })),
    );

    const rawConversations = Array.isArray(data)
      ? data
      : data.conversations || [];

    sellerChatState.conversations = rawConversations.map(
      normalizeSellerConversation,
    );
    attachSellerOrdersToConversations();

    sellerChatState.loading = false;

    renderSellerConversationList();

    if (emptyEl) {
      emptyEl.hidden = sellerChatState.conversations.length > 0;
    }
  } catch (error) {
    console.error("❌ Failed to load seller conversations:", error);

    sellerChatState.loading = false;

    sellerChatState.conversations = [];

    listEl.innerHTML = `
      <div class="ngx-chat-list-empty">
        Could not load conversations.
      </div>
    `;

    if (emptyEl) {
      emptyEl.hidden = true;
    }
  }
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlAttribute(value = "") {
  return escapeHtml(value);
}

function getConversationPreview(conversation) {
  const messages = conversation.messages || [];

  const last = messages[messages.length - 1];

  if (last?.text) {
    return last.text;
  }

  if (last?.image) {
    return "📷 Photo";
  }

  return "Conversation started";
}

function formatSellerChatTime(timestamp) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function renderSellerConversationList() {
  const listEl = document.getElementById("sellerConversationList");

  if (!listEl) return;

  const search = sellerChatState.search.trim().toLowerCase();

  let conversations = [...sellerChatState.conversations];

  if (search) {
    conversations = conversations.filter((conversation) => {
      const buyerName = conversation?.buyer?.name || "Buyer";

      return buyerName.toLowerCase().includes(search);
    });
  }

  if (sellerChatState.filter === "unread") {
    conversations = conversations.filter(
      (conversation) => Number(conversation.unreadCount || 0) > 0,
    );
  }

  if (sellerChatState.filter === "orders") {
    conversations = conversations.filter(
      (conversation) =>
        Number(conversation.orderCount || conversation.orders?.length || 0) > 0,
    );
  }

  conversations.sort(
    (a, b) =>
      new Date(b.lastMessageAt || b.updatedAt || 0) -
      new Date(a.lastMessageAt || a.updatedAt || 0),
  );

  if (!conversations.length) {
    listEl.innerHTML = `
      <div class="ngx-chat-list-empty">
        No conversations found.
      </div>
    `;

    return;
  }

  listEl.innerHTML = conversations
    .map((conversation) => {
      const buyer = conversation.buyer || {};

      const buyerName = buyer.name || "Buyer";

      const avatar =
        buyer.avatar || buyer.profileImage || "../assets/default-avatar.jpeg";

      const lastMessage = getConversationPreview(conversation);

      const time = formatSellerChatTime(
        conversation.lastMessageAt || conversation.updatedAt,
      );

      const active =
        String(activeChatId || "") === String(conversation._id || "");

      const unread = Number(conversation.unreadCount || 0);

      return `
          <div
            class="ngx-conversation ${active ? "active" : ""}"
            data-conversation-id="${conversation._id}"
          >

            <img
              class="ngx-conversation-avatar"
              src="${escapeHtmlAttribute(avatar)}"
              alt=""
            >

            <div class="ngx-conversation-info">

              <div class="ngx-conversation-top">

                <strong>
                  ${escapeHtml(buyerName)}
                </strong>

                <time>
                  ${time}
                </time>

              </div>

              <div class="ngx-conversation-preview">
                ${escapeHtml(lastMessage)}
              </div>

            </div>

            ${
              unread > 0
                ? `
                  <span class="ngx-unread-count">
                    ${unread > 99 ? "99+" : unread}
                  </span>
                `
                : ""
            }

          </div>
        `;
    })
    .join("");

  listEl.querySelectorAll(".ngx-conversation").forEach((row) => {
    row.addEventListener("click", () => {
      const conversationId = row.dataset.conversationId;

      openSellerConversation(conversationId);
    });
  });

  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

async function openSellerConversation(conversationId) {
  if (!conversationId) {
    return;
  }

  try {
    const response = await authorizedFetch(
      `${API_BASE}/api/chats/${conversationId}`,
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Could not open conversation");
    }

    if (!data.conversation) {
      throw new Error("Conversation was not returned");
    }

    const conversation = normalizeSellerConversation(data.conversation);

    /*
      Replace the lightweight conversation
      from GET /api/chats with the complete one
      from GET /api/chats/:id.
    */

    const index = sellerChatState.conversations.findIndex(
      (item) =>
        String(item._id || item.id) ===
        String(conversation._id || conversation.id),
    );

    if (index >= 0) {
      /*
    Preserve MongoDB order attachments
    when replacing the lightweight chat
    with the full conversation.
  */
      const previous = sellerChatState.conversations[index];

      conversation.orders = Array.isArray(previous.orders)
        ? previous.orders
        : [];

      conversation.orderCount = conversation.orders.length;

      conversation.orderId =
        previous.orderId || conversation.orders[0]?.id || null;

      conversation.orderState = previous.orderState || null;

      sellerChatState.conversations[index] = conversation;
    } else {
      sellerChatState.conversations.unshift(conversation);
    }

    /*
  Reattach from sellerOrdersState as an
  extra source-of-truth safeguard.
*/
    attachSellerOrdersToConversations();

    const activeConversation = findSellerConversation(conversation.id);

    sellerChatState.activeConversation = activeConversation || conversation;

    setActiveChat(conversation.id);

    renderSellerConversationList();
  } catch (error) {
    console.error("❌ Could not open seller conversation:", error);

    showToast(error.message || "Could not open conversation", "error");
  }
}

function initSellerConversationControls() {
  const searchInput = document.getElementById("sellerChatSearch");

  const refreshBtn = document.getElementById("sellerRefreshChats");

  const filterButtons = document.querySelectorAll("[data-seller-chat-filter]");

  searchInput?.addEventListener("input", () => {
    sellerChatState.search = searchInput.value || "";

    renderSellerConversationList();
  });

  refreshBtn?.addEventListener("click", () => {
    loadSellerConversations();
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((item) => item.classList.remove("active"));

      button.classList.add("active");

      sellerChatState.filter = button.dataset.sellerChatFilter || "all";

      renderSellerConversationList();
    });
  });
}

// ================================
// PHASE 2.4 — INCOMING ORDER BRIDGE
// Seller side receives payloads (buyer side will send later)
// ================================

function ensureChatForBuyer(buyerId, buyerName) {
  // Try find existing chat
  let chat = sellerChatState.conversations.find((c) => c.buyerId === buyerId);

  if (!chat) {
    // Create new chat
    chat = {
      id: `chat_${buyerId || Date.now()}`,
      buyerId: buyerId || "",
      name: buyerName || "Buyer",
      isSupport: false,
      phone: "",

      // order linking
      orderId: null,
      orderState: null,

      lastMessage: "New chat started",
      lastTs: Date.now(),
      lastKind: "order",

      messages: [],
    };
    sellerChatState.conversations.push(chat);
  }

  return chat;
}

// Creates an order UNFILLED and links it to a chat.
// payload should include local/intercity info.
function receiveIncomingOrder(payload) {
  if (!payload) return;

  const buyerId = payload.buyerId || "";
  const buyerName = payload.buyerName || "Buyer";
  const buyerCity = payload.buyerCity || "";
  const sellerCity = payload.sellerCity || "";

  const chat = ensureChatForBuyer(buyerId, buyerName);

  // If chat already has an active order, do not create duplicate
  if (chat.orderId) {
    const existing = findOrderById(chat.orderId);
    if (existing && existing.status !== "done") {
      chat.orderState = "open";
      loadSellerConversations();
      return existing;
    }
  }

  const o = makeOrder({
    productId: payload.productId || "",
    productName: payload.productName || "NgoXi Order",
    price: payload.price || 0,

    buyerId,
    buyerName,
    buyerCity,
    sellerCity,

    type: payload.type || "local",

    busCompany: payload.busCompany || "",
    busStation: payload.busStation || "",
    receiverName: payload.receiverName || "",
    receiverPhone: payload.receiverPhone || "",

    chatId: chat.id,
  });

  const all = getAllOrders();
  all.unshift(o);
  saveAllOrders(all);

  // Link chat to order + set red dot
  chat.orderId = o.id;
  chat.orderState = "open";
  chat.lastKind = "order";
  chat.lastMessage = `New order: ${o.productName} • TSh ${Number(o.price).toLocaleString()}`;
  chat.lastTs = Date.now();

  addSystemMessage(
    chat.id,
    `New order created (${o.type === "intercity" ? "Intercity" : "Local"}). Status: Awaiting payment.`,
    "order",
  );

  // Refresh UI
  updateOverview();
  renderOrders("unfilled");
  loadSellerConversations();

  return o;
}

// Called after buyer uploads receipt.
// Sets order to FILLED + attaches receipt image.
function receiveReceiptUploaded(payload) {
  if (!payload) return;

  const orderId = payload.orderId;
  const receipt = payload.receiptImage; // dataURL or url
  const productName = payload.productName || "Order";

  if (!orderId || !receipt) return;

  const updated = markOrderPaid(orderId, receipt);
  if (!updated) return;

  // Update chat indicator
  const chat = sellerChatState.conversations.find(
    (conversation) =>
      String(conversation._id || conversation.id || "") ===
      String(activeChatId || ""),
  );
  if (chat) {
    chat.orderState = "open"; // still active until done
    chat.lastKind = "order";
    chat.lastMessage = `Receipt uploaded • ${productName}`;
    chat.lastTs = Date.now();

    addSystemMessage(
      chat.id,
      `Buyer uploaded receipt. Status: Waiting seller confirmation.`,
      "order",
    );
  }

  updateOverview();
  renderOrders("filled");
  loadSellerConversations();
}

// Optional helper when seller confirms (standardized)
function receiveSellerConfirm(orderId) {
  const updated = confirmOrder(orderId);
  if (!updated) return;

  const chat = sellerChatState.conversations.find(
    (c) => c.orderId === orderId || c.id === updated.chatId,
  );
  if (chat) {
    chat.orderState = "completed"; // 🟠
    chat.lastKind = "order";
    chat.lastMessage = "Payment confirmed • Active shipping";
    chat.lastTs = Date.now();

    addSystemMessage(
      chat.id,
      "Seller confirmed payment. Active shipping.",
      "order",
    );
  }

  updateOverview();
  renderOrders("completed");
  loadSellerConversations();
}
// DEV TEST (run in console)
// receiveIncomingOrder({ type:"intercity", buyerId:"b1", buyerName:"Asha", buyerCity:"Mbeya", sellerCity:"Dar", productId:"p1", productName:"iPhone 13", price:850000, busCompany:"ABOOD", busStation:"Magufuli", receiverName:"Asha John", receiverPhone:"0756xxxxxx" })
window.receiveIncomingOrder = receiveIncomingOrder;
window.receiveReceiptUploaded = receiveReceiptUploaded;
window.receiveSellerConfirm = receiveSellerConfirm;

// Builds/refreshes the pinned card content for a chat based on order status
function buildPinnedPaymentCard(chat) {
  if (!chat) return null;

  const orderId = chat.orderId || chat.paymentCard?.orderId;

  if (!orderId) {
    return null;
  }

  const order = findOrderById(orderId);

  if (!order) {
    return null;
  }

  if (order.status !== "unfilled" && order.status !== "filled") {
    return null;
  }

  const paymentMethods = Array.isArray(sellerProfileState.paymentMethods)
    ? sellerProfileState.paymentMethods.filter(
        (method) => method && method.active !== false,
      )
    : [];

  const seller = sellerProfileState.seller || {};

  const sellerPhone = seller?.sellerProfile?.contact?.phone || "";

  if (!paymentMethods.length) {
    return {
      orderId: order.id,

      productName: order.productName || order.product || "Product",

      totalPrice: order.price || 0,

      methods: "No payment method available",

      payNumber: "",

      phone: sellerPhone,

      note: "Add a payment method in Me → Settings → Payment Info.",

      receipt: order.receiptImage || null,
    };
  }

  const methodsText = paymentMethods
    .map(
      (method) => method.provider || method.label || method.type || "Payment",
    )
    .join(" • ");

  const numbersText = paymentMethods
    .map((method) => {
      const provider = method.provider || method.label || "";

      const number = method.number || method.accountNumber || "";

      if (!number) {
        return "";
      }

      return provider ? `${provider}: ${number}` : number;
    })
    .filter(Boolean)
    .join(" | ");

  const notesText = paymentMethods
    .map((method) => method.note || method.instructions || "")
    .filter(Boolean)
    .join(" • ");

  return {
    orderId: order.id,

    productName: order.productName || order.product || "Product",

    totalPrice: order.price || 0,

    methods: methodsText,

    payNumber: numbersText,

    phone: sellerPhone,

    note: notesText,

    paymentMethods,

    receipt: order.receiptImage || null,
  };
}
function setActiveChat(id) {
  activeChatId = id;
  sellerTransactionOrderIndex = 0;

  const chat = findSellerConversation(id);
  const emptyState = document.getElementById("sellerConversationEmpty");

  if (emptyState) {
    emptyState.hidden = Boolean(chat);

    emptyState.style.display = chat ? "none" : "";
  }
  const titleElement = document.getElementById("sellerBuyerName");
  const presenceElement = document.getElementById("sellerBuyerPresence");
  const headerImage = document.getElementById("sellerBuyerAvatar");
  if (titleElement) {
    titleElement.textContent = chat?.name || "Select a contact";
  }

  if (presenceElement) {
    presenceElement.textContent = chat?.isSupport ? "NgoXi support" : "online";
  }

  if (headerImage) {
    headerImage.src =
      chat?.profilePhoto || chat?.avatar || "/assets/default-avatar.jpeg";

    headerImage.style.display = "block";

    headerImage.onerror = () => {
      headerImage.src = "/assets/default-avatar.jpeg";
    };
  }

  renderSellerTransactionCenter();
  renderChatMessages();
  syncChatOptions();

  // On phones, opening a contact replaces the contact list
  document.querySelector(".chat-layout")?.classList.add("conversation-open");
}

function getInitials(fullName = "") {
  return (
    String(fullName)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "S"
  );
}

function renderChatMessages() {
  const body = document.getElementById("sellerChatMessages");

  if (!body) {
    console.warn("sellerChatMessages container missing");
    return;
  }

  body.innerHTML = "";

  const chat = sellerChatState.conversations.find(
    (conversation) =>
      String(conversation._id || conversation.id || "") ===
      String(activeChatId || ""),
  );

  if (!chat) {
    body.innerHTML = `
      <div class="muted">
        Select a conversation to start chatting.
      </div>
    `;
    return;
  }

  chat.messages.forEach((m) => {
    const div = document.createElement("div");
    const messageRole = m.senderRole || m.from || "";

    let cls = "bubble";

    if (messageRole === "seller") {
      cls += " seller";
    } else if (messageRole === "buyer") {
      cls += " buyer";
    } else {
      cls += " system";
    }

    div.className = cls;
    const timeHTML = m.ts
      ? `
    <div class="bubble-meta">
      <span>${formatTime(m.ts)}</span>

      ${messageRole === "seller" ? `<span class="message-ticks">✓✓</span>` : ""}
    </div>
  `
      : "";

    div.innerHTML = `
  ${
    m.text
      ? `
        <div class="bubble-text">
          ${sanitize(m.text)}
        </div>
      `
      : ""
  }

  ${
    m.image
      ? `
        <img
          class="chat-message-image"
          src="${sanitize(m.image)}"
          alt="Chat attachment"
        />
      `
      : ""
  }

  ${timeHTML}
`;
    body.appendChild(div);
  });

  body.scrollTop = body.scrollHeight;
}
function addMessage(chatId, from, text) {
  const chat = findSellerConversation(chatId);
  if (!chat) return;
  const now = Date.now();
  const msg = { from, text, ts: now, kind: "message" };
  chat.messages.push(msg);
  chat.lastMessage = text;
  chat.lastTs = now;
  chat.lastKind = "message";
  loadSellerConversations();
}

function addSystemMessage(chatId, text, kind = "system") {
  const chat = findSellerConversation(chatId);
  if (!chat) return;
  const now = Date.now();
  chat.messages.push({ from: "system", text, ts: now, kind });
  chat.lastMessage = text;
  chat.lastTs = now;
  chat.lastKind = kind === "order" ? "order" : "message";
  loadSellerConversations();
}

async function sendSellerMessage(text) {
  const cleanText = String(text || "").trim();

  if (!cleanText) {
    return null;
  }

  const chat = findSellerConversation(activeChatId);

  if (!chat) {
    throw new Error("Select a conversation first");
  }

  const conversationId = chat._id || chat.id;

  if (!conversationId) {
    throw new Error("Conversation ID is missing");
  }

  const response = await authorizedFetch(
    `${API_BASE}/api/chats/${conversationId}/messages`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        text: cleanText,
      }),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Could not send message");
  }

  if (!data.message) {
    throw new Error("Server did not return the saved message");
  }

  const message = {
    ...data.message,

    senderRole: data.message.senderRole || "seller",

    from: data.message.senderRole || "seller",

    text: data.message.text || cleanText,

    image: data.message.image || "",

    ts: data.message.createdAt || Date.now(),
  };

  chat.messages = Array.isArray(chat.messages) ? chat.messages : [];

  chat.messages.push(message);

  chat.lastMessageAt = message.createdAt || new Date().toISOString();

  sellerChatState.activeConversation = chat;

  renderChatMessages();

  renderSellerConversationList();

  return message;
}

// Send message button
document
  .getElementById("sellerSendMessageBtn")
  ?.addEventListener("click", async () => {
    const input = document.getElementById("sellerMessageInput");

    const button = document.getElementById("sellerSendMessageBtn");

    const text = input?.value?.trim();

    if (!text || !activeChatId) {
      return;
    }

    try {
      if (button) {
        button.disabled = true;
      }

      await sendSellerMessage(text);

      if (input) {
        input.value = "";
        input.focus();
      }
    } catch (error) {
      console.error("❌ Seller message failed:", error);

      showToast(error.message || "Message could not be sent", "error");
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  });
// Send with Enter
document
  .getElementById("sellerMessageInput")
  ?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      document.getElementById("sellerSendMessageBtn")?.click();
    }
  });

function closeChatOptions() {
  const menu = document.getElementById("sellerChatOptionsMenu");

  const button = document.getElementById("sellerChatOptionsBtn");

  if (menu) {
    menu.hidden = true;
  }

  if (button) {
    button.setAttribute("aria-expanded", "false");
  }
}

function syncChatOptions() {
  const button = document.getElementById("sellerChatOptionsBtn");

  if (!button) {
    return;
  }

  button.disabled = !findSellerConversation(activeChatId);
}

document
  .getElementById("sellerChatOptionsBtn")
  ?.addEventListener("click", (event) => {
    event.stopPropagation();

    const menu = document.getElementById("sellerChatOptionsMenu");

    if (!menu) {
      return;
    }

    menu.hidden = !menu.hidden;

    event.currentTarget.setAttribute("aria-expanded", String(!menu.hidden));

    syncChatOptions();
  });
// Close options when clicking elsewhere
document.addEventListener("click", (event) => {
  if (!event.target.closest(".chat-options-wrap")) {
    closeChatOptions();
  }
});

// Mobile: return to conversation list
document
  .getElementById("sellerMobileChatBack")
  ?.addEventListener("click", () => {
    document
      .querySelector(".chat-layout")
      ?.classList.remove("conversation-open");

    closeChatOptions();
  });
// CALL BUTTON — opens device dialer using the stored phone number
document.getElementById("sellerCallBuyer")?.addEventListener("click", () => {
  closeChatOptions();
  if (!activeChatId) {
    showToast("Select a contact first.", "error");
    return;
  }

  const chat = findSellerConversation(activeChatId);
  if (!chat || !chat.phone) {
    showToast("No phone number available for this contact.", "error");
    return;
  }

  // Out-of-web call via device dialer
  window.location.href = `tel:${chat.phone}`;

  // If in the future you add in-web calling (WebRTC), you can:
  // - open a custom call modal
  // - or redirect to your /call?room=... page instead
});

// Refresh contacts list
document.getElementById("refreshContacts")?.addEventListener("click", () => {
  loadSellerConversations();
});

// Initial chat render
if (window.matchMedia("(max-width: 760px)").matches) {
  // WhatsApp mobile opens on the chat list
  activeChatId = null;
  loadSellerConversations();

  document.querySelector(".chat-layout")?.classList.remove("conversation-open");
} else {
  activeChatId = null;

  renderChatMessages();
}

const avatar = document.createElement("div");
avatar.className = "contact-avatar";

const seller = sellerProfileState?.seller || {};

const dp = seller?.sellerProfile?.avatar?.url || "";

if (dp) {
  avatar.innerHTML = `
    <img
      src="${dp}"
      alt=""
    />
  `;
} else {
  const displayName = seller.storeName || seller.name || "Seller";

  avatar.textContent = getInitials(displayName);
}

/* ---------- Logout ---------- */
function logoutSeller() {
  try {
    localStorage.removeItem("token");
    sessionStorage.clear();
  } catch {}
  window.location.href = "/auth.html";
}

(function wireStatDblClicks() {
  const revenueCard = document.querySelector('.stat.card[data-stat="revenue"]');
  const ordersCard = document.querySelector('.stat.card[data-stat="orders"]');
  const productsCard = document.querySelector(
    '.stat.card[data-stat="products"]',
  );

  // helper to simulate tab / subtab clicks
  function openMeOrders() {
    const meBtn = document.querySelector('.nav-btn[data-view="me"]');
    if (meBtn) meBtn.click();
    const ordersPill = document.querySelector('.me-pill[data-sub="orders"]');
    if (ordersPill) ordersPill.click();
  }

  function openPostedProducts() {
    const prodBtn = document.querySelector('.nav-btn[data-view="products"]');
    if (prodBtn) prodBtn.click();
    const postedTab = document.querySelector(
      '.prod-tab-btn[data-prodtab="posted"]',
    );
    if (postedTab) postedTab.click();
  }

  if (ordersCard) {
    ordersCard.addEventListener("dblclick", openMeOrders);
  }
  if (productsCard) {
    productsCard.addEventListener("dblclick", openPostedProducts);
  }
  // revenue: you might later open a detailed revenue page
})();

/* ---------- Refresh all products views after posting / editing ---------- */
async function refreshProductsEverywhere() {
  // refresh posted grid
  await loadMyProducts();
  // refresh "Recently added" + active product count on Home
  await loadProductsForHome();
  // re-animate stats so it feels alive
  animateStatsFromDom();
}

/* ---------- INIT ---------- */
async function initDashboard() {
  await renderPlanLine();

  await loadProductsForHome();

  await loadSellerOrders();

  animateStatsFromDom();

  generateQR();
}
function animateNumber(el, target, prefix = "", duration = 700) {
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  const cleanTarget = Number(target) || 0;

  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = Math.floor(start + (cleanTarget - start) * progress);
    el.textContent = prefix
      ? `${prefix} ${value.toLocaleString()}`
      : value.toLocaleString();
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function animateStatsFromDom() {
  const revenueEl = document.getElementById("statRevenue");
  const ordersEl = document.getElementById("statOrders");
  const prodEl = document.getElementById("statProducts");

  if (revenueEl) {
    const txt = revenueEl.textContent.replace(/[^\d]/g, "");
    animateNumber(revenueEl, txt || 0, "TSh");
  }
  if (ordersEl) {
    const txt = ordersEl.textContent.replace(/[^\d]/g, "");
    animateNumber(ordersEl, txt || 0);
  }
  if (prodEl) {
    const txt = prodEl.textContent.replace(/[^\d]/g, "");
    animateNumber(prodEl, txt || 0);
  }
}

function printLabel(order) {
  if (!order) {
    showToast("No order selected for printing.", "error");
    return;
  }

  const label = document.getElementById("printLabel");
  if (!label) {
    showToast("Print label template not found.", "error");
    return;
  }

  const selectedSize =
    document.getElementById("labelSizeSelect")?.value || "80x50";

  const LABEL_SIZES = {
    "80x50": { width: 80, height: 50 },
    "70x60": { width: 70, height: 60 },
    "100x80": { width: 100, height: 80 },
    "60x40": { width: 60, height: 40 },
    "50x30": { width: 50, height: 30 },
    "90x60": { width: 90, height: 60 },
    "75x50": { width: 75, height: 50 },
    "100x50": { width: 100, height: 50 },
    "80x80": { width: 80, height: 80 },
    "60x60": { width: 60, height: 60 },
    "50x50": { width: 50, height: 50 },
    "40x30": { width: 40, height: 30 },
  };

  const size = LABEL_SIZES[selectedSize] || LABEL_SIZES["80x50"];

  document.documentElement.style.setProperty(
    "--print-label-width",
    `${size.width}mm`,
  );
  document.documentElement.style.setProperty(
    "--print-label-height",
    `${size.height}mm`,
  );

  const packageNo =
    order.packageNo ||
    `PKG-${String(order.id || "")
      .replace(/\s+/g, "")
      .slice(-5)}` ||
    "________";

  label.innerHTML = `
    <div class="pl-wrap">
      <div class="pl-header">
        <div class="pl-logo">NgoXi</div>
        <div class="pl-order">#${sanitize(order.id || "—")}</div>
      </div>

      <div class="pl-product">
        <div class="pl-product-name">${sanitize(order.productName || "Product")}</div>
        <div class="pl-price">TSh ${Number(order.price || 0).toLocaleString()}</div>
      </div>

      <div class="pl-section">
        <div class="pl-title">Receiver</div>
        <div>${sanitize(order.receiverName || order.buyerName || "—")}</div>
        <div>${sanitize(order.receiverPhone || "—")}</div>
        <div>${sanitize(order.buyerCity || "—")} - ${sanitize(order.busStation || "—")}</div>
      </div>

      <div class="pl-section">
        <div class="pl-title">Transport</div>
        <div>Bus: ${sanitize(order.busCompany || "—")}</div>
        <div>Plate: ${sanitize(order.shipping?.plateNumber || "________")}</div>
        <div>Date: ${new Date().toLocaleDateString()}</div>
        <div class="pl-space"></div>
        <div>Package No: ${sanitize(packageNo)}</div>
      </div>

      <div class="pl-footer">NgoXi Logistics</div>
    </div>
  `;

  window.print();
}
initDashboard();
initSellerConversationControls();
loadSellerConversations();

if (window.lucide?.createIcons) {
  window.lucide.createIcons();
}
