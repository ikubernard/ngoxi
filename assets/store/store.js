// ==============================
//   STORE PAGE FUNCTIONAL JS
// ==============================
(function () {
  const API = "http://localhost:5000"; // adjust if needed

  // ---- Helpers ----
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const qs = new URLSearchParams(window.location.search);
  const sellerId = qs.get("seller");

  if (!sellerId) {
    console.error("Missing seller id");
    return;
  }

  // DOM Refs
  const heroBg = $("#heroBg");
  const logoEl = $("#storeLogo");
  const nameEl = $("#storeName");
  const followersEl = $("#storeFollowers");
  const chatBtn = $("#storeChat");
  const followBtn = $("#storeFollow");
  const miniHeader = $("#storeMiniHeader");
  const miniLogo = $("#miniLogo");
  const miniName = $("#miniName");
  const miniChat = $("#miniChat");
  const productsGrid = $("#storeGrid");

  // Tabs
  const tabBtns = $$(".store-tabs .tab");
  const tabIndicator = $(".store-tabs .tab-indicator");
  const panes = {
    assure: $("#tab-assure"),
    products: $("#tab-products"),
    reviews: $("#tab-reviews"),
    classify: $("#tab-classify"),
  };

  // State
  let storeData = null;
  let page = 1;
  let loading = false;
  let reachedEnd = false;

  // --------------------------
  // Fetch Store Info
  // --------------------------
  async function loadStore() {
    try {
      const res = await fetch(`${API}/api/seller/${sellerId}`);
      if (!res.ok) throw new Error("Store fetch failed");
      storeData = await res.json();

      applyStoreInfo();
    } catch (err) {
      console.error(err);
    }
  }

  function applyStoreInfo() {
    // Cover
    const cover =
      storeData?.storeCover?.url ||
      "linear-gradient(135deg, #f7e39c, #eaffcf)";
    if (cover.startsWith("http")) {
      heroBg.style.backgroundImage = `url('${cover}')`;
    } else {
      heroBg.style.background = cover;
    }

    // Logo
    const logo =
      storeData?.storeLogo?.url ||
      "https://via.placeholder.com/150?text=Store";
    logoEl.src = logo;
    miniLogo.src = logo;

    // Store name
    const nm = storeData?.storeName?.trim() || "Store";
    nameEl.textContent = nm;
    miniName.textContent = nm;

    // Followers (0 for now)
    followersEl.textContent = `0 followers`;
  }

  // --------------------------
  // Chat
  // --------------------------
  function openChat() {
    window.location.href = `/views/home.html?chat=${sellerId}`;
  }
  chatBtn.onclick = openChat;
  miniChat.onclick = openChat;

  // --------------------------
  // Tabs
  // --------------------------
  function switchTab(tab) {
    tabBtns.forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === tab)
    );

    Object.keys(panes).forEach((k) => {
      panes[k].classList.toggle("active", k === tab);
    });

    const activeBtn = tabBtns.find((b) => b.classList.contains("active"));
    const rect = activeBtn.getBoundingClientRect();
    const parentRect = activeBtn.parentNode.getBoundingClientRect();
    const x = rect.left - parentRect.left;

    tabIndicator.style.transform = `translateX(${x}px)`;
    tabIndicator.style.width = rect.width + "px";

    // If switching to products tab, ensure loading starts
    if (tab === "products" && productsGrid.children.length === 0) {
      loadMoreProducts();
    }
  }

  tabBtns.forEach((b) =>
    b.addEventListener("click", () => switchTab(b.dataset.tab))
  );

  // --------------------------
  // Infinite Scroll Products
  // --------------------------
  function minPriceOf(p) {
    const base = Number(p.price || 0);
    if (!Array.isArray(p.variants) || !p.variants.length) return base;
    const extracted = p.variants.map((v) => {
      if (typeof v === "string") {
        const parts = v.split("|");
        return Number(parts[1]) || base;
      }
      return Number(v.price) || base;
    });
    return Math.min(...extracted);
  }
function renderCard(p) {
  const minP = minPriceOf(p);
  const img =
    p.cover?.url ||
    p.images?.[0]?.url ||
    "https://via.placeholder.com/600?text=No+Image";

  const el = document.createElement("article");
  el.className = "store-card";
  el.innerHTML = `
    <div class="store-anim"></div>
    <img class="store-img" src="${img}" alt="${p.name}">
    <div class="store-bar">
      <div class="store-title" title="${p.name}">${p.name}</div>
      <div>
        <span class="store-price">TSh ${Number(minP).toLocaleString()}</span>
        <span class="store-min">min</span>
      </div>
    </div>
    <div class="store-badges">
      <span class="store-badge">Quality Deal</span>
      <span class="store-badge">Best Price</span>
    </div>
  `;
  el.addEventListener("click", () => {
    window.location.href = `/views/product.html?id=${p._id}`;
  });
  return el;
}

  async function loadMoreProducts() {
    if (loading || reachedEnd) return;
    loading = true;

    try {
      const res = await fetch(
        `${API}/api/products?sellerId=${sellerId}&page=${page}&limit=12`
      );
      const data = await res.json();

      if (!data.products || data.products.length === 0) {
        reachedEnd = true;
        return;
      }

      data.products.forEach((p) =>
        productsGrid.appendChild(renderCard(p))
      );

      page++;
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  }

  window.addEventListener("scroll", () => {
    if (loading || reachedEnd) return;
    if (
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - 300
    ) {
      loadMoreProducts();
    }
  });

  // --------------------------
  // Sticky Mini Header
  // --------------------------
  window.addEventListener("scroll", () => {
    const triggerPoint = 220;
    miniHeader.classList.toggle("hidden", window.scrollY < triggerPoint);
  });

  // --------------------------
  // INIT
  // --------------------------
  async function init() {
    await loadStore();
    switchTab("assure"); // default
  }
  init();
})();
