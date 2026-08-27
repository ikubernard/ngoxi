/* =========================================================================
   NgoXi — Buyer App (Home)  •  Improved script.js
   Framework: Vanilla JS
   Back-end routes (confirmed):
     GET  /api/products?page=#
     GET  /api/products/:id            (⚠ currently returns error in your server)
     GET  /api/favorite
     POST /api/favorite
     GET  /api/cart
     POST /api/cart
     POST /api/search
     POST /api/image-search
     POST /api/qr-scan
     POST /api/upload/image            (Cloudinary relay)
   Socket.io: realtime chat & status
   Leaflet: mini map + settings map (+ reverse geocode with Nominatim)
   ========================================================================= */

(() => {
  // -----------------------------
  // Config / Globals
  // -----------------------------
  const API_BASE = window.API_BASE || `${location.origin}`;
  const PAGE_SIZE_HINT = 20; // just a hint for preallocations
  const USE_NOMINATIM = true; // reverse geocode
  const NOMINATIM_URL =
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2";

  // State
  const state = {
    page: 1,
    pages: 1,
    loading: false,
    products: [], // cache of products from list
    marketplace: {
      category: "all",
      search: "",
      mode: "all",
      sort: "default",
    },
    productById: new Map(), // quick index by _id
    favorites: new Set(), // product IDs (we normalize whatever backend returns)
    theme: localStorage.getItem("ngoxi_theme") || "light",
    search: {
      term: "",
      history: JSON.parse(localStorage.getItem("ngoxi_search_history") || "[]"),
      suggestOpen: false,
    },
    cartCount: 0,
    gridObserver: null,
    splashDone: false,
    miniMap: null,
    settingsMap: null,
    settingsMarker: null,
    socket: null,

    chats: {
      activeSellerId: null,
      conversations: new Map(),
      seller: [],
    },
  };

  // Elements
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const els = {
    splash: $("#splash"),
    themeToggle: $("#themeToggle"),
    themeLabel: $("#themeLabel"),
    slides: $("#slides"),
    heroDots: $("#heroDots"),
    searchInput: $("#searchInput"),
    searchGo: $("#searchGo"),
    imgSearchBtn: $("#imgSearchBtn"),
    imgFile: $("#imgFile"),
    qrBtn: $("#qrBtn"),
    locBtn: $("#locBtn"),
    map: $("#map"),
    countdown: $("#countdown"),
    grid: $("#grid"),
    productSheet: $("#productSheet"),
    psClose: $("#psClose"),
    psTitle: $("#psTitle"),
    psSeller: $("#psSeller"),
    psRating: $("#psRating"),
    psPrice: $("#psPrice"),
    psDelivery: $("#psDelivery"),
    psGallery: $("#psGallery"),
    psVariants: $("#psVariants"),
    psDesc: $("#psDesc"),
    psFav: $("#psFav"),
    psAddCart: $("#psAddCart"),
    bottomNav: $(".bottom-nav"),
    navBtns: $$(".bottom-nav .nav-btn"),
    views: {
      home: $("#view-home"),
      messages: $("#view-messages"),
      packages: $("#view-packages"),
      me: $("#view-me"),
    },
    // Messages
    chatStatus: $("#chatStatus"),
    chatList: $("#chatList"),
    chatBody: $("#chatBody"),

    // Packages pills & containers
    pkgPills: $$(".pills .pill[data-pkg]"),
    pkgProgress: $("#pkgProgress"),
    pkgReady: $("#pkgReady"),
    // Me pills & containers
    mePills: $$(".pills .pill[data-me]"),
    meProfile: $("#meProfile"),
    meSettings: $("#meSettings"),
    meCart: $("#meCart"),
    meOrders: $("#meOrders"),
    meMore: $("#meMore"),
    // Settings inputs + map
    setName: $("#setName"),
    setPhone: $("#setPhone"),
    setEmail: $("#setEmail"),
    setLocation: $("#setLocation"),
    saveSettings: $("#saveSettings"),
    logoutBtn: $("#logoutBtn"),
    buyerMap: $("#buyerMap"),
    // Cart
    cartBtn: $("#cartBtn"),
    cartCount: $("#cartCount"),
    cartList: $("#cartList"),
    cartEmpty: $("#cartEmpty"),
    checkoutBtn: $("#checkoutBtn"),
  };

  // Utils
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const currency = (n) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "TZS",
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `TSh ${Number(n).toLocaleString()}`;
    }
  };
  const toast = (msg) => {
    const t = document.createElement("div");
    t.textContent = msg;
    Object.assign(t.style, {
      position: "fixed",
      bottom: "18px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(0,0,0,.78)",
      color: "#fff",
      padding: "10px 14px",
      borderRadius: "10px",
      zIndex: "99999",
      fontSize: "13px",
      boxShadow: "0 6px 26px rgba(0,0,0,.35)",
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  };

  const safeGet = (o, path, d = undefined) => {
    try {
      return path
        .split(".")
        .reduce((a, k) => (a && a[k] !== undefined ? a[k] : d), o);
    } catch {
      return d;
    }
  };

  // -----------------------------
  // Theme
  // -----------------------------
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    state.theme = theme;
    localStorage.setItem("ngoxi_theme", theme);
    if (els.themeLabel)
      els.themeLabel.textContent = theme === "light" ? "🌙" : "☀️";
  }

  function toggleTheme() {
    applyTheme(state.theme === "light" ? "dark" : "light");
  }

  // -----------------------------
  // Splash
  // -----------------------------
  async function runSplash() {
    if (!els.splash) return;
    await wait(3200 + Math.random() * 1200); // 3–4.4s
    els.splash.style.opacity = "0";
    await wait(450);
    els.splash.remove();
    state.splashDone = true;
  }

  // -----------------------------
  // Hero slider
  // -----------------------------
  function initHero() {
    if (!els.slides || !els.heroDots) return;
    const slides = $$(".slide", els.slides);
    els.heroDots.innerHTML = slides
      .map(() => `<div class="dot"></div>`)
      .join("");
    const dots = $$(".dot", els.heroDots);
    let idx = 0;

    const go = (i) => {
      idx = i % slides.length;
      els.slides.style.transform = `translateX(-${idx * 100}vw)`;
      dots.forEach((d, k) => d.classList.toggle("on", k === idx));
    };

    go(0);
    setInterval(() => go(idx + 1), 4000);
  }

  // -----------------------------
  // Countdown (Deals ending soon)
  // End of local day HH:MM:SS
  // -----------------------------
  function initCountdown() {
    if (!els.countdown) return;
    function update() {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const diff = Math.max(0, end - now);
      const hh = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const mm = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const ss = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      els.countdown.textContent = `${hh}:${mm}:${ss}`;
    }
    update();
    setInterval(update, 1000);
  }

  // -----------------------------
  // API
  // -----------------------------
  async function apiGet(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }
  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }
  async function loadCurrentBuyer() {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "include",
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      window.location.href = "/auth.html";
      return null;
    }

    if (!response.ok) {
      throw new Error(data.error || "Could not verify session");
    }

    const user = data.user;

    if (!Array.isArray(user?.roles) || !user.roles.includes("buyer")) {
      window.location.href = "/role-select.html";

      return null;
    }

    return user;
  }

  // -----------------------------
  // Products / Grid
  // -----------------------------
  function productCover(p) {
    // prefer cover.url, then first images[].url
    return safeGet(p, "cover.url") || safeGet(p, "images.0.url") || "";
  }
  function isDiscountedProduct(product) {
    const discountPercent = Number(product?.discountPercent || 0);

    const originalPrice = Number(product?.originalPrice || 0);

    const finalPrice = Number(product?.price || 0);

    return discountPercent > 0 && originalPrice > finalPrice;
  }
  function renderCard(p) {
    const img = productCover(p);
    const finalPrice = currency(p.price);
    const originalPrice = currency(p.originalPrice);
    const discountPercent = Number(p.discountPercent || 0);

    const discounted = isDiscountedProduct(p);
    const desc = (p.description || "").slice(0, 70);
    const title = p.name || p.title || "Product";

    const priceHTML = discounted
      ? `
      <div class="p-discount-prices">
        <del class="p-old-price">
          ${originalPrice}
        </del>

        <span class="p-discount-badge">
          -${discountPercent}%
        </span>
      </div>

      <div class="p-price p-new-price">
        ${finalPrice}
      </div>
    `
      : `
      <div class="p-price">
        ${finalPrice}
      </div>
    `;

    const card = document.createElement("div");
    card.className = "p-card";
    card.dataset.id = p._id;
    card.dataset.mode = p.mode || "standard";
    card.dataset.discounted = String(discounted);

    card.innerHTML = `
    <div class="p-img">
      ${
        img
          ? `<img
              src="${img}"
              alt="${escapeHTML(title)}"
              loading="lazy"
            />`
          : ""
      }

      ${
        discounted
          ? `<span class="p-image-discount">
               ${discountPercent}% OFF
             </span>`
          : ""
      }
    </div>

    <div class="p-info">
      <div class="p-name">
        ${escapeHTML(title)}
      </div>

      ${priceHTML}

      ${
        desc
          ? `<div
               class="muted"
               style="margin-top:4px;font-size:12px"
             >
               ${escapeHTML(desc)}
             </div>`
          : ""
      }
    </div>
  `;

    card.addEventListener("click", () => {
      window.location.href = `/product.html?id=${p._id}`;
    });

    return card;
  }
  function loadFavorites() {
    const favs = JSON.parse(localStorage.getItem("ngx_favorites") || "[]");
    const grid = document.getElementById("favoritesGrid");
    grid.innerHTML = "";

    favs.forEach((item) => {
      const div = document.createElement("div");
      div.className = "p-card";
      div.innerHTML = `
        <div class="p-img"><img src="${item.images[0]}" /></div>
        <div class="p-info">
            <div class="p-name">${item.name}</div>
            <div class="p-price">${item.price} TSh</div>
        </div>
    `;
      div.onclick = () =>
        (window.location.href = `/product.html?id=${item._id}`);
      grid.appendChild(div);
    });
  }

  function escapeHTML(s) {
    return String(s).replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
    );
  }

  async function loadProducts(page = 1, opts = {}) {
    if (state.loading || page > state.pages) return;
    state.loading = true;

    try {
      // If real search is active, prefer server search
      if (opts.searchTerm && opts.remote) {
        const data = await apiPost(`${API_BASE}/api/search`, {
          q: opts.searchTerm,
        });
        // Normalize into {products, page, pages}
        const products = data.products || data || [];
        if (page === 1) {
          state.products = [];
          els.grid.innerHTML = "";
        }
        for (const p of products) {
          indexProduct(p);
          els.grid.appendChild(renderCard(p));
        }
        loadDeals(state.products);
        state.page = 1;
        state.pages = 1; // single-shot search results
        return;
      }

      const data = await apiGet(`${API_BASE}/api/products?page=${page}`);
      const products = data.products || [];
      state.page = data.page || page;
      state.pages = data.pages || state.pages;

      if (page === 1 && !opts.append) {
        state.products = [];
        els.grid.innerHTML = "";
      }

      for (const p of products) {
        indexProduct(p);
        els.grid.appendChild(renderCard(p));
      }
      loadDeals(state.products);
    } catch (err) {
      console.error("loadProducts", err);
      toast("Failed to load products");
      refreshMarketplace();
    } finally {
      state.loading = false;
    }
  }

  function indexProduct(p) {
    state.productById.set(p._id, p);
    if (!state.products.find((x) => x._id === p._id)) state.products.push(p);
  }

  function initInfiniteScroll() {
    const sentinel = document.createElement("div");
    sentinel.style.height = "1px";
    els.grid.appendChild(sentinel);

    state.gridObserver = new IntersectionObserver(
      async (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !state.loading) {
            if (state.page < state.pages && !state.search.term) {
              await loadProducts(state.page + 1, { append: true });
            }
          }
        }
      },
      { rootMargin: "1200px 0px 0px 0px" },
    );

    state.gridObserver.observe(sentinel);
  }
  // -----------------------------
  // Marketplace Engine
  // -----------------------------

  function getMarketplaceProducts() {
    let products = [...state.products];

    // CATEGORY FILTER
    if (state.marketplace.category !== "all") {
      products = products.filter((product) => {
        return (
          product.category?.toLowerCase() ===
          state.marketplace.category.toLowerCase()
        );
      });
    }

    // SEARCH FILTER
    if (state.marketplace.search) {
      const keyword = state.marketplace.search.toLowerCase();

      products = products.filter((product) => {
        const text = `
        ${product.name || ""}
        ${product.category || ""}
        ${product.description || ""}
      `.toLowerCase();

        return text.includes(keyword);
      });
    }

    // MODE FILTER
    if (state.marketplace.mode !== "all") {
      const selectedMode = state.marketplace.mode.toLowerCase();

      products = products.filter((product) => {
        // Super Discount is automatic
        if (selectedMode === "discount") {
          return isDiscountedProduct(product);
        }

        return (
          String(product.mode || "standard").toLowerCase() === selectedMode
        );
      });
    }
    // SORTING (future)
    if (state.marketplace.sort === "price-low") {
      products.sort((a, b) => Number(a.price) - Number(b.price));
    }

    if (state.marketplace.sort === "price-high") {
      products.sort((a, b) => Number(b.price) - Number(a.price));
    }

    return products;
  }
  function refreshMarketplace() {
    const products = getMarketplaceProducts();

    els.grid.innerHTML = "";

    products.forEach((product) => {
      els.grid.appendChild(renderCard(product));
    });
  }
  // -----------------------------
  // Product Sheet
  // -----------------------------

  function openProductSheet() {
    return;
  }
  function closeProductSheet() {
    if (els.productSheet) {
      els.productSheet.classList.remove("open");
    }
  }

  // -----------------------------
  // Favorites
  // -----------------------------
  async function loadFavorites() {
    try {
      const data = await apiGet(`${API_BASE}/api/favorite`);
      // Support both IDs or full product objects
      if (Array.isArray(data)) {
        if (data.length && typeof data[0] === "string") {
          // IDs
          data.forEach((id) => state.favorites.add(id));
        } else if (data.length && typeof data[0] === "object") {
          data.forEach((p) => {
            state.favorites.add(p._id);
            indexProduct(p);
          });
        }
      } else if (Array.isArray(data?.ids)) {
        data.ids.forEach((id) => state.favorites.add(id));
      }
    } catch (e) {
      console.warn("favorites load failed", e);
    }
  }

  // -----------------------------
  // Cart badge
  // -----------------------------
  async function updateCartCount() {
    let count = 0;
    try {
      const data = await apiGet(`${API_BASE}/api/cart`);
      // assume returns { items: [{id, qty}] } or array
      const items = data.items || data || [];
      count = items.reduce((a, b) => a + (b.qty || 1), 0);
    } catch {
      const cart = JSON.parse(localStorage.getItem("ngoxi_cart") || "[]");
      count = cart.reduce((a, b) => a + (b.qty || 1), 0);
    }
    state.cartCount = count;
    if (els.cartCount) els.cartCount.textContent = String(count);
  }

  // -----------------------------
  // Search (text + server + suggestions + history)
  // -----------------------------
  function persistHistory() {
    localStorage.setItem(
      "ngoxi_search_history",
      JSON.stringify(state.search.history.slice(0, 15)),
    );
  }

  function pushHistory(q) {
    if (!q) return;
    const idx = state.search.history.indexOf(q);
    if (idx >= 0) state.search.history.splice(idx, 1);
    state.search.history.unshift(q);
    persistHistory();
  }

  let searchDebounce = 0;
  function onSearchInput() {
    const q = els.searchInput.value.trim();

    state.search.term = q;
    state.marketplace.search = q;
    // Suggestion dropdown (basic)
    // You can enhance to call /api/search-suggest if you add it server-side
    // For now we rely on history (already typed) — omitted dropdown UI for simplicity.

    // Debounce remote search, else filter locally
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      if (!q) {
        // empty -> show default list
        await loadProducts(1);
        return;
      }
      // Try remote
      try {
        await loadProducts(1, { searchTerm: q, remote: true });
      } catch {
        // fallback: local filter
        const filtered = state.products.filter((p) => {
          const hay =
            `${p.name || ""} ${p.category || ""} ${p.description || ""}`.toLowerCase();
          return hay.includes(q.toLowerCase());
        });
        els.grid.innerHTML = "";
        filtered.forEach((p) => els.grid.appendChild(renderCard(p)));
      }
    }, 250);
  }

  // -----------------------------
  // Image Search (Cloudinary upload -> /api/image-search)
  // -----------------------------
  function initImageSearch() {
    if (!els.imgSearchBtn || !els.imgFile) return;
    els.imgSearchBtn.addEventListener("click", () => els.imgFile.click());
    els.imgFile.addEventListener("change", async () => {
      const file = els.imgFile.files?.[0];
      if (!file) return;
      try {
        toast("Uploading image…");
        // 1) Upload to your backend -> Cloudinary
        const formData = new FormData();
        formData.append("file", file);
        const up = await fetch(`${API_BASE}/api/upload/image`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!up.ok) throw new Error("Upload failed");
        const upJson = await up.json();
        const url = upJson.url || upJson.secure_url;
        if (!url) throw new Error("No URL returned");

        // 2) Call image-search
        const result = await apiPost(`${API_BASE}/api/image-search`, { url });
        const products = result.products || result || [];
        if (!Array.isArray(products) || !products.length) {
          toast("No visual matches found");
          return;
        }
        // render
        els.grid.innerHTML = "";
        products.forEach((p) => {
          indexProduct(p);
          els.grid.appendChild(renderCard(p));
        });
        state.page = 1;
        state.pages = 1; // single-shot
        pushHistory("[image]");
      } catch (e) {
        console.error(e);
        toast("Image search failed");
      } finally {
        els.imgFile.value = "";
      }
    });
  }

  // -----------------------------
  // QR Scan -> seller store
  // Progressive: BarcodeDetector -> file upload fallback -> prompt
  // -----------------------------
  function initQR() {
    if (!els.qrBtn) return;
    els.qrBtn.addEventListener("click", async () => {
      // Try modern API
      if ("BarcodeDetector" in window) {
        try {
          const det = new BarcodeDetector({ formats: ["qr_code"] });
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          const video = document.createElement("video");
          video.srcObject = stream;
          video.setAttribute("playsinline", true);
          await video.play();

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          const scanLoop = async () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const bitmap = await createImageBitmap(canvas);
              const codes = await det.detect(bitmap);
              if (codes.length) {
                cleanup();
                handleQR(codes[0].rawValue);
                return;
              }
            }
            requestAnimationFrame(scanLoop);
          };
          const cleanup = () => {
            stream.getTracks().forEach((t) => t.stop());
          };
          scanLoop();
          toast("Scanning… show seller QR to camera");
          return;
        } catch (e) {
          console.warn("BarcodeDetector fallback", e);
        }
      }

      // Fallback: ask user to paste code
      const code = prompt("Paste seller QR code text (dev mode):");
      if (code) handleQR(code);
    });
  }

  async function handleQR(code) {
    try {
      const res = await apiPost(`${API_BASE}/api/qr-scan`, { code });
      const sellerId = res.sellerId || res?.seller?._id;
      if (!sellerId) {
        toast("QR not recognized");
        return;
      }
      location.href = `/seller/${sellerId}`;
    } catch (e) {
      console.error(e);
      toast("QR scan failed");
    }
  }

  // -----------------------------
  // Location / Mini Map & Settings Map (+ reverse geocode)
  // -----------------------------
  function initLocation() {
    if (els.locBtn) {
      els.locBtn.addEventListener("click", async () => {
        if (els.map.style.display === "none") {
          els.map.style.display = "block";
          initMiniMap();
        } else {
          els.map.style.display = "none";
        }
      });
    }

    // Settings map shown when user clicks Settings pill
  }

  function initMiniMap() {
    if (state.miniMap) {
      state.miniMap.invalidateSize();
      return;
    }
    state.miniMap = L.map("map");
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(state.miniMap);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        state.miniMap.setView(latlng, 14);
        L.marker(latlng).addTo(state.miniMap);
      },
      () => {
        state.miniMap.setView([0, 0], 2);
      },
      { enableHighAccuracy: true },
    );
  }

  function ensureSettingsMap() {
    if (!els.buyerMap) return;
    if (state.settingsMap) {
      state.settingsMap.invalidateSize();
      return;
    }

    state.settingsMap = L.map("buyerMap");
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(state.settingsMap);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        state.settingsMap.setView(latlng, 14);
        state.settingsMarker = L.marker(latlng, { draggable: true }).addTo(
          state.settingsMap,
        );
        state.settingsMarker.on("dragend", () =>
          onMarkerMove(state.settingsMarker.getLatLng()),
        );
        onMarkerMove({ lat: latlng[0], lng: latlng[1] });
      },
      () => {
        const latlng = [0, 0];
        state.settingsMap.setView(latlng, 2);
        state.settingsMarker = L.marker(latlng, { draggable: true }).addTo(
          state.settingsMap,
        );
        state.settingsMarker.on("dragend", () =>
          onMarkerMove(state.settingsMarker.getLatLng()),
        );
      },
      { enableHighAccuracy: true },
    );

    state.settingsMap.on("click", (e) => {
      const latlng = e.latlng;
      state.settingsMarker.setLatLng(latlng);
      onMarkerMove(latlng);
    });
  }

  async function onMarkerMove(latlng) {
    if (!USE_NOMINATIM) return;
    try {
      const url = `${NOMINATIM_URL}&lat=${latlng.lat}&lon=${latlng.lng}`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const json = await res.json();
      els.setLocation.value =
        json.display_name ||
        `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    } catch {
      els.setLocation.value = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    }
  }

  // -----------------------------
  // Bottom Nav / Views / Pills
  // -----------------------------
  function initNav() {
    // =====================================================
    // CENTRAL VIEW SWITCHER
    // =====================================================

    function showView(view) {
      if (!els.views[view]) {
        view = "home";
      }

      // Navigation buttons
      els.navBtns.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.view === view);
      });

      // Actual views
      Object.entries(els.views).forEach(([key, element]) => {
        if (!element) return;

        element.classList.toggle("active", key === view);
      });

      // Messages-specific layout state
      document.body.classList.toggle("messages-active", view === "messages");

      return view;
    }

    // =====================================================
    // BOTTOM NAVIGATION
    // =====================================================

    els.navBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;

        showView(view);

        // Keep URL aware of active view
        const url = new URL(window.location.href);

        url.searchParams.set("view", view);

        window.history.replaceState({}, "", url);
      });
    });

    // =====================================================
    // INITIAL VIEW FROM URL
    // =====================================================

    const params = new URLSearchParams(window.location.search);

    const requestedView = params.get("view");

    if (requestedView && els.views[requestedView]) {
      showView(requestedView);
    } else {
      showView("home");
    }

    // =====================================================
    // LOCATION BUTTON
    // Home → Me → Settings
    // =====================================================

    if (els.locBtn) {
      els.locBtn.addEventListener("click", () => {
        showView("me");

        showMeSection("settings");

        ensureSettingsMap();

        const url = new URL(window.location.href);

        url.searchParams.set("view", "me");

        window.history.replaceState({}, "", url);
      });
    }

    // =====================================================
    // CART BUTTON
    // Home → Packages
    // =====================================================

    if (els.cartBtn) {
      els.cartBtn.addEventListener("click", () => {
        showView("packages");

        const url = new URL(window.location.href);

        url.searchParams.set("view", "packages");

        window.history.replaceState({}, "", url);

        toast("Opening your cart…");
      });
    }

    // =====================================================
    // PACKAGES PILLS
    // =====================================================

    els.pkgPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        els.pkgPills.forEach((button) => button.classList.remove("active"));

        pill.classList.add("active");

        const key = pill.dataset.pkg;

        if (els.pkgProgress) {
          els.pkgProgress.style.display = key === "progress" ? "" : "none";
        }

        if (els.pkgReady) {
          els.pkgReady.style.display = key === "ready" ? "" : "none";
        }

        if (key === "cart") {
          gotoCartTab();
        }
      });
    });

    // =====================================================
    // ME PILLS
    // =====================================================

    els.mePills.forEach((pill) => {
      pill.addEventListener("click", () => {
        els.mePills.forEach((button) => button.classList.remove("active"));

        pill.classList.add("active");

        showMeSection(pill.dataset.me);
      });
    });

    // =====================================================
    // PACKAGE EMPTY STATES
    // =====================================================

    if (els.pkgProgress && !els.pkgProgress.innerHTML.trim()) {
      els.pkgProgress.textContent = "No products in progress.";
    }

    if (els.pkgReady && !els.pkgReady.innerHTML.trim()) {
      els.pkgReady.textContent = "No products ready for pickup.";
    }
  }
  function gotoCartTab() {
    const cartPill = els.mePills.find((p) => p.dataset.me === "cart");
    if (cartPill) {
      els.mePills.forEach((b) => b.classList.remove("active"));
      cartPill.classList.add("active");
    }
    showMeSection("cart");
    // render cart
    renderCart();
  }

  function showMeSection(key) {
    els.meProfile.style.display = key === "profile" ? "" : "none";
    els.meSettings.style.display = key === "settings" ? "" : "none";
    els.meCart.style.display = key === "cart" ? "" : "none";
    els.meOrders.style.display = key === "orders" ? "" : "none";
    els.meMore.style.display = key === "more" ? "" : "none";

    if (key === "settings") ensureSettingsMap();
  }

  // -----------------------------
  // Cart (basic local fallback)
  // -----------------------------
  function renderCart() {
    // Try server cart later; for now read local fallback (we already update count from server if available)
    const cart = JSON.parse(localStorage.getItem("ngoxi_cart") || "[]");
    els.cartList.innerHTML = "";
    if (!cart.length) {
      els.cartEmpty.style.display = "";
      els.checkoutBtn.style.display = "none";
      return;
    }
    els.cartEmpty.style.display = "none";
    els.checkoutBtn.style.display = "";

    for (const item of cart) {
      const p = state.productById.get(item.id);
      const row = document.createElement("div");
      row.className = "cart-row";
      const img = p ? productCover(p) : "";
      row.innerHTML = `
        <img class="cart-img" src="${img}" alt=""/>
        <div>
          <div style="font-weight:700">${escapeHTML(p?.name || "Product")}</div>
          <div class="muted" style="font-size:12px">${escapeHTML((p?.description || "").slice(0, 60))}</div>
          <div class="cart-controls">
            <button class="btn sm dec">-</button>
            <span>${item.qty}</span>
            <button class="btn sm inc">+</button>
            <button class="btn sm outline rm">Remove</button>
          </div>
        </div>
        <div class="cart-price">${currency((p?.price || 0) * item.qty)}</div>
      `;
      $(".dec", row).onclick = () => {
        item.qty = Math.max(1, item.qty - 1);
        saveCart(cart);
        renderCart();
        updateCartCount();
      };
      $(".inc", row).onclick = () => {
        item.qty += 1;
        saveCart(cart);
        renderCart();
        updateCartCount();
      };
      $(".rm", row).onclick = () => {
        const idx = cart.findIndex((x) => x.id === item.id);
        cart.splice(idx, 1);
        saveCart(cart);
        renderCart();
        updateCartCount();
      };
      els.cartList.appendChild(row);
    }
  }
  function saveCart(cart) {
    localStorage.setItem("ngoxi_cart", JSON.stringify(cart));
  }

  // -----------------------------
  // Chat (Socket.io)
  // -----------------------------
  function initSocket() {
    if (!window.io) return;
    state.socket = io(API_BASE, {
      transports: ["websocket"],
      withCredentials: true,
      reconnection: true,
    });

    const setStatus = (s) => {
      if (els.chatStatus) {
        els.chatStatus.textContent = s;
        els.chatStatus.className = `status ${s}`;
      }
    };

    state.socket.on("connect", () => setStatus("online"));
    state.socket.on("disconnect", () => setStatus("offline"));
    state.socket.on("connect_error", () => setStatus("offline"));

    // Example events; adjust to your server events:
    state.socket.on("system", (msg) =>
      pushChat("system", msg.text || JSON.stringify(msg)),
    );
  }
  async function loadConversations() {
    try {
      const response = await fetch(`${API_BASE}/api/chats`, {
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not load conversations");
      }

      const chats = Array.isArray(data.conversations) ? data.conversations : [];

      state.chats.conversations.clear();

      chats.forEach((chat) => {
        const seller = chat.seller;

        if (!seller?._id) return;

        const sellerId = String(seller._id);

        const avatar =
          seller?.sellerProfile?.avatar?.url ||
          seller?.avatar ||
          "/assets/default-avatar.jpeg";

        const messages = Array.isArray(chat.messages)
          ? chat.messages.map((message) => ({
              ...message,

              sender:
                message.senderRole ||
                (String(message.sender) === sellerId ? "seller" : "buyer"),
            }))
          : [];

        state.chats.conversations.set(sellerId, {
          id: chat._id,
          conversationId: chat._id,

          sellerId,

          seller: {
            id: sellerId,
            _id: sellerId,

            name: seller.name || "Seller",

            storeName: seller.storeName || seller.name || "Seller",

            avatar,

            online: false,
          },

          messages,

          orders: [],

          paymentDetails: [],

          unread: 0,

          lastMessageAt: chat.lastMessageAt || chat.updatedAt || null,
        });
      });

      renderConversationList();

      return chats;
    } catch (err) {
      console.error("Failed loading conversations", err);

      return [];
    }
  }

  function renderConversationList() {
    if (!els.chatList) return;

    els.chatList.innerHTML = "";

    const conversations = Array.from(state.chats.conversations.values()).sort(
      (a, b) => {
        return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
      },
    );

    if (!conversations.length) {
      els.chatList.innerHTML = `
      <div class="ngx-empty-conversations">
        No conversations yet.
      </div>
    `;

      return;
    }

    conversations.forEach((conversation) => {
      const seller = conversation.seller;

      const lastMessage =
        conversation.messages[conversation.messages.length - 1];

      const div = document.createElement("div");

      div.className = "ngx-conversation";

      div.dataset.sellerId = conversation.sellerId;

      div.innerHTML = `
        <div class="ngx-avatar">
          <img
            src="${escapeHTML(seller.avatar || "/assets/default-avatar.jpeg")}"
            alt=""
          >
        </div>

        <div class="ngx-conversation-info">

          <div class="ngx-conversation-top">
            <b>
              ${escapeHTML(seller.storeName || seller.name || "Seller")}
            </b>

            <span>
              ${
                conversation.lastMessageAt
                  ? formatChatTime(conversation.lastMessageAt)
                  : ""
              }
            </span>
          </div>

          <p>
            ${escapeHTML(lastMessage?.text || "Start conversation")}
          </p>

        </div>
      `;

      div.addEventListener("click", () => {
        openSellerConversation(conversation.sellerId);
      });

      els.chatList.appendChild(div);
    });
  }

  function pushChat(who, text) {
    if (!els.chatBody) return;
    const row = document.createElement("div");
    row.className = `chat-row ${who}`;
    row.textContent = text;
    els.chatBody.appendChild(row);
    els.chatBody.scrollTop = els.chatBody.scrollHeight;
  }

  function loadDeals(products = []) {
    const grid = document.getElementById("dealsGrid");
    if (!grid) return;

    const deals = products.filter(isDiscountedProduct).slice(0, 8);

    grid.innerHTML = "";

    if (!deals.length) {
      grid.innerHTML = `
      <div class="muted">
        No discounted products yet.
      </div>
    `;

      return;
    }

    deals.forEach((product) => {
      grid.appendChild(renderCard(product));
    });
  }
  // -----------------------------
  // Events wiring
  // -----------------------------
  function wireEvents() {
    els.themeToggle?.addEventListener("click", toggleTheme);
    els.searchInput?.addEventListener("input", onSearchInput);
    els.psClose?.addEventListener("click", closeProductSheet);

    // Close sheet on backdrop click
    els.productSheet?.addEventListener("click", (e) => {
      if (e.target === els.productSheet) closeProductSheet();
    });

    // Save settings
    els.saveSettings?.addEventListener("click", () => {
      const payload = {
        name: els.setName?.value || "",
        phone: els.setPhone?.value || "",
        email: els.setEmail?.value || "",
        address: els.setLocation?.value || "",
      };
      // Hook to your backend user settings endpoint if you have one:
      // apiPost(`${API_BASE}/api/user/settings`, payload)
      toast("Saved (local demo). Hook your /api/user/settings to persist.");
    });

    els.logoutBtn?.addEventListener("click", async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Logout failed");
        }

        window.location.href = "/auth.html";
      } catch (error) {
        console.error("Logout failed:", error);

        toast("Could not log out.");
      }
    });

    // Mode navigation

    const modeRoutes = {
      mamba: "/mamba.html",
      trendy: "/trendy.html",
      group: "/group.html",
      discount: "/discount.html",
      others: "/others.html",
    };

    document.querySelectorAll(".mode-card").forEach((card) => {
      card.addEventListener("click", () => {
        const mode = card.dataset.mode;

        const page = modeRoutes[mode];

        if (page) {
          window.location.href = page;
        }
      });
    });
  }
  function initCategoryCarousel() {
    const categoryStrip = document.querySelector(".category-strip");

    const categoryScroll = categoryStrip?.querySelector(".category-scroll");

    const arrows = categoryStrip?.querySelectorAll(".category-arrow");

    if (!categoryScroll || arrows.length < 2) return;

    arrows[0].onclick = () => {
      categoryScroll.scrollLeft -= 400;
    };

    arrows[1].onclick = () => {
      categoryScroll.scrollLeft += 400;
    };

    categoryScroll.querySelectorAll(".category").forEach((button) => {
      button.addEventListener("click", () => {
        categoryScroll
          .querySelectorAll(".category")
          .forEach((btn) => btn.classList.remove("active"));

        button.classList.add("active");

        state.marketplace.category = button.dataset.category;

        refreshMarketplace();
      });
    });
  }
  const chatOptionsBtn = document.getElementById("chatOptionsBtn");

  const chatOptionsMenu = document.getElementById("chatOptionsMenu");

  const toggleTransactionCard = document.getElementById(
    "toggleTransactionCard",
  );

  const transactionCenter = document.getElementById("transactionCenter");

  function closeChatOptions() {
    chatOptionsMenu?.classList.remove("open");

    chatOptionsBtn?.setAttribute("aria-expanded", "false");
  }

  chatOptionsBtn?.addEventListener("click", (event) => {
    event.stopPropagation();

    const open = chatOptionsMenu?.classList.toggle("open");

    chatOptionsBtn.setAttribute("aria-expanded", String(Boolean(open)));
  });

  chatOptionsMenu?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  toggleTransactionCard?.addEventListener("click", () => {
    if (!transactionCenter) return;

    const hidden = transactionCenter.classList.toggle("user-hidden");

    toggleTransactionCard.textContent = hidden
      ? "Show transaction card"
      : "Hide transaction card";

    closeChatOptions();
  });

  document.addEventListener("click", closeChatOptions);
  function initMessageFilterOverflow() {
    const button = document.getElementById("ngxFilterMoreBtn");

    const menu = document.getElementById("ngxFilterMoreMenu");

    if (!button || !menu) return;

    button.addEventListener("click", (event) => {
      event.stopPropagation();

      menu.classList.toggle("open");
    });

    menu.addEventListener("click", (event) => {
      const target = event.target.closest("[data-filter-proxy]");

      if (!target) return;

      const type = target.dataset.filterProxy;

      const realButton = document.getElementById(
        type === "orders" ? "ngxFilterOrders" : "ngxFilterFavorites",
      );

      realButton?.click();

      menu.classList.remove("open");
    });

    document.addEventListener("click", () => {
      menu.classList.remove("open");
    });
  }

  function formatChatTime(value) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  // =========================================================
  // NGOXI SELLER CONVERSATIONS V1
  // =========================================================

  function normalizeSellerId(seller) {
    return String(seller?.id || seller?._id || seller?.sellerId || "");
  }

  function getOrCreateConversation(seller) {
    const sellerId = normalizeSellerId(seller);

    if (!sellerId) {
      console.warn("Cannot create conversation without seller ID", seller);

      return null;
    }

    let conversation = state.chats.conversations.get(sellerId);

    if (!conversation) {
      conversation = {
        sellerId,

        seller: {
          id: sellerId,

          name: seller.name || "Seller",

          storeName: seller.storeName || "",

          avatar: seller.avatar || "/assets/default-avatar.jpeg",

          verified: seller.verified || false,

          rating: seller.rating || 0,

          location: seller.location || "",
        },

        paymentDetails: seller.paymentDetails || seller.paymentInfo || [],

        messages: [],

        orders: [],

        unread: 0,

        lastMessageAt: null,
      };

      state.chats.conversations.set(sellerId, conversation);
    }

    return conversation;
  }

  function getActiveConversation() {
    const sellerId = state.chats.activeSellerId;

    if (!sellerId) {
      return null;
    }

    return state.chats.conversations.get(sellerId) || null;
  }

  function renderActiveSellerHeader(seller) {
    const header = document.querySelector("#view-messages .ngx-seller");

    if (!header || !seller) {
      return;
    }
    const sellerName = document.getElementById("activeSellerName");

    const sellerAvatar = document.getElementById("activeSellerAvatar");

    if (sellerName) {
      sellerName.textContent = seller.storeName || seller.name || "Seller";
    }

    if (sellerAvatar) {
      sellerAvatar.src = seller.avatar || "/assets/default-avatar.jpeg";
    }
    const image = header.querySelector("img");

    const name = header.querySelector("h3");

    const status = header.querySelector("span");

    if (image) {
      image.src = seller.avatar || "/assets/default-avatar.png";
    }

    if (name) {
      name.textContent = seller.name || "Seller";
    }

    if (status) {
      status.textContent = seller.online ? "Online" : "Offline";
    }
  }

  function renderActiveConversationMessages() {
    const conversation = getActiveConversation();

    const chatBody = document.getElementById("chatBody");

    if (!conversation || !chatBody) {
      return;
    }

    chatBody.innerHTML = "";

    conversation.messages.forEach((message) => {
      const bubble = document.createElement("div");

      bubble.className =
        message.sender === "buyer" ? "ngx-message buyer" : "ngx-message seller";

      bubble.innerHTML = `
        <div class="ngx-message-text">
          ${escapeHTML(message.text || "")}
        </div>

        <small>
          ${formatChatTime(message.createdAt)}
        </small>
      `;

      chatBody.appendChild(bubble);
    });

    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function openSellerConversation(sellerId) {
    sellerId = String(sellerId);

    const conversation = state.chats.conversations.get(sellerId);

    if (!conversation) {
      console.warn("Conversation not found:", sellerId);

      return;
    }

    state.chats.activeSellerId = sellerId;

    conversation.unread = 0;

    renderActiveSellerHeader(conversation.seller);

    renderActiveConversationMessages();

    transactionCenterAPI?.setOrders(conversation.orders);
  }

  function openMessagesView() {
    const messagesBtn = els.navBtns.find(
      (button) => button.dataset.view === "messages",
    );

    messagesBtn?.click();
  }
  function normalizeTransactionOrder(order) {
    return {
      ...order,

      id: order.id || order._id,

      product:
        order.product || order.productName || order.product?.name || "Product",

      image:
        order.image ||
        order.productImage ||
        order.product?.image ||
        "/assets/default-product.png",

      variant: order.variant || order.variantName || "Default",

      price: Number(order.price || order.total || 0),

      payment: {
        status: order.payment?.status || "waiting",

        receiptId: order.payment?.receiptId || null,

        receiptName: order.payment?.receiptName || null,

        receiptUrl: order.payment?.receiptUrl || null,

        uploadedAt: order.payment?.uploadedAt || null,
      },

      paymentMethods: order.paymentMethods || [],

      orderStatus: order.orderStatus || "placed",
    };
  }
  function consumeChatHandoff() {
    const raw = sessionStorage.getItem("ngx_open_chat");

    if (!raw) {
      return;
    }

    try {
      const data = JSON.parse(raw);

      if (!data?.seller || !data?.conversationId) {
        console.warn("Invalid NgoXi chat handoff", data);

        return;
      }

      const conversation = getOrCreateConversation(data.seller);

      if (!conversation) {
        return;
      }

      conversation.id = data.conversationId;

      conversation.conversationId = data.conversationId;

      if (data.orderDraft) {
        conversation.orders.push(normalizeTransactionOrder(data.orderDraft));
      }

      openMessagesView();

      openSellerConversation(conversation.sellerId);
    } catch (error) {
      console.error("Failed to consume chat handoff", error);
    } finally {
      sessionStorage.removeItem("ngx_open_chat");
    }
  }
  // =========================================================
  // NGOXI CHAT COMPOSER V1
  // =========================================================

  function initChatComposer() {
    const composer = document.querySelector(
      "#view-messages .ngx-message-input",
    );

    const input = document.getElementById("chatMessageInput");

    const sendBtn = document.getElementById("chatSendBtn");

    const attachBtn = document.getElementById("chatAttachBtn");

    const cameraBtn = document.getElementById("chatCameraBtn");

    const emojiBtn = document.getElementById("chatEmojiBtn");

    const chatBody = document.getElementById("chatBody");

    if (
      !composer ||
      !input ||
      !sendBtn ||
      !attachBtn ||
      !cameraBtn ||
      !emojiBtn ||
      !chatBody
    ) {
      console.warn("NgoXi Chat Composer elements missing");

      return;
    }

    // -----------------------------------------
    // STATE
    // -----------------------------------------

    let selectedFile = null;
    let selectedFileURL = null;
    let sending = false;

    // -----------------------------------------
    // HIDDEN FILE INPUTS
    // -----------------------------------------

    const attachmentInput = document.createElement("input");

    attachmentInput.type = "file";
    attachmentInput.hidden = true;

    attachmentInput.accept = "image/*";

    const cameraInput = document.createElement("input");

    cameraInput.type = "file";
    cameraInput.hidden = true;

    cameraInput.accept = "image/*";

    cameraInput.setAttribute("capture", "environment");

    document.body.appendChild(attachmentInput);

    document.body.appendChild(cameraInput);

    // -----------------------------------------
    // ATTACHMENT PREVIEW
    // -----------------------------------------

    const preview = document.createElement("div");

    preview.className = "ngx-attachment-preview";

    preview.hidden = true;

    preview.innerHTML = `
    <div class="ngx-attachment-preview-content">

      <div
        class="ngx-attachment-thumb"
        id="ngxAttachmentThumb"
      ></div>

      <div class="ngx-attachment-meta">

        <strong
          id="ngxAttachmentName"
        ></strong>

        <span
          id="ngxAttachmentSize"
        ></span>

      </div>

      <button
        id="ngxAttachmentRemove"
        type="button"
        aria-label="Remove attachment"
      >
        <i data-lucide="x"></i>
      </button>

    </div>
  `;

    composer.parentElement.insertBefore(preview, composer);

    const attachmentThumb = preview.querySelector("#ngxAttachmentThumb");

    const attachmentName = preview.querySelector("#ngxAttachmentName");

    const attachmentSize = preview.querySelector("#ngxAttachmentSize");

    const attachmentRemove = preview.querySelector("#ngxAttachmentRemove");

    // -----------------------------------------
    // EMOJI PICKER
    // -----------------------------------------

    const emojiPicker = document.createElement("div");

    emojiPicker.className = "ngx-emoji-picker";

    emojiPicker.hidden = true;

    const emojiGroups = [
      {
        icon: "😀",
        emojis: [
          "😀",
          "😃",
          "😄",
          "😁",
          "😂",
          "🤣",
          "🥹",
          "😊",
          "😍",
          "🥰",
          "😘",
          "😎",
          "🤔",
          "😐",
          "🙄",
          "😴",
          "😭",
          "😡",
          "🤯",
          "💀",
        ],
      },

      {
        icon: "👍",
        emojis: [
          "👍",
          "👎",
          "👌",
          "✌️",
          "🤞",
          "🤝",
          "👏",
          "🙌",
          "🙏",
          "💪",
          "👀",
          "🫡",
          "👊",
          "✋",
          "🤌",
          "💯",
        ],
      },

      {
        icon: "❤️",
        emojis: [
          "❤️",
          "🧡",
          "💛",
          "💚",
          "💙",
          "💜",
          "🖤",
          "🤍",
          "💔",
          "💕",
          "💞",
          "💓",
          "🔥",
          "✨",
          "⭐",
          "🎉",
        ],
      },

      {
        icon: "⚽",
        emojis: [
          "⚽",
          "🏀",
          "🏈",
          "🎮",
          "🎧",
          "🎵",
          "🍔",
          "🍕",
          "🍗",
          "☕",
          "🚗",
          "🏍️",
          "✈️",
          "📱",
          "💻",
          "💡",
        ],
      },
    ];

    let activeEmojiGroup = 0;

    emojiPicker.innerHTML = `
    <div
      class="ngx-emoji-grid"
      id="ngxEmojiGrid"
    ></div>

    <div
      class="ngx-emoji-tabs"
      id="ngxEmojiTabs"
    ></div>
  `;

    composer.appendChild(emojiPicker);

    const emojiGrid = emojiPicker.querySelector("#ngxEmojiGrid");

    const emojiTabs = emojiPicker.querySelector("#ngxEmojiTabs");

    function renderEmojiPicker() {
      const group = emojiGroups[activeEmojiGroup];

      emojiGrid.innerHTML = group.emojis
        .map(
          (emoji) => `
            <button
              type="button"
              class="ngx-emoji-item"
              data-emoji="${emoji}"
            >
              ${emoji}
            </button>
          `,
        )
        .join("");

      emojiTabs.innerHTML = emojiGroups
        .map(
          (groupItem, index) => `
            <button
              type="button"
              class="${index === activeEmojiGroup ? "active" : ""}"
              data-emoji-group="${index}"
            >
              ${groupItem.icon}
            </button>
          `,
        )
        .join("");
    }

    renderEmojiPicker();

    // -----------------------------------------
    // HELPERS
    // -----------------------------------------

    function humanFileSize(bytes) {
      if (!bytes) return "0 KB";

      const units = ["B", "KB", "MB", "GB"];

      const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1,
      );

      const amount = bytes / Math.pow(1024, index);

      return `${amount.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
    }

    function clearSelectedFile() {
      if (selectedFileURL) {
        URL.revokeObjectURL(selectedFileURL);
      }

      selectedFile = null;
      selectedFileURL = null;

      attachmentInput.value = "";
      cameraInput.value = "";

      preview.hidden = true;

      attachmentThumb.innerHTML = "";
      attachmentName.textContent = "";
      attachmentSize.textContent = "";

      updateSendState();
    }

    function setSelectedFile(file) {
      clearSelectedFile();

      if (!file) return;

      selectedFile = file;

      attachmentName.textContent = file.name;

      attachmentSize.textContent = humanFileSize(file.size);

      preview.hidden = false;

      if (file.type.startsWith("image/")) {
        selectedFileURL = URL.createObjectURL(file);

        attachmentThumb.innerHTML = `
        <img
          src="${selectedFileURL}"
          alt=""
        >
      `;
      } else {
        attachmentThumb.innerHTML = `
        <i data-lucide="file"></i>
      `;
      }

      if (window.lucide) {
        lucide.createIcons();
      }

      updateSendState();

      input.focus();
    }

    function hasContent() {
      return Boolean(input.value.trim() || selectedFile);
    }

    function updateSendState() {
      const active = hasContent() && !sending;

      sendBtn.disabled = !active;

      sendBtn.classList.toggle("ready", active);
    }

    function insertEmojiAtCursor(emoji) {
      const start = input.selectionStart ?? input.value.length;

      const end = input.selectionEnd ?? input.value.length;

      const before = input.value.slice(0, start);

      const after = input.value.slice(end);

      input.value = before + emoji + after;

      const cursor = start + emoji.length;

      input.focus();

      input.setSelectionRange(cursor, cursor);

      updateSendState();
    }

    function scrollChatToBottom() {
      requestAnimationFrame(() => {
        chatBody.scrollTop = chatBody.scrollHeight;
      });
    }

    // -----------------------------------------
    // MESSAGE RENDERING
    // -----------------------------------------
    function getMessageTick(status) {
      switch (status) {
        case "read":
          return {
            icon: "check-check",
            className: "read",
          };

        case "delivered":
          return {
            icon: "check-check",
            className: "",
          };

        case "sent":
        default:
          return {
            icon: "check",
            className: "",
          };
      }
    }
    function renderOutgoingMessage({
      text = "",
      image = null,
      file = null,
      fileName = "",
      time = new Date(),
      status = "sent",
    }) {
      const bubble = document.createElement("div");

      bubble.className = "ngx-message buyer ngx-message-v1";

      let contentHTML = "";

      if (image) {
        contentHTML += `
        <img
          class="ngx-chat-image"
          src="${escapeHTML(image)}"
          alt="Attachment"
        >
      `;
      }

      if (file && !image) {
        contentHTML += `
        <a
          class="ngx-chat-file"
          href="${escapeHTML(file)}"
          target="_blank"
          rel="noopener"
        >
          <i data-lucide="file-text"></i>

          <span>
            ${escapeHTML(fileName || "Attachment")}
          </span>
        </a>
      `;
      }

      if (text) {
        contentHTML += `<div class="ngx-message-text">${escapeHTML(text)}</div>`;
      }
      const tick = getMessageTick(status);

      bubble.innerHTML = `
      ${contentHTML}

      <div
        class="ngx-message-meta"
      >

        <span>
          ${formatChatTime(time)}
        </span>

       <i
         data-lucide="${tick.icon}"
         class="${tick.className}"
       ></i>

      </div>
    `;

      chatBody.appendChild(bubble);

      if (window.lucide) {
        lucide.createIcons();
      }

      scrollChatToBottom();

      return bubble;
    }

    function renderIncomingMessage(payload) {
      const bubble = document.createElement("div");

      bubble.className = "ngx-message seller ngx-message-v1";

      const text = payload?.text || "";

      bubble.innerHTML = `
  <div class="ngx-message-text">${escapeHTML(text)}</div>
  <div class="ngx-message-meta">${formatChatTime(
    payload?.createdAt || new Date(),
  )}</div>
`;

      chatBody.appendChild(bubble);

      scrollChatToBottom();
    }

    // -----------------------------------------
    // FILE UPLOAD
    // -----------------------------------------
    async function uploadChatImage(file) {
      if (!file) {
        throw new Error("No image selected");
      }

      if (!file.type.startsWith("image/")) {
        throw new Error("Only images are supported right now");
      }

      const form = new FormData();

      form.append("file", file);

      const response = await fetch(`${API_BASE}/api/upload/image`, {
        method: "POST",
        body: form,
        credentials: "include",
      });

      if (!response.ok) {
        const responseText = await response.text();

        console.error(
          "Chat image upload failed:",
          response.status,
          responseText,
        );

        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();

      const url = data.url || data.secure_url || data.imageUrl;

      if (!url) {
        console.error("Unexpected upload response:", data);

        throw new Error("No image URL returned");
      }

      return url;
    }

    // -----------------------------------------
    // SEND
    // -----------------------------------------

    async function sendMessage() {
      if (sending || !hasContent()) {
        return;
      }

      const text = input.value.trim();

      const file = selectedFile;

      sending = true;
      updateSendState();

      try {
        let uploadedURL = null;

        if (file) {
          uploadedURL = await uploadChatImage(file);
        }

        const payload = {
          text,
          createdAt: new Date().toISOString(),
        };

        if (uploadedURL) {
          payload.image = uploadedURL;
        }

        state.socket?.emit("message", payload);

        renderOutgoingMessage({
          text,
          image: uploadedURL,
          time: payload.createdAt,
          status: "sent",
        });

        input.value = "";

        clearSelectedFile();

        emojiPicker.hidden = true;
      } catch (error) {
        console.error("Chat send failed", error);

        toast("Message could not be sent");
      } finally {
        sending = false;

        updateSendState();

        input.focus();
      }
    }
    function openChatImageViewer(src) {
      let viewer = document.getElementById("ngxChatImageViewer");

      if (!viewer) {
        viewer = document.createElement("div");

        viewer.id = "ngxChatImageViewer";

        viewer.className = "ngx-chat-image-viewer";

        viewer.innerHTML = `
      <button
        type="button"
        class="ngx-chat-image-close"
        aria-label="Close image"
      >
        <i data-lucide="x"></i>
      </button>

      <img
        id="ngxChatImageViewerImage"
        alt="Chat image"
      >
    `;

        document.body.appendChild(viewer);

        viewer
          .querySelector(".ngx-chat-image-close")
          .addEventListener("click", () => {
            viewer.classList.remove("show");
          });

        viewer.addEventListener("click", (event) => {
          if (event.target === viewer) {
            viewer.classList.remove("show");
          }
        });
      }

      viewer.querySelector("#ngxChatImageViewerImage").src = src;

      viewer.classList.add("show");

      if (window.lucide) {
        lucide.createIcons();
      }
    }
    chatBody.addEventListener("click", (event) => {
      const image = event.target.closest(".ngx-chat-image");

      if (!image) return;

      openChatImageViewer(image.src);
    });
    // -----------------------------------------
    // COMPOSER EVENTS
    // -----------------------------------------

    input.addEventListener("input", updateSendState);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();

        sendMessage();
      }
    });

    sendBtn.addEventListener("click", sendMessage);

    attachBtn.addEventListener("click", () => {
      attachmentInput.value = "";

      attachmentInput.click();
    });

    cameraBtn.addEventListener("click", () => {
      cameraInput.value = "";

      cameraInput.click();
    });

    attachmentInput.addEventListener("change", () => {
      setSelectedFile(attachmentInput.files?.[0]);
    });

    cameraInput.addEventListener("change", () => {
      setSelectedFile(cameraInput.files?.[0]);
    });

    attachmentRemove.addEventListener("click", clearSelectedFile);

    emojiBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      emojiPicker.hidden = !emojiPicker.hidden;

      if (!emojiPicker.hidden) {
        input.focus();
      }
    });

    emojiGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-emoji]");

      if (!button) return;

      event.stopPropagation();

      insertEmojiAtCursor(button.dataset.emoji);
    });

    emojiTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-emoji-group]");

      if (!button) return;

      event.stopPropagation();

      activeEmojiGroup = Number(button.dataset.emojiGroup);

      renderEmojiPicker();
    });

    emojiPicker.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("click", () => {
      emojiPicker.hidden = true;
    });

    // -----------------------------------------
    // SOCKET RECEIVE
    // -----------------------------------------

    state.socket?.on("message", (payload) => {
      /*
        Prevent this listener from
        rendering your own server echo
        later by checking senderId
        once your backend sends it.

        For now only incoming text
        messages are rendered here.
      */

      if (payload?.text) {
        renderIncomingMessage(payload);
      }
    });

    // -----------------------------------------
    // INITIAL STATE
    // -----------------------------------------

    updateSendState();

    if (window.lucide) {
      lucide.createIcons();
    }
  }
  // -----------------------------
  // Messages Sidebar Navigation
  // -----------------------------

  function initMessagesSidebarNav() {
    const nav = document.getElementById("bottomNav");

    const messagesView = document.getElementById("view-messages");

    const sidebar = document.querySelector("#view-messages .ngx-chat-sidebar");

    if (!nav || !messagesView || !sidebar) {
      console.warn("Messages sidebar nav elements missing");
      return;
    }

    // Remember the nav's original parent + position
    const originalParent = nav.parentElement;
    const originalNextSibling = nav.nextSibling;

    function moveNavIntoMessages() {
      if (nav.parentElement === sidebar) return;

      sidebar.appendChild(nav);

      nav.classList.add("ngx-sidebar-nav");
    }

    function restoreNav() {
      if (nav.parentElement !== sidebar) return;

      nav.classList.remove("ngx-sidebar-nav");

      if (
        originalNextSibling &&
        originalNextSibling.parentNode === originalParent
      ) {
        originalParent.insertBefore(nav, originalNextSibling);
      } else {
        originalParent.appendChild(nav);
      }
    }

    function syncNavLocation() {
      const messagesActive = messagesView.classList.contains("active");

      if (messagesActive) {
        moveNavIntoMessages();
      } else {
        restoreNav();
      }
    }

    // Watch view changes
    const observer = new MutationObserver(syncNavLocation);

    document.querySelectorAll(".view").forEach((view) => {
      observer.observe(view, {
        attributes: true,
        attributeFilter: ["class"],
      });
    });

    syncNavLocation();
  }

  // -----------------------------
  // Messages Sidebar Resizer
  // -----------------------------

  function initMessageSidebarResizer() {
    const sidebar = document.querySelector("#view-messages .ngx-chat-sidebar");

    const resizer = document.querySelector(
      "#view-messages .ngx-sidebar-resizer",
    );

    if (!sidebar || !resizer) {
      console.warn("Messages sidebar resizer not found");
      return;
    }

    const MIN_WIDTH = 230;
    const MAX_WIDTH = 470;

    function updateSidebarMode() {
      const width = sidebar.getBoundingClientRect().width;

      sidebar.classList.remove(
        "sidebar-compact",
        "sidebar-medium",
        "sidebar-wide",
      );

      if (width < 285) {
        sidebar.classList.add("sidebar-compact");
      } else if (width < 360) {
        sidebar.classList.add("sidebar-medium");
      } else {
        sidebar.classList.add("sidebar-wide");
      }
    }

    const savedWidth = Number(
      localStorage.getItem("ngoxi_messages_sidebar_width"),
    );

    if (savedWidth >= MIN_WIDTH && savedWidth <= MAX_WIDTH) {
      sidebar.style.width = `${savedWidth}px`;
    } else {
      sidebar.style.width = "330px";
    }

    updateSidebarMode();

    let resizing = false;

    resizer.addEventListener("mousedown", (event) => {
      event.preventDefault();

      resizing = true;

      document.body.classList.add("ngx-resizing-sidebar");
    });

    document.addEventListener("mousemove", (event) => {
      if (!resizing) return;

      const parentRect = sidebar.parentElement.getBoundingClientRect();

      let nextWidth = event.clientX - parentRect.left;

      nextWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, nextWidth));

      sidebar.style.width = `${nextWidth}px`;

      updateSidebarMode();
    });

    document.addEventListener("mouseup", () => {
      if (!resizing) return;

      resizing = false;

      document.body.classList.remove("ngx-resizing-sidebar");

      const finalWidth = Math.round(sidebar.getBoundingClientRect().width);

      localStorage.setItem("ngoxi_messages_sidebar_width", String(finalWidth));

      updateSidebarMode();
    });

    resizer.addEventListener("dblclick", () => {
      sidebar.style.width = "330px";

      localStorage.setItem("ngoxi_messages_sidebar_width", "330");

      updateSidebarMode();
    });
  }
  // -----------------------------
  // Transaction Center V1
  // -----------------------------
  let transactionCenterAPI = null;
  function initTransactionCenter() {
    const center = document.getElementById("transactionCenter");

    const ordersTab = document.getElementById("ordersTab");
    const paymentTab = document.getElementById("paymentTab");

    const ordersSlide = document.getElementById("ordersSlide");
    const paymentSlide = document.getElementById("paymentSlide");

    const orderIdEl = document.getElementById("transactionOrderId");
    const productNameEl = document.getElementById("transactionProductName");
    const variantEl = document.getElementById("transactionVariant");
    const priceEl = document.getElementById("transactionPrice");
    const productImageEl = document.getElementById("transactionProductImage");
    const statusEl = document.getElementById("transactionStatus");

    const paymentTitle = document.getElementById("paymentTitle");
    const paymentProduct = document.getElementById("paymentProduct");
    const paymentAmount = document.getElementById("paymentAmount");

    const uploadReceiptBtn = document.getElementById("uploadReceiptBtn");
    const cancelPaymentBtn = document.getElementById("cancelPaymentBtn");

    if (!center || !ordersTab || !paymentTab || !ordersSlide || !paymentSlide) {
      console.warn("NgoXi Transaction Center elements missing");
      return;
    }

    let transactionOrders = [];

    /* =====================================================
     STATE
  ===================================================== */

    let activeOrderIndex = 0;
    let activeSlide = "orders";

    let userPauseUntil = 0;
    let hoveringCenter = false;

    const AUTO_SLIDE_TIME = 7000;
    const USER_PAUSE_TIME = 12000;

    /* =====================================================
     RECEIPT FILE INPUT

     Created automatically so you don't need another
     HTML patch.
  ===================================================== */

    const receiptInput = document.createElement("input");

    receiptInput.type = "file";
    receiptInput.accept = "image/*";
    receiptInput.hidden = true;
    receiptInput.id = "transactionReceiptInput";

    document.body.appendChild(receiptInput);

    /* =====================================================
     HELPERS
  ===================================================== */

    function currentOrder() {
      return transactionOrders[activeOrderIndex];
    }

    function formatMoney(amount) {
      return currency(Number(amount || 0));
    }

    function pauseAutoRotation() {
      userPauseUntil = Date.now() + USER_PAUSE_TIME;
    }

    function createReceiptId() {
      const random = Math.floor(100000 + Math.random() * 900000);

      return `NGX-RCP-${random}`;
    }

    function paymentLabel(status) {
      switch (status) {
        case "receipt_uploaded":
          return "Receipt Uploaded";

        case "confirmed":
          return "Payment Confirmed";

        case "cancelled":
          return "Order Cancelled";

        default:
          return "Payment Required";
      }
    }

    /* =====================================================
     SLIDE SYSTEM
  ===================================================== */

    function showTransactionSlide(slide, manual = false) {
      activeSlide = slide;

      const ordersActive = slide === "orders";

      ordersSlide.classList.toggle("active", ordersActive);
      paymentSlide.classList.toggle("active", !ordersActive);

      ordersTab.classList.toggle("active", ordersActive);
      paymentTab.classList.toggle("active", !ordersActive);

      if (manual) {
        pauseAutoRotation();
      }

      renderTransactionCenter();
    }

    /* =====================================================
     ORDER PROGRESS

     Order states:

     placed
     paid
     preparing
     shipping
     delivered
  ===================================================== */

    function getOrderProgress(order) {
      let step = 0;

      if (order.payment.status === "confirmed") {
        step = 1;
      }

      if (order.orderStatus === "preparing") {
        step = 2;
      }

      if (order.orderStatus === "shipping") {
        step = 3;
      }

      if (order.orderStatus === "delivered") {
        step = 4;
      }

      return step;
    }

    function renderOrderTimeline(order) {
      if (!statusEl) return;

      const progress = getOrderProgress(order);

      const steps = [
        {
          icon: "✓",
          label: "Order placed",
        },
        {
          icon: "💳",
          label: "Payment",
        },
        {
          icon: "📦",
          label: "Preparing",
        },
        {
          icon: "🚚",
          label: "Delivery",
        },
        {
          icon: "✓",
          label: "Delivered",
        },
      ];

      statusEl.innerHTML = steps
        .map((step, index) => {
          let stateClass = "";

          if (index < progress) {
            stateClass = "done";
          } else if (index === progress) {
            stateClass = "active";
          }

          return `
          <div class="status-step ${stateClass}">
            <span>${step.icon}</span>
            <span>${step.label}</span>
          </div>
        `;
        })
        .join("");
    }

    /* =====================================================
     ORDERS SLIDE
  ===================================================== */

    function renderOrderSlide(order) {
      if (orderIdEl) {
        orderIdEl.textContent = `Order #${order.id}`;
      }

      if (productNameEl) {
        productNameEl.textContent = order.product;
      }

      if (variantEl) {
        variantEl.textContent = order.variant;
      }

      if (priceEl) {
        priceEl.textContent = formatMoney(order.price);
      }

      if (productImageEl) {
        productImageEl.src = order.image || "/assets/default-product.png";
      }

      const count = ordersSlide.querySelector(".transaction-top span");

      if (count) {
        count.textContent = `${activeOrderIndex + 1} / ${transactionOrders.length}`;
      }

      renderOrderTimeline(order);
    }

    /* =====================================================
     PAYMENT SLIDE
  ===================================================== */

    function renderPaymentSlide(order) {
      const status = order.payment.status;

      if (paymentProduct) {
        paymentProduct.textContent = order.product;
      }

      if (paymentAmount) {
        paymentAmount.textContent = formatMoney(order.price);
      }

      if (paymentTitle) {
        paymentTitle.textContent = paymentLabel(status);
      }

      if (!uploadReceiptBtn || !cancelPaymentBtn) {
        return;
      }

      uploadReceiptBtn.style.display = "";
      cancelPaymentBtn.style.display = "";

      if (status === "waiting") {
        uploadReceiptBtn.textContent = "I have paid • Upload receipt";

        uploadReceiptBtn.disabled = false;

        cancelPaymentBtn.textContent = "Cancel order";

        cancelPaymentBtn.disabled = false;
      }

      if (status === "receipt_uploaded") {
        uploadReceiptBtn.textContent = "View receipt";

        uploadReceiptBtn.disabled = false;

        cancelPaymentBtn.textContent = "Waiting for seller";

        cancelPaymentBtn.disabled = true;
      }

      if (status === "confirmed") {
        uploadReceiptBtn.textContent = "Payment confirmed ✓";

        uploadReceiptBtn.disabled = true;

        cancelPaymentBtn.style.display = "none";
      }

      if (status === "cancelled") {
        uploadReceiptBtn.style.display = "none";

        cancelPaymentBtn.textContent = "Order cancelled";

        cancelPaymentBtn.disabled = true;
      }

      renderReceiptDetails(order);
      renderPaymentMethods(order);
    }
    let activePaymentMethod = 0;

    const paymentMethodsTrack = document.getElementById("paymentMethodsTrack");

    const paymentMethodPrev = document.getElementById("paymentMethodPrev");

    const paymentMethodNext = document.getElementById("paymentMethodNext");

    const paymentReceiptInfo = document.getElementById("paymentReceiptInfo");

    function renderPaymentMethods(order) {
      if (!paymentMethodsTrack) return;

      const methods = Array.isArray(order.paymentMethods)
        ? order.paymentMethods
        : [];
      paymentMethodsTrack.dataset.count = String(methods.length);

      if (!methods.length) {
        paymentMethodsTrack.innerHTML = `
      <div class="payment-method-card">
        <span>No payment method</span>
      </div>
    `;

        return;
      }

      activePaymentMethod = Math.max(
        0,
        Math.min(activePaymentMethod, methods.length - 1),
      );

      paymentMethodsTrack.innerHTML = methods
        .map(
          (method, index) => `
          <button
            class="payment-method-card ${
              index === activePaymentMethod ? "active" : ""
            }"
            data-payment-method="${index}"
            data-payment-label="${escapeHTML(method.label || "")}"
            data-payment-value="${escapeHTML(method.value || "")}"
            data-payment-name="${escapeHTML(method.name || "")}"
            type="button"
          >

            <span class="payment-method-label">
              ${method.label}
            </span>

            <strong>
              ${method.value}
            </strong>

            <small>
              ${method.name || ""}
            </small>

          </button>
        `,
        )
        .join("");

      const activeCard = paymentMethodsTrack.querySelector(
        ".payment-method-card.active",
      );

      activeCard?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
    paymentMethodPrev?.addEventListener("click", () => {
      const methods = currentOrder().paymentMethods || [];

      if (!methods.length) return;

      activePaymentMethod =
        activePaymentMethod === 0
          ? methods.length - 1
          : activePaymentMethod - 1;

      renderPaymentMethods(currentOrder());
    });
    paymentMethodsTrack?.addEventListener("click", async (event) => {
      const card = event.target.closest(".payment-method-card");

      if (!card) return;

      const index = Number(card.dataset.paymentMethod);

      if (!Number.isNaN(index)) {
        activePaymentMethod = index;

        renderPaymentMethods(currentOrder());
      }

      const label = card.dataset.paymentLabel || "";

      const value = card.dataset.paymentValue || "";

      const name = card.dataset.paymentName || "";

      const copyText = [label, value, name].filter(Boolean).join("\n");

      try {
        await navigator.clipboard.writeText(copyText);

        toast("Payment details copied ✓");
      } catch {
        const textarea = document.createElement("textarea");

        textarea.value = copyText;

        textarea.style.position = "fixed";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);

        textarea.select();

        document.execCommand("copy");

        textarea.remove();

        toast("Payment details copied ✓");
      }
    });
    paymentMethodNext?.addEventListener("click", () => {
      const methods = currentOrder().paymentMethods || [];

      if (!methods.length) return;

      activePaymentMethod = (activePaymentMethod + 1) % methods.length;

      renderPaymentMethods(currentOrder());
    });
    /* =====================================================
     RECEIPT INFORMATION

     Uses the existing bank-details box so no extra
     HTML is required.
  ===================================================== */

    function renderReceiptDetails(order) {
      const details = paymentSlide.querySelector(".bank-details");

      if (!details) return;

      const status = order.payment.status;

      if (status === "waiting") {
        details.innerHTML = `
        <p>CRDB BANK PLC</p>

        <b>0150 1234 5678 900</b>

        <small>
          Pay the exact amount shown above,
          then upload your receipt.
        </small>
      `;

        return;
      }

      if (status === "receipt_uploaded") {
        details.innerHTML = `
        <p>Receipt ID</p>

        <b>${order.payment.receiptId}</b>

        <small>
          ${order.payment.receiptName || "Receipt uploaded"}
          • Waiting for seller confirmation
        </small>
      `;

        return;
      }

      if (status === "confirmed") {
        details.innerHTML = `
        <p>Payment status</p>

        <b>Confirmed ✓</b>

        <small>
          The seller confirmed payment for
          Order #${order.id}.
        </small>
      `;

        return;
      }

      if (status === "cancelled") {
        details.innerHTML = `
        <p>Order status</p>

        <b>Cancelled</b>

        <small>
          Order #${order.id} is no longer active.
        </small>
      `;
      }
    }

    /* =====================================================
     MASTER RENDERER
  ===================================================== */

    function renderTransactionCenter() {
      const order = currentOrder();

      if (!order) {
        center.style.display = "none";
        return;
      }

      center.style.display = "";

      renderOrderSlide(order);
      renderPaymentSlide(order);
    }
    /* =====================================================
     ORDER CAROUSEL
  ===================================================== */

    const orderArrows = center.querySelectorAll(".order-arrow");

    if (orderArrows.length >= 2) {
      orderArrows[0].addEventListener("click", () => {
        pauseAutoRotation();

        activeOrderIndex =
          activeOrderIndex === 0
            ? transactionOrders.length - 1
            : activeOrderIndex - 1;

        renderTransactionCenter();
      });

      orderArrows[1].addEventListener("click", () => {
        pauseAutoRotation();

        activeOrderIndex = (activeOrderIndex + 1) % transactionOrders.length;

        renderTransactionCenter();
      });
    }

    /* =====================================================
     TAB EVENTS
  ===================================================== */

    ordersTab.addEventListener("click", () => {
      showTransactionSlide("orders", true);
    });

    paymentTab.addEventListener("click", () => {
      showTransactionSlide("payment", true);
    });
    function openReceiptViewer(order) {
      let viewer = document.getElementById("ngxReceiptViewer");

      if (!viewer) {
        viewer = document.createElement("div");

        viewer.id = "ngxReceiptViewer";
        viewer.className = "ngx-receipt-viewer";

        viewer.innerHTML = `
      <div class="ngx-receipt-modal">

        <div class="ngx-receipt-modal-header">
          <div>
            <strong>Payment Receipt</strong>
            <span id="ngxReceiptViewerId"></span>
          </div>

          <button
            type="button"
            id="ngxReceiptViewerClose"
            aria-label="Close receipt"
          >
            ×
          </button>
        </div>

        <div class="ngx-receipt-image-wrap">
          <img
            id="ngxReceiptViewerImage"
            alt="Payment receipt"
          >
        </div>

        <div class="ngx-receipt-modal-footer">
          <span id="ngxReceiptViewerOrder"></span>

          <button
            type="button"
            id="ngxReceiptViewerBack"
          >
            ← Back to chat
          </button>
        </div>

      </div>
    `;

        document.body.appendChild(viewer);

        const closeViewer = () => {
          viewer.classList.remove("show");
        };

        viewer
          .querySelector("#ngxReceiptViewerClose")
          .addEventListener("click", closeViewer);

        viewer
          .querySelector("#ngxReceiptViewerBack")
          .addEventListener("click", closeViewer);

        viewer.addEventListener("click", (event) => {
          if (event.target === viewer) {
            closeViewer();
          }
        });
      }

      viewer.querySelector("#ngxReceiptViewerImage").src =
        order.payment.receiptUrl;

      viewer.querySelector("#ngxReceiptViewerId").textContent =
        order.payment.receiptId || "";

      viewer.querySelector("#ngxReceiptViewerOrder").textContent =
        `Order #${order.id}`;

      viewer.classList.add("show");
    }
    /* =====================================================
     RECEIPT UPLOAD
  ===================================================== */

    uploadReceiptBtn?.addEventListener("click", () => {
      const order = currentOrder();

      if (!order) return;

      // BEFORE PAYMENT RECEIPT IS UPLOADED
      if (order.payment.status === "waiting") {
        pauseAutoRotation();

        // reset so selecting the same image again still triggers change
        receiptInput.value = "";

        receiptInput.click();

        return;
      }

      // AFTER RECEIPT IS UPLOADED
      if (order.payment.status === "receipt_uploaded") {
        if (order.payment.receiptUrl) {
          openReceiptViewer(order);
        }

        return;
      }

      // PAYMENT ALREADY CONFIRMED
      if (order.payment.status === "confirmed") {
        toast("Payment already confirmed.");

        return;
      }

      // ORDER CANCELLED
      if (order.payment.status === "cancelled") {
        toast("This order has been cancelled.");
      }
    });

    receiptInput.addEventListener("change", () => {
      const file = receiptInput.files?.[0];

      if (!file) return;

      const order = currentOrder();

      if (order.payment.receiptUrl) {
        URL.revokeObjectURL(order.payment.receiptUrl);
      }

      order.payment.receiptUrl = URL.createObjectURL(file);

      order.payment.receiptName = file.name;

      order.payment.receiptId = createReceiptId();

      order.payment.uploadedAt = new Date().toISOString();

      order.payment.status = "receipt_uploaded";

      pauseAutoRotation();

      renderTransactionCenter();

      toast(`Receipt uploaded for Order #${order.id}`);

      /*
      BACKEND HOOK

      Later upload the actual receipt:

      const form = new FormData();

      form.append("receipt", file);
      form.append("orderId", order.id);

      fetch(
        `${API_BASE}/api/orders/${order.id}/receipt`,
        {
          method: "POST",
          body: form,
          credentials: "include"
        }
      );
    */
    });

    /* =====================================================
     CANCEL ORDER
  ===================================================== */

    cancelPaymentBtn?.addEventListener("click", () => {
      const order = currentOrder();

      if (order.payment.status !== "waiting") {
        return;
      }

      const confirmed = window.confirm(`Cancel Order #${order.id}?`);

      if (!confirmed) return;

      order.payment.status = "cancelled";
      order.orderStatus = "cancelled";

      pauseAutoRotation();

      renderTransactionCenter();

      toast(`Order #${order.id} cancelled`);

      /*
        BACKEND HOOK

        await apiPost(
          `${API_BASE}/api/orders/${order.id}/cancel`,
          {}
        );
      */
    });

    /* =====================================================
     AUTO HERO SWITCH

     Continues automatically.

     Pauses while:
     - mouse is inside Transaction Center
     - buyer recently clicked something
  ===================================================== */

    center.addEventListener("mouseenter", () => {
      hoveringCenter = true;
    });

    center.addEventListener("mouseleave", () => {
      hoveringCenter = false;
    });

    setInterval(() => {
      if (hoveringCenter) return;

      if (Date.now() < userPauseUntil) {
        return;
      }

      showTransactionSlide(activeSlide === "orders" ? "payment" : "orders");
    }, AUTO_SLIDE_TIME);

    /* =====================================================
     SOCKET HOOK

     Seller can later confirm payment using Socket.IO.

     Expected event:

     {
       orderId: "NGX001",
       status: "confirmed"
     }
  ===================================================== */

    state.socket?.on("payment-status", (payload) => {
      const order = transactionOrders.find(
        (item) => item.id === payload.orderId,
      );

      if (!order) return;

      order.payment.status = payload.status;

      if (payload.status === "confirmed") {
        order.orderStatus = "preparing";
      }

      renderTransactionCenter();
    });
    transactionCenterAPI = {
      setOrders(orders = []) {
        transactionOrders = Array.isArray(orders) ? orders : [];

        activeOrderIndex = 0;
        activePaymentMethod = 0;

        renderTransactionCenter();
      },

      getOrders() {
        return transactionOrders;
      },

      refresh() {
        renderTransactionCenter();
      },
    };
    /* =====================================================
     INITIAL STATE
  ===================================================== */

    showTransactionSlide("orders");

    renderTransactionCenter();
  }

  // -----------------------------
  // Boot
  // -----------------------------
  async function boot() {
    const currentUser = await loadCurrentBuyer();

    if (!currentUser) {
      return;
    }
    applyTheme(state.theme);
    runSplash();
    initHero();
    initCountdown();
    wireEvents();
    initImageSearch();
    initQR();
    initLocation();
    initNav();
    initSocket();
    initTransactionCenter();
    initChatComposer();
    initCategoryCarousel();
    initMessageSidebarResizer();
    initMessagesSidebarNav();
    initMessageFilterOverflow();
    // initial data
    await Promise.all([loadFavorites(), updateCartCount()]);

    await loadConversations();

    consumeChatHandoff();
    await loadProducts(1);
    initInfiniteScroll();
  }
  if (window.lucide) {
    lucide.createIcons();
  }
  // Kickoff
  document.addEventListener("DOMContentLoaded", boot);
})();

