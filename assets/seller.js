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

const API_BASE = "http://localhost:5000/api";
// Generic remote placeholder (only used if backend sends no image)
const PLACEHOLDER = "https://via.placeholder.com/400x400?text=NgoXi";
const PROFILE_PHOTO_KEY = "ngoxi_profile_photo";

/* ----------------------------------------------------------
   1) SAFE BOOT: splash + token + expose helpers
   ---------------------------------------------------------- */
window.addEventListener("load", () => {
  console.log("✅ Seller.js initialized");

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // If no token, go back to auth
  if (!token) {
    alert("Session expired ⚠️ Please log in again.");
    window.location.href = "../views/auth.html";
    return;
  }

  // Splash fade-out then show dashboard
  const splash = document.getElementById("splash");
  setTimeout(() => {
    if (splash) splash.remove();
    const dash = document.getElementById("dashboard");
    if (dash) dash.style.display = "block";
  }, 800);

  // Header store name
  const hdr = document.getElementById("storeNameHeader");
  if (hdr) hdr.textContent = user.storeName || "Your Store";
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

const PAYMENT_KEY = "ngoxi_payment_info";

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
    const r = await authorizedFetch(`${API_BASE}/seller/my-products`);
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
    const res = await authorizedFetch(`${API_BASE}/seller/my-products`);
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
      // Switch tab to My Products
      switchTab("products");

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

/* ----------------------------------------------------------
   8) POST FORM: Variants + Sizes UI helpers
   ---------------------------------------------------------- */
// SIZES
let sizesData = []; // [{ size, priceDiff }, ...]
function renderSizes() {
  const list = document.getElementById("sizesList");
  if (!list) return;
  list.innerHTML = "";
  sizesData.forEach((s, i) => {
    const el = document.createElement("div");
    el.className = "size-chip";
    el.innerHTML = `
      <span><strong>${sanitize(s.size)}</strong>${
      s.priceDiff ? ` · +TSh ${Number(s.priceDiff).toLocaleString()}` : ""
    }</span>
      <button class="chip-remove" data-i="${i}" title="Remove">✖</button>
    `;
    list.appendChild(el);
  });
  list.querySelectorAll(".chip-remove").forEach((b) =>
    b.addEventListener("click", () => {
      sizesData.splice(Number(b.dataset.i), 1);
      renderSizes();
    })
  );
}
document.getElementById("addSizeBtn")?.addEventListener("click", () => {
  document.getElementById("sizeNameInput").value = "";
  document.getElementById("sizeDiffInput").value = "0";
  document.getElementById("sizeModal")?.setAttribute("aria-hidden", "false");
});
document
  .querySelectorAll("[data-close-size]")
  .forEach((btn) =>
    btn.addEventListener("click", () =>
      document.getElementById("sizeModal")?.setAttribute("aria-hidden", "true")
    )
  );
document.getElementById("sizeSaveBtn")?.addEventListener("click", () => {
  const name = (document.getElementById("sizeNameInput").value || "").trim();
  const diff = Number(document.getElementById("sizeDiffInput").value || 0);
  if (!name) return showToast("Please enter a size.", "error");
  sizesData.push({ size: name, priceDiff: isNaN(diff) ? 0 : diff });
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

function loadProfilePhoto() {
  const img = document.getElementById("profilePreview");
  if (!img) return;

  const saved = localStorage.getItem(PROFILE_PHOTO_KEY);
  if (saved) {
    img.src = saved;
  }
}
loadProfilePhoto();

// Collectors used by POST
// We collect BOTH variant data and attached image files,
// so backend can map gallery[index] -> that variant.
function collectVariantsAndFiles() {
  const rows = [...document.querySelectorAll("#variants .variant-row")];

  const variants = [];
  const files = []; // array of File objects, one per variant that has an image

  rows.forEach((r) => {
    const name = r.querySelector(".v-name")?.value?.trim();
    if (!name) return;

    const price = Number(r.querySelector(".v-price")?.value || 0);
    const imgInput = r.querySelector(".v-image");
    let imageIndex = null;

    if (imgInput && imgInput.files && imgInput.files[0]) {
      imageIndex = files.length;
      files.push(imgInput.files[0]);
    }

    variants.push({
      name,
      price: Number.isFinite(price) && price > 0 ? price : 0,
      imageIndex, // null if no image, or index in gallery[]
    });
  });

  return { variants, files };
}

function collectSizesArray() {
  return Array.isArray(sizesData) ? sizesData : [];
}

/* ----------------------------------------------------------
   9) POST PRODUCT: preview + submit
   ---------------------------------------------------------- */
// Gallery preview (square thumbnails via CSS)
(function setupLocalPreview() {
  const galleryInput = document.getElementById("p_image");
  const galleryWrap = document.getElementById("gallery");
  if (!galleryInput || !galleryWrap) return;
  galleryInput.addEventListener("change", () => {
    galleryWrap.innerHTML = "";
    Array.from(galleryInput.files || []).forEach((file) => {
      const url = URL.createObjectURL(file);
      const img = document.createElement("img");
      img.src = url;
      img.alt = file.name;
      img.className = "thumb";
      galleryWrap.appendChild(img);
    });
  });
})();

// Clear form helper
document.getElementById("clearProduct")?.addEventListener("click", () => {
  const ids = ["p_title", "p_desc", "p_price", "p_cat"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const cover = document.getElementById("p_cover");
  if (cover) cover.value = "";
  const gal = document.getElementById("p_image");
  if (gal) gal.value = "";
  const galleryWrap = document.getElementById("gallery");
  if (galleryWrap) galleryWrap.innerHTML = "";
  document.getElementById("variants").innerHTML = "";
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

    const fd = new FormData();
    fd.append("name", name);
    fd.append("description", description);
    fd.append("price", String(price));
    fd.append("category", category);
    fd.append("deliveryTime", deliveryTime);

    // Collect variants + their images
    const { variants, files: variantImages } = collectVariantsAndFiles();
    fd.append("variants", JSON.stringify(variants));

    // Sizes stay as before
    fd.append("sizes", JSON.stringify(collectSizesArray()));

    // Cover image
    fd.append("cover", cover);

    // Attach variant images as gallery[]
    // Backend should map gallery[index] -> variants[index].imageIndex
    let i = 0;
    for (const f of variantImages) {
      if (i++ >= 12) break; // safety cap
      fd.append("gallery", f);
    }

    // NOTE: We no longer use the generic p_image gallery input.
    // You can delete the <input id="p_image"> block from seller.html if you want.

    const res = await authorizedUpload(`${API_BASE}/products/add`, fd);
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
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
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

const photoBtn = document.getElementById("changePhotoBtn");
const photoInput = document.getElementById("profilePhotoInput");

photoBtn?.addEventListener("click", () => {
  photoInput.click();
});

photoInput?.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem(PROFILE_PHOTO_KEY, reader.result);
    loadProfilePhoto();
    renderChatList(); // update chat DPs
  };
  reader.readAsDataURL(file);
});
// ---------- PAYMENT INFO (Me -> Settings -> Payment) ----------
function loadPaymentInfo() {
  const raw = localStorage.getItem(PAYMENT_KEY);
  if (!raw) return;
  try {
    const info = JSON.parse(raw);
    const methodsEl = document.getElementById("payMethods");
    const numberEl = document.getElementById("payNumber");
    const phoneEl = document.getElementById("payPhone");
    const noteEl = document.getElementById("payNote");

    if (methodsEl) methodsEl.value = info.methods || "";
    if (numberEl) numberEl.value = info.payNumber || "";
    if (phoneEl) phoneEl.value = info.phone || "";
    if (noteEl) noteEl.value = info.note || "";
  } catch (e) {
    console.error("Bad saved payment info", e);
  }
}
loadPaymentInfo();

document.getElementById("savePayment")?.addEventListener("click", () => {
  const methods = document.getElementById("payMethods")?.value.trim();
  const payNumber = document.getElementById("payNumber")?.value.trim();
  const phone = document.getElementById("payPhone")?.value.trim();
  const note = document.getElementById("payNote")?.value.trim();

  if (!methods || !payNumber || !phone) {
    showToast(
      "Fill payment channels, payment number(s) and phone number.",
      "error"
    );
    return;
  }

  const info = { methods, payNumber, phone, note };
  localStorage.setItem(PAYMENT_KEY, JSON.stringify(info));
  showToast("Payment info saved.", "success");
});

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
    const r = await authorizedFetch(`${API_BASE}/seller/my-products`);
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
    const res = await authorizedFetch(`${API_BASE}/products/${id}/visibility`, {
      method: "PATCH",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Toggle failed");
    showToast(
      data.hidden ? "Product hidden 👁" : "Product visible ✅",
      "success"
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
    const res = await authorizedFetch(`${API_BASE}/products/${id}`, {
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
  authorizedFetch(`${API_BASE}/products/${id}`)
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

    const statusLabel =
      o.status === ORDER_STATUS.UNFILLED
        ? "Awaiting payment"
        : o.status === ORDER_STATUS.FILLED
        ? "Paid (waiting confirmation)"
        : o.status === ORDER_STATUS.COMPLETED
        ? "Active shipping"
        : "Arrived (Done)";

    row.innerHTML = `
      <div class="or-left">
        <div class="or-title">${sanitize(
          o.productName || o.product || "Order"
        )}</div>
        <div class="or-sub">${statusLabel} • ${new Date(
      o.createdAt || o.ts
    ).toLocaleString()}</div>
      </div>

      <div class="or-right">
        <div class="or-price">TSh ${Number(o.price || 0).toLocaleString()}</div>
      </div>

      <div class="or-actions">
        <button class="btn btn-ghost sm" data-act="details">Details</button>
        ${
          (o.status || ORDER_STATUS.UNFILLED) === ORDER_STATUS.UNFILLED
            ? `<button class="btn btn-ghost sm" data-act="delete">Delete</button>`
            : ""
        }
      </div>
    `;

    row.addEventListener("click", (e) => {
      const act = e.target?.dataset?.act;
      if (!act) return;

      if (act === "details") {
        openOrderDetails(o.id);
        return;
      }

      if (act === "delete") {
        const st = o.status || ORDER_STATUS.UNFILLED;
        if (st !== ORDER_STATUS.UNFILLED) {
          showToast("Cannot delete after payment.", "error");
          return;
        }
        const keep = getAllOrders().filter((x) => x.id !== o.id);
        saveAllOrders(keep);
        renderOrders(filter);
        updateOverview();
        showToast("Order deleted.", "success");
      }
    });

    box.appendChild(row);
  });
}

function createOrderFromPayment(chat, pc, receiptDataUrl) {
  const all = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
  const id = `c${Date.now()}`;
  const newOrder = {
    id,
    product: pc.productName || "NgoXi Order",
    price: Number(pc.totalPrice || 0),
    qty: pc.qty || 1,
    status: "unfilled", // payment done, waiting processing
    ts: Date.now(),
    chatId: chat.id,
    receipt: receiptDataUrl || null,
  };
  all.unshift(newOrder);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(all));
  updateOverview();
  chat.orderState = "open"; // red dot in chat list
  return id;
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

  // For now: quick preview popup (temporary)
  alert(
    `ORDER DETAILS\n\n` +
      `Product: ${o.productName}\n` +
      `Price: TSh ${Number(o.price).toLocaleString()}\n` +
      `Buyer: ${o.buyerName} (${o.buyerCity})\n` +
      `Type: ${o.type}\n` +
      (o.type === "intercity"
        ? `Bus: ${o.busCompany}\nStation: ${o.busStation}\nReceiver: ${o.receiverName} ${o.receiverPhone}\n`
        : "") +
      `Status: ${o.status}`
  );
}

const ORDERS_KEY = "orders_v70_flow"; // bump version so old seed is ignored

// ================================
// ORDER LOGIC v2 (LOCKED SCHEMA)
// ================================

const ORDER_STATUS = {
  UNFILLED: "unfilled", // awaiting payment
  FILLED: "filled", // buyer paid + receipt uploaded
  COMPLETED: "completed", // seller confirmed (active shipping)
  DONE: "done", // arrived (read-only)
};

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
  return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
}

function saveAllOrders(arr) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(arr));
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

function updateTrip(orderId, { plateNumber, tripStatus }) {
  const all = getAllOrders();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;

  const o = all[idx];
  if (!o.shipping) o.shipping = { plateNumber: "", tripStatus: "pending" };

  if (plateNumber !== undefined) o.shipping.plateNumber = plateNumber;
  if (tripStatus) o.shipping.tripStatus = tripStatus;

  // If arrived -> lock it to DONE
  if (o.shipping.tripStatus === "arrived") {
    o.status = ORDER_STATUS.DONE;
  }

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
    id
  )}`;
  const imgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    url
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
/* ---------- Location picker (Leaflet) ---------- */

let locationMapInstance = null;
let locationMarker = null;

function getSavedLocation() {
  try {
    return JSON.parse(localStorage.getItem("personalLocation") || "null");
  } catch {
    return null;
  }
}

function saveLocationToStorage(loc) {
  localStorage.setItem("personalLocation", JSON.stringify(loc));
}

function openLocationModal() {
  const modal = document.getElementById("locationModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "false");

  const mapEl = document.getElementById("locationMap");
  if (!mapEl) return;

  // Init Leaflet map once
  if (!locationMapInstance && window.L) {
    const saved = getSavedLocation();
    const initialLatLng = saved
      ? [saved.latitude, saved.longitude]
      : [-6.8143, 39.2894]; // Dar es Salaam default

    locationMapInstance = L.map(mapEl).setView(initialLatLng, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(locationMapInstance);

    locationMarker = L.marker(initialLatLng, { draggable: true }).addTo(
      locationMapInstance
    );
  }

  setTimeout(() => {
    locationMapInstance && locationMapInstance.invalidateSize();
  }, 200);

  // Try to center on current browser location once
  if (locationMapInstance && !getSavedLocation() && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        locationMapInstance.setView(latlng, 14);
        if (locationMarker) {
          locationMarker.setLatLng(latlng);
        }
      },
      () => {
        // ignore if user denies
      }
    );
  }
}

function closeLocationModal() {
  const modal = document.getElementById("locationModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
}

document.getElementById("setLocationBtn")?.addEventListener("click", () => {
  openLocationModal();
});

document
  .querySelectorAll("[data-close-location]")
  .forEach((btn) => btn.addEventListener("click", closeLocationModal));

document.getElementById("saveLocationBtn")?.addEventListener("click", () => {
  if (!locationMarker) {
    closeLocationModal();
    return;
  }
  const latlng = locationMarker.getLatLng();
  const loc = {
    latitude: latlng.lat,
    longitude: latlng.lng,
    formattedAddress: document.getElementById("address")?.value || "",
  };
  saveLocationToStorage(loc);
  showToast("Location saved ✅", "success");
  closeLocationModal();
  renderLocationPreview();
});

function renderLocationPreview() {
  const container = document.getElementById("mapPreview");
  if (!container || !window.L) return;
  container.innerHTML = "";
  const saved = getSavedLocation();
  if (!saved) return;

  const map = L.map(container, {
    zoomControl: false,
    attributionControl: false,
  }).setView([saved.latitude, saved.longitude], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);
  L.marker([saved.latitude, saved.longitude]).addTo(map);
}

// Call once at startup so preview appears in Settings
renderLocationPreview();

/* ---------- Home Overview stats ---------- */
function updateOverview() {
  const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
  const revenue = orders
    .filter((o) => o.status === "filled" || o.status === "completed")
    .reduce((sum, o) => sum + Number(o.price || 0) * (o.qty || 1), 0);
  const ordersCount = orders.length;

  const sRev = document.getElementById("statRevenue");
  const sOrd = document.getElementById("statOrders");
  if (sRev) sRev.textContent = "TSh " + revenue.toLocaleString();
  if (sOrd) sOrd.textContent = String(ordersCount);
}

/* ---------- Messages tab: WhatsApp-like front-only chat ---------- */

let activeChatId = null;

// Simple local chat store (can be wired to backend later)
const CHAT_STORE = [
  {
    id: "support",
    name: "NgoXi Support",
    isSupport: true,
    phone: "+255000000000", // support hotline or leave null
    lastMessage: "Welcome to NgoXi seller chat 💚",
    lastTs: Date.now() - 1000 * 60 * 5,
    messages: [
      {
        from: "system",
        text: "Payment and order updates will appear here.",
        ts: Date.now() - 1000 * 60 * 8,
      },
      {
        from: "buyer",
        text: "Hi, I need help with my order.",
        ts: Date.now() - 1000 * 60 * 5,
      },
    ],
    paymentCard: null,
  },
  {
    id: "buyer1",
    name: "Amina • Buyer",
    phone: "+255712345678", // demo; later fill from backend buyer/seller data
    isSupport: false,
    lastMessage: "Is size 42 still available?",
    lastTs: Date.now() - 1000 * 60 * 45,
    messages: [
      {
        from: "buyer",
        text: "Is size 42 still available?",
        ts: Date.now() - 1000 * 60 * 45,
      },
    ],
    paymentCard: null,
  },
];

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderChatList() {
  const listEl = document.getElementById("contactList");
  if (!listEl) return;
  listEl.innerHTML = "";

  // Support pinned on top
  const ordered = [...CHAT_STORE].sort((a, b) => {
    if (a.isSupport && !b.isSupport) return -1;
    if (!a.isSupport && b.isSupport) return 1;
    return (b.lastTs || 0) - (a.lastTs || 0);
  });

  ordered.forEach((chat) => {
    const row = document.createElement("div");
    row.className = "contact-row";
    row.dataset.chatId = chat.id;
    if (chat.id === activeChatId) row.classList.add("active");

    const initials = chat.name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const lastKind = chat.lastKind || "message";
    const orderState = chat.orderState || null;

    let dotClass = "";
    if (orderState === "open") {
      dotClass = "notif-dot notif-dot-order";
    } else if (orderState === "completed") {
      dotClass = "notif-dot notif-dot-done";
    } else if (lastKind === "message") {
      dotClass = "notif-dot notif-dot-message";
    }

    row.innerHTML = `
  <div class="avatar">${chat.isSupport ? "N" : initials}</div>
  <div class="contact-main">
    <div class="contact-name">${sanitize(chat.name)}</div>
    <div class="contact-last">${sanitize(chat.lastMessage || "")}</div>
  </div>
  <div class="contact-time">
    ${formatTime(chat.lastTs)}
    ${dotClass ? `<span class="${dotClass}"></span>` : ""}
  </div>
`;

    row.addEventListener("click", () => {
      setActiveChat(chat.id);
    });

    listEl.appendChild(row);
  });
}

function setActiveChat(id) {
  activeChatId = id;
  renderChatList();
  const chat = CHAT_STORE.find((c) => c.id === id);
  const titleEl = document.getElementById("chatWith");
  if (titleEl) {
    titleEl.textContent = chat ? chat.name : "Select a contact";
  }
  renderChatMessages();
  const dp = localStorage.getItem(PROFILE_PHOTO_KEY);
  const headerImg = document.getElementById("chatDp");

  if (headerImg) {
    if (dp) {
      headerImg.src = dp;
      headerImg.style.display = "block";
    } else {
      headerImg.style.display = "none";
    }
  }
}

function renderChatMessages() {
  const body = document.getElementById("chatMessages");
  const cardHost = document.getElementById("paymentCardHost");
  if (!body || !cardHost) return;
  body.innerHTML = "";
  cardHost.innerHTML = "";

  const chat = CHAT_STORE.find((c) => c.id === activeChatId);
  if (!chat) {
    body.innerHTML =
      "<div class='muted'>Select a conversation to start chatting.</div>";
    return;
  }
  // Payment card, if any
  if (chat.paymentCard) {
    const card = document.createElement("div");
    card.className = "payment-card";
    const pc = chat.paymentCard;

    card.innerHTML = `
      <div class="payment-card-header">
        <div>Payment Details</div>
        <div class="muted">${sanitize(chat.name)}</div>
      </div>
      <div class="payment-card-meta">
        <div><strong>Methods:</strong> ${sanitize(
          pc.methods || "M-Pesa, TigoPesa, AirtelMoney, HaloPesa, CRDB, NMB"
        )}</div>
        <div><strong>Payment number(s):</strong> ${sanitize(
          pc.payNumber || ""
        )}</div>
        <div><strong>Phone:</strong> ${sanitize(pc.phone || "")}</div>
        ${pc.note ? `<div class="muted">${sanitize(pc.note)}</div>` : ""}
      </div>
      <div class="payment-card-actions">
        <input type="file" id="receiptInput" accept="image/*" style="display:none" />
        <button data-card-action="paid" class="btn btn-primary">I have paid</button>
        <button data-card-action="cancel" class="btn btn-ghost">Cancel</button>
      </div>
    `;
    cardHost.appendChild(card);

    const receiptInput = card.querySelector("#receiptInput");

    card.querySelectorAll("[data-card-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const act = btn.dataset.cardAction;
        if (act === "paid") {
          // Step 1: open file selector for receipt screenshot
          if (receiptInput) {
            receiptInput.click();
            receiptInput.onchange = () => {
              const file = receiptInput.files?.[0];
              if (!file) {
                showToast("No receipt selected.", "error");
                return;
              }

              // TODO: here you will upload the receipt + create order via backend
              // e.g., send FormData with chatId, productId, amount, receiptFile...

              addSystemMessage(
                chat.id,
                `Buyer marked this order as paid for: ${
                  pc.productName
                } – TSh ${Number(
                  pc.totalPrice || 0
                ).toLocaleString()}. Waiting for seller confirmation.`
              );

              // Mark in memory that we have a pending payment
              chat.paymentStatus = "pendingSeller";
              showToast(
                "Receipt attached (local). Plug this into your API later.",
                "success"
              );
            };
          }
        }

        if (act === "cancel") {
          addSystemMessage(chat.id, "Buyer cancelled this payment card.");
          chat.paymentCard = null;
          chat.paymentStatus = null;
          renderChatMessages();
        }
      });
    });
  }
  // Seller confirm/report block when receipt exists and waiting
  if (
    chat.paymentCard &&
    chat.paymentCard.orderId &&
    chat.paymentStatus === "awaitSeller"
  ) {
    const pc = chat.paymentCard;
    const sellerActions = document.createElement("div");
    sellerActions.className = "payment-seller-actions";
    sellerActions.innerHTML = `
      <div class="muted small">
        Buyer has uploaded a receipt for <strong>${sanitize(
          pc.productName || "order"
        )}</strong>. Confirm or report a problem.
      </div>
      <button class="btn btn-primary sm" data-seller-pay="confirm">
        Confirm payment
      </button>
      <button class="btn btn-ghost sm" data-seller-pay="problem">
        Report a problem
      </button>
    `;
    cardHost.appendChild(sellerActions);

    sellerActions.addEventListener("click", (e) => {
      const act = e.target?.dataset?.sellerPay;
      if (!act) return;

      const all = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
      const idx = all.findIndex((o) => o.id === pc.orderId);
      if (idx < 0) return;

      if (act === "confirm") {
        all[idx].status = "filled";
        chat.paymentStatus = "confirmed";
        chat.orderState = "open"; // still open until completed
        addSystemMessage(
          chat.id,
          "Seller confirmed payment. Order is now being processed.",
          "order"
        );
        showToast("Payment confirmed ✅", "success");
      }

      if (act === "problem") {
        all[idx].status = "unfilled";
        chat.paymentStatus = "issue";
        chat.orderState = "open";
        addSystemMessage(
          chat.id,
          "Seller reported a payment issue. Please chat to resolve.",
          "order"
        );
        showToast("Payment problem recorded ⚠️", "error");
      }

      localStorage.setItem(ORDERS_KEY, JSON.stringify(all));
      updateOverview();
      renderChatMessages();
    });
  }

  chat.messages.forEach((m) => {
    const div = document.createElement("div");
    let cls = "bubble";
    if (m.from === "seller") cls += " seller";
    else if (m.from === "buyer") cls += " buyer";
    else cls += " system";

    div.className = cls;
    const timeHtml = m.ts
      ? `<div style="font-size:11px;opacity:0.7;margin-top:4px;">${formatTime(
          m.ts
        )}</div>`
      : "";
    div.innerHTML = `${sanitize(m.text)}${timeHtml}`;
    body.appendChild(div);
  });

  body.scrollTop = body.scrollHeight;
}

function addMessage(chatId, from, text) {
  const chat = CHAT_STORE.find((c) => c.id === chatId);
  if (!chat) return;
  const now = Date.now();
  const msg = { from, text, ts: now, kind: "message" };
  chat.messages.push(msg);
  chat.lastMessage = text;
  chat.lastTs = now;
  chat.lastKind = "message";
  renderChatMessages();
}

function addSystemMessage(chatId, text, kind = "system") {
  const chat = CHAT_STORE.find((c) => c.id === chatId);
  if (!chat) return;
  const now = Date.now();
  chat.messages.push({ from: "system", text, ts: now, kind });
  chat.lastMessage = text;
  chat.lastTs = now;
  chat.lastKind = kind === "order" ? "order" : "message";
  renderChatMessages();
}

// Send message button
document.getElementById("sendChat")?.addEventListener("click", () => {
  const input = document.getElementById("chatInput");
  const text = input?.value?.trim();
  if (!text || !activeChatId) return;
  addMessage(activeChatId, "seller", text);
  input.value = "";
});
// CALL BUTTON — opens device dialer using the stored phone number
document.getElementById("callContact")?.addEventListener("click", () => {
  if (!activeChatId) {
    showToast("Select a contact first.", "error");
    return;
  }

  const chat = CHAT_STORE.find((c) => c.id === activeChatId);
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

// Payment info button: creates a payment card for active chat
document.getElementById("sendPaymentInfo")?.addEventListener("click", () => {
  if (!activeChatId) {
    showToast("Select a chat first.", "error");
    return;
  }
  const chat = CHAT_STORE.find((c) => c.id === activeChatId);
  if (!chat) return;

  // Simple demo card; later you can plug in real product/order data
  chat.paymentCard = {
    productName: "Sample Product",
    totalPrice: 550000,
    note: "Send via M-Pesa or TigoPesa, then press 'I have paid'.",
  };

  addSystemMessage(
    chat.id,
    "Payment card created for this product. Buyer can tap 'I have paid' after sending money."
  );
  renderChatMessages();
});

// Refresh contacts list
document.getElementById("refreshContacts")?.addEventListener("click", () => {
  renderChatList();
});

// Initial render
renderChatList();
// Auto-select NgoXi Support as initial chat
setActiveChat("support");

const avatar = document.createElement("div");
avatar.className = "contact-avatar";

const dp = localStorage.getItem(PROFILE_PHOTO_KEY);
if (dp) {
  avatar.innerHTML = `<img src="${dp}" />`;
} else {
  avatar.textContent = initials(name);
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
    '.stat.card[data-stat="products"]'
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
      '.prod-tab-btn[data-prodtab="posted"]'
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
  updateOverview();
  animateStatsFromDom();
  renderOrders("unfilled");
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

initDashboard();
