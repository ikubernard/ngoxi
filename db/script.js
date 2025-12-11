/* =======================================================================
   NGOXI - FRONTEND CORE SCRIPT
   Single-file orchestrator for Home/Market page (buyer-side)
   Author: NgoXi Build
   Notes:
     - This script is intentionally verbose (600+ lines) with rich comments
       to make future edits easier and to support scale (10k+ products).
     - It focuses on: pagination, smooth search, filters, cart, and UX polish.
   ======================================================================= */

/* ===========================
   0) RUNTIME / FEATURE FLAGS
   =========================== */

const NGOXI_FEATURES = Object.freeze({
  LOG_VERBOSE: true,
  ENABLE_IMAGE_SEARCH_PLACEHOLDER: true,
  ENABLE_FILTERS: true,
  ENABLE_WISHLIST: true,
  ENABLE_CART: true,
  ENABLE_SCROLL_RESTORE: true, // restore scroll after navigation
  DEFAULT_PAGE_LIMIT: 20,
});

/* ============================
   1) CONFIG / API ENDPOINTS
   ============================ */

const API_BASE = (window.NGOXI_API_BASE || "http://localhost:5000");
const ROUTES = Object.freeze({
  PRODUCTS: (page=1, limit=NGOXI_FEATURES.DEFAULT_PAGE_LIMIT) => `${API_BASE}/api/products?page=${page}&limit=${limit}`,
  SEARCH: (q, page=1, limit=NGOXI_FEATURES.DEFAULT_PAGE_LIMIT) => `${API_BASE}/api/products/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`,
  PRODUCT_BY_ID: (id) => `${API_BASE}/api/products/${id}`,
  // Extend as needed:
  // SELLER: (id) => `${API_BASE}/api/seller/${id}`,
});

/* ============================
   2) UTILITIES / HELPERS
   ============================ */

const $$ = (sel, ctx=document) => ctx.querySelector(sel);
const $$$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

function h(tag, props={}, children=[]) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "className") el.className = v;
    else if (k === "dataset" && v && typeof v === "object") {
      Object.entries(v).forEach(([dk, dv]) => el.dataset[dk] = dv);
    } else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.substring(2).toLowerCase(), v);
    } else if (k === "style" && v && typeof v === "object") {
      Object.assign(el.style, v);
    } else {
      el.setAttribute(k, v);
    }
  });
  const arr = Array.isArray(children) ? children : [children];
  for (const c of arr) {
    if (c == null) continue;
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  }
  return el;
}

function debounce(fn, wait=300) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function throttle(fn, delay=200) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn(...args);
    }
  };
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

/* ============================
   3) LOGGING / ERROR CHANNEL
   ============================ */

function log(...args) {
  if (NGOXI_FEATURES.LOG_VERBOSE) console.log("[NgoXi]", ...args);
}
function warn(...args) {
  console.warn("[NgoXi:warn]", ...args);
}
function error(...args) {
  console.error("[NgoXi:error]", ...args);
}

/* ============================
   4) TOAST / SNACKBAR UI
   ============================ */

const Toast = (() => {
  let container;
  function ensureContainer() {
    if (!container) {
      container = h("div", { className: "ngoxi-toast-container", style: {
        position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", gap: "8px", zIndex: 9999
      }});
      document.body.appendChild(container);
    }
  }
  function show(message, type="info", timeout=2500) {
    ensureContainer();
    const bg = type === "error" ? "#e06638" : type === "success" ? "#2e7d32" : "#222";
    const el = h("div", { className: "ngoxi-toast", style: {
      background: bg, color: "#fff", padding: "10px 14px", borderRadius: "10px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)", fontFamily: "Book Antiqua, Georgia, serif"
    }}, message);
    container.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .3s ease";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 320);
    }, timeout);
  }
  return { show };
})();

/* ============================
   5) AUTH / SESSION HELPERS
   ============================ */

const Auth = (() => {
  const KEY_TOKEN = "token";
  const KEY_USER = "user";

  function getToken() {
    try { return localStorage.getItem(KEY_TOKEN); } catch { return null; }
  }
  function setToken(t) {
    try { localStorage.setItem(KEY_TOKEN, t); } catch {}
  }
  function clear() {
    try {
      localStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_USER);
    } catch {}
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(KEY_USER) || "{}"); } catch { return {}; }
  }
  function setUser(u) {
    try { localStorage.setItem(KEY_USER, JSON.stringify(u)); } catch {}
  }

  return { getToken, setToken, clear, getUser, setUser };
})();

/* =======================================
   6) NETWORK LAYER / AUTHORIZED FETCHER
   ======================================= */

async function nxFetch(url, options={}) {
  const headers = options.headers || {};
  const token = Auth.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  headers["Content-Type"] = headers["Content-Type"] || "application/json";
  try {
    const res = await fetch(url, { ...options, headers });
    return res;
  } catch (e) {
    Toast.show("Network error. Check connection.", "error");
    throw e;
  }
}

/* =================================
   7) GLOBAL STATE (HOME/MARKET)
   ================================= */