// ======== Orders Mini Tabs ========
document.querySelectorAll("#meOrders .pill").forEach((btn, i, all) => {
  btn.addEventListener("click", () => {
    all.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const list = document.getElementById("meOrders");
    let msg = "";
    if (i === 0) msg = "No orders to be filled.";
    if (i === 1) msg = "No filled orders yet.";
    if (i === 2) msg = "No order history.";
    list.querySelector(".mt16.muted").textContent = msg;
  });
});
// 1) nav active icon swap (if not already)
els.navBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    els.navBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const view = btn.dataset.view;
    Object.entries(els.views).forEach(([k, el]) =>
      el.classList.toggle("active", k === view),
    );
  });
});

// 2) ensure API works (serve over http, not file://)
const isFile = location.protocol === "file:";
if (isFile) {
  console.warn("Open via http:// (not file://) so fetch works.");
  // Optional: fallback to mock or show toast
}
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.onclick = () => {
    const target = btn.dataset.view;

    document.body.setAttribute("data-view", target);

    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.remove("active"));
    document.querySelector(`#view-${target}`).classList.add("active");

    document
      .querySelectorAll(".nav-btn")
      .forEach((n) => n.classList.remove("active"));
    btn.classList.add("active");
  };
});

const qrButton = document.getElementById("qrBtn");