const State = {
  page: 1,
  pages: 1,
  limit: NGOXI_FEATURES.DEFAULT_PAGE_LIMIT,
  loading: false,
  activeQuery: "",
  filters: {
    deliveryTime: "any", // "any" | "72hr" | "15days"
    shippingType: "any", // "any" | "local" | "overseas"
    freeShipping: "any", // "any" | "true" | "false"
    minPrice: 0,
    maxPrice: 0,
  },
  scrollYBeforeNav: 0,
};

/* ==================================
   8) DOM REFERENCES (BY ID/CLASS)
   ================================== */

const DOM = {
  list: null,          // #productList
  loadingMsg: null,    // #loadingMsg
  searchBox: null,     // #searchBox
  searchBtn: null,     // #searchBtn
  imageSearchInput: null, // #imageSearchInput
  filterPanel: null,   // #filterPanel (optional)
  filterApplyBtn: null,// #applyFiltersBtn
  clearFiltersBtn: null,// #clearFiltersBtn
};

/* ==================================
   9) RENDERERS (PRODUCT CARDS, etc.)
   ================================== */

function renderProductCard(p) {
  // mini badges
  const badges = [];
  if (p.deliveryTime === "72hr") badges.push("🚚 72 hr");
  if (p.deliveryTime === "15days") badges.push("📦 15 days");
  if (p.shippingType === "local") badges.push("🌍 Local");
  if (p.shippingType === "overseas") badges.push("✈️ Overseas");
  if (p.freeShipping) badges.push("💸 Free");

  const imgSrc = p.image || "../assets/logo.png";
  const price = p.price ? `TSh ${Number(p.price).toLocaleString()}` : "";

  return h("div", { className: "product-card" }, [
    h("img", { src: imgSrc, alt: p.name }),
    h("h4", {}, p.name || "Unnamed"),
    h("p", { className: "price" }, price),
    h("p", { className: "desc" }, p.description || ""),
    badges.length ? h("div", { className: "mini-badges" }, badges.map(b => h("span", {}, b))) : null
  ]);
}

function renderProducts(items=[]) {
  if (!DOM.list) return;
  const frag = document.createDocumentFragment();
  items.forEach(p => frag.appendChild(renderProductCard(p)));
  DOM.list.appendChild(frag);
}

/* ==================================
   10) PAGINATION + INFINITE SCROLL
   ================================== */

async function loadProducts(page = 1, query = "") {
  if (State.loading) return;
  State.loading = true;
  if (DOM.loadingMsg) DOM.loadingMsg.style.display = "block";

  // Build endpoint: either search or browse
  const base = query ? ROUTES.SEARCH(query, page, State.limit) : ROUTES.PRODUCTS(page, State.limit);

  // Attach filters (for server-side support later)
  const url = new URL(base);
  if (State.filters && url) {
    const f = State.filters;
    if (f.deliveryTime && f.deliveryTime !== "any") url.searchParams.set("deliveryTime", f.deliveryTime);
    if (f.shippingType && f.shippingType !== "any") url.searchParams.set("shippingType", f.shippingType);
    if (f.freeShipping && f.freeShipping !== "any") url.searchParams.set("freeShipping", f.freeShipping);
    if (f.minPrice && Number(f.minPrice) > 0) url.searchParams.set("minPrice", String(f.minPrice));
    if (f.maxPrice && Number(f.maxPrice) > 0) url.searchParams.set("maxPrice", String(f.maxPrice));
  }

  try {
    log("Loading products:", url.toString());
    const res = await nxFetch(url.toString());
    const data = await res.json();

    if (page === 1 && DOM.list) DOM.list.innerHTML = "";

    renderProducts(data.products || []);

    State.page = data.page || page;
    State.pages = data.pages || 1;

    if (State.page >= State.pages) {
      window.removeEventListener("scroll", handleScroll);
      if (DOM.loadingMsg) DOM.loadingMsg.textContent = "No more products 🚀";
    } else {
      window.addEventListener("scroll", handleScroll);
    }
  } catch (e) {
    error("Failed to load products", e);
    Toast.show("Failed to load products.", "error");
  } finally {
    if (DOM.loadingMsg) DOM.loadingMsg.style.display = "none";
    State.loading = false;
  }
}

const handleScroll = throttle(() => {
  const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
  if (scrollTop + clientHeight >= scrollHeight - 10) {
    if (State.page < State.pages) {
      State.page += 1;
      loadProducts(State.page, State.activeQuery);
    }
  }
}, 150);

/* ===============================
   11) SEARCH (TEXT + IMAGE MOCK)
   =============================== */

function bindSearch() {
  if (DOM.searchBtn && DOM.searchBox) {
    DOM.searchBtn.addEventListener("click", () => {
      const q = DOM.searchBox.value.trim();
      if (!q) return;
      State.page = 1;
      State.activeQuery = q;
      loadProducts(State.page, State.activeQuery);
    });
    // Enter key
    DOM.searchBox.addEventListener("keydown", (e) => {
      if (e.key === "Enter") DOM.searchBtn.click();
    });
  }

  if (NGOXI_FEATURES.ENABLE_IMAGE_SEARCH_PLACEHOLDER && DOM.imageSearchInput) {
    DOM.imageSearchInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      Toast.show(`Image search coming soon — ${file.name}`, "info");
      // Future: upload to /api/products/vision-search
    });
  }
}

/* ===============================
   12) FILTERS (CLIENT-SIDE LOGIC)
   =============================== */

function bindFilters() {
  if (!NGOXI_FEATURES.ENABLE_FILTERS) return;
  const deliverySel = $$("#filterDelivery");
  const shippingSel = $$("#filterShipping");
  const freeSel = $$("#filterFree");
  const minPrice = $$("#filterMinPrice");
  const maxPrice = $$("#filterMaxPrice");
  const applyBtn = $$("#applyFiltersBtn");
  const clearBtn = $$("#clearFiltersBtn");

  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      State.filters.deliveryTime = deliverySel?.value || "any";
      State.filters.shippingType = shippingSel?.value || "any";
      State.filters.freeShipping = freeSel?.value || "any";
      State.filters.minPrice = Number(minPrice?.value || 0);
      State.filters.maxPrice = Number(maxPrice?.value || 0);
      State.page = 1;
      loadProducts(State.page, State.activeQuery);
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (deliverySel) deliverySel.value = "any";
      if (shippingSel) shippingSel.value = "any";
      if (freeSel) freeSel.value = "any";
      if (minPrice) minPrice.value = "";
      if (maxPrice) maxPrice.value = "";
      State.filters = { deliveryTime: "any", shippingType: "any", freeShipping: "any", minPrice: 0, maxPrice: 0 };
      State.page = 1;
      loadProducts(State.page, State.activeQuery);
    });
  }
}

/* ===============================
   13) CART MODULE (LIGHTWEIGHT)
   =============================== */

const Cart = (() => {
  const KEY = "ngoxi_cart";
  let items = [];

  function load() {
    try { items = JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { items = []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  }
  function add(product, qty=1) {
    const idx = items.findIndex(x => x._id === product._id);
    if (idx >= 0) items[idx].qty += qty;
    else items.push({ ...product, qty });
    save();
    Toast.show("Added to cart.", "success");
  }
  function remove(id) {
    items = items.filter(p => p._id !== id);
    save();
  }
  function clear() { items = []; save(); }
  function list() { return items.slice(); }
  function total() {
    return items.reduce((acc, p) => acc + (Number(p.price || 0) * (p.qty || 1)), 0);
  }

  load();
  return { add, remove, clear, list, total };
})();

/* ===============================
   14) WISHLIST (OPTIONAL)
   =============================== */

const Wishlist = (() => {
  if (!NGOXI_FEATURES.ENABLE_WISHLIST) return { add(){}, remove(){}, list(){return [];} };
  const KEY = "ngoxi_wishlist";
  let ids = [];
  function load(){ try{ ids = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch{ ids = []; } }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(ids)); } catch{} }
  function add(id){ if(!ids.includes(id)){ ids.push(id); save(); Toast.show("Saved to wishlist."); } }
  function remove(id){ ids = ids.filter(x => x !== id); save(); }
  function list(){ return ids.slice(); }
  load();
  return { add, remove, list };
})();

/* ===============================
   15) NAV / VIEW HELPERS
   =============================== */

function preserveScrollPosition() {
  if (!NGOXI_FEATURES.ENABLE_SCROLL_RESTORE) return;
  State.scrollYBeforeNav = window.scrollY;
}

function restoreScrollPosition() {
  if (!NGOXI_FEATURES.ENABLE_SCROLL_RESTORE) return;
  if (State.scrollYBeforeNav) window.scrollTo({ top: State.scrollYBeforeNav, behavior: "instant" });
}

/* ===============================
   16) SPLASH (OPTIONAL HOOK)
   =============================== */

function hideSplashIfAny() {
  const splash = $$("#splash");
  if (splash) {
    splash.style.transition = "opacity .4s ease";
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 420);
  }
}

/* ===============================
   17) BIND EVENTS ON LOAD
   =============================== */

document.addEventListener("DOMContentLoaded", () => {
  // Cache DOM
  DOM.list = $$("#productList");
  DOM.loadingMsg = $$("#loadingMsg");
  DOM.searchBox = $$("#searchBox");
  DOM.searchBtn = $$("#searchBtn");
  DOM.imageSearchInput = $$("#imageSearchInput");

  // Bind UI
  bindSearch();
  bindFilters();

  // Initial data load
  State.page = 1;
  loadProducts(State.page);

  // Splash
  setTimeout(hideSplashIfAny, 800);

  // Restore scroll quickly after possible nav
  setTimeout(restoreScrollPosition, 100);
});

/* ===============================
   18) DEBUG UTILITIES (OPTIONAL)
   =============================== */

window.NgoXi = {
  state: State,
  loadProducts,
  Cart,
  Wishlist,
  Toast,
  log,
};

/* =======================================================================
   END OF NGOXI CORE (Home/Market)
   ======================================================================= */