if (qrButton) {
  qrButton.addEventListener("click", () => {
    alert("QR scanning coming soon.");
  });
}

const uploadInput = document.getElementById("profileUpload");
const previewImg = document.getElementById("profilePreview");
document.getElementById("photoAddBtn").onclick = () => uploadInput.click();
uploadInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  localStorage.setItem("profilePic", url);
};

/* =========================================================
   NGOXI CATEGORY CAROUSEL
   ========================================================= */

const categoryStrip = document.querySelector(".category-strip");
const categoryScroll = categoryStrip?.querySelector(".category-scroll");
const categoryArrows = categoryStrip?.querySelectorAll(".category-arrow");

if (categoryScroll && categoryArrows?.length >= 2) {
  const leftArrow = categoryArrows[0];
  const rightArrow = categoryArrows[1];

  leftArrow.addEventListener("click", (event) => {
    event.preventDefault();

    categoryScroll.scrollBy({
      left: -500,
      behavior: "smooth",
    });
  });

  rightArrow.addEventListener("click", (event) => {
    event.preventDefault();

    categoryScroll.scrollBy({
      left: 500,
      behavior: "smooth",
    });
  });

  categoryScroll.querySelectorAll(".category").forEach((button) => {
    button.addEventListener("click", () => {
      categoryScroll.querySelectorAll(".category").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");

      button.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });
  });
} else {
  console.warn("Category carousel elements were not found.");
}

loadFavorites();
