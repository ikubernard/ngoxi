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
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2';

  // State
  const state = {
    page: 1,
    pages: 1,
    loading: false,
    products: [],          // cache of products from list
    productById: new Map(),// quick index by _id
    favorites: new Set(),  // product IDs (we normalize whatever backend returns)
    theme: localStorage.getItem('ngoxi_theme') || 'light',
    search: {
      term: '',
      history: JSON.parse(localStorage.getItem('ngoxi_search_history') || '[]'),
      suggestOpen: false,
    },
    cartCount: 0,
    gridObserver: null,
    splashDone: false,
    miniMap: null,
    settingsMap: null,
    settingsMarker: null,
    socket: null,
  };

  // Elements
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const els = {
    splash: $('#splash'),
    themeToggle: $('#themeToggle'),
    themeLabel: $('#themeLabel'),
    slides: $('#slides'),
    heroDots: $('#heroDots'),
    searchInput: $('#searchInput'),
    searchGo: $('#searchGo'),
    imgSearchBtn: $('#imgSearchBtn'),
    imgFile: $('#imgFile'),
    qrBtn: $('#qrBtn'),
    locBtn: $('#locBtn'),
    map: $('#map'),
    countdown: $('#countdown'),
    grid: $('#grid'),
    productSheet: $('#productSheet'),
    psClose: $('#psClose'),
    psTitle: $('#psTitle'),
    psSeller: $('#psSeller'),
    psRating: $('#psRating'),
    psPrice: $('#psPrice'),
    psDelivery: $('#psDelivery'),
    psGallery: $('#psGallery'),
    psVariants: $('#psVariants'),
    psDesc: $('#psDesc'),
    psFav: $('#psFav'),
    psAddCart: $('#psAddCart'),
    bottomNav: $('.bottom-nav'),
    navBtns: $$('.bottom-nav .nav-btn'),
    views: {
      home: $('#view-home'),
      messages: $('#view-messages'),
      packages: $('#view-packages'),
      me: $('#view-me'),
    },
    // Messages
    chatStatus: $('#chatStatus'),
    chatList: $('#chatList'),
    chatBody: $('#chatBody'),
    chatInput: $('#chatInput'),
    chatSend: $('#chatSend'),
    chatAttach: $('#chatAttach'),
    chatFile: $('#chatFile'),
    // Packages pills & containers
    pkgPills: $$('.pills .pill[data-pkg]'),
    pkgProgress: $('#pkgProgress'),
    pkgReady: $('#pkgReady'),
    // Me pills & containers
    mePills: $$('.pills .pill[data-me]'),
    meProfile: $('#meProfile'),
    meSettings: $('#meSettings'),
    meCart: $('#meCart'),
    meOrders: $('#meOrders'),
    meMore: $('#meMore'),
    // Settings inputs + map
    setName: $('#setName'),
    setPhone: $('#setPhone'),
    setEmail: $('#setEmail'),
    setLocation: $('#setLocation'),
    saveSettings: $('#saveSettings'),
    logoutBtn: $('#logoutBtn'),
    buyerMap: $('#buyerMap'),
    // Cart
    cartBtn: $('#cartBtn'),
    cartCount: $('#cartCount'),
    cartList: $('#cartList'),
    cartEmpty: $('#cartEmpty'),
    checkoutBtn: $('#checkoutBtn'),
  };

  // Utils
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const currency = (n) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n);
    } catch {
      return `TSh ${Number(n).toLocaleString()}`;
    }
  };
  const toast = (msg) => {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', bottom: '18px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,.78)', color: '#fff', padding: '10px 14px', borderRadius: '10px',
      zIndex: '99999', fontSize: '13px', boxShadow: '0 6px 26px rgba(0,0,0,.35)'
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  };

  const safeGet = (o, path, d = undefined) => {
    try {
      return path.split('.').reduce((a, k) => (a && a[k] !== undefined) ? a[k] : d, o);
    } catch { return d; }
  };

  // -----------------------------
  // Theme
  // -----------------------------
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    localStorage.setItem('ngoxi_theme', theme);
    if (els.themeLabel) els.themeLabel.textContent = theme === 'light' ? '🌙' : '☀️';
  }

  function toggleTheme() {
    applyTheme(state.theme === 'light' ? 'dark' : 'light');
  }

  // -----------------------------
  // Splash
  // -----------------------------
  async function runSplash() {
    if (!els.splash) return;
    await wait(3200 + Math.random() * 1200); // 3–4.4s
    els.splash.style.opacity = '0';
    await wait(450);
    els.splash.remove();
    state.splashDone = true;
  }

  // -----------------------------
  // Hero slider
  // -----------------------------
  function initHero() {
    if (!els.slides || !els.heroDots) return;
    const slides = $$('.slide', els.slides);
    els.heroDots.innerHTML = slides.map(() => `<div class="dot"></div>`).join('');
    const dots = $$('.dot', els.heroDots);
    let idx = 0;

    const go = (i) => {
      idx = i % slides.length;
      els.slides.style.transform = `translateX(-${idx * 100}vw)`;
      dots.forEach((d, k) => d.classList.toggle('on', k === idx));
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
      const hh = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const mm = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const ss = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      els.countdown.textContent = `${hh}:${mm}:${ss}`;
    }
    update();
    setInterval(update, 1000);
  }

  // -----------------------------
  // API
  // -----------------------------
  async function apiGet(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }
  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  // -----------------------------
  // Products / Grid
  // -----------------------------
  function productCover(p) {
    // prefer cover.url, then first images[].url
    return safeGet(p, 'cover.url') || safeGet(p, 'images.0.url') || '';
  }

  function renderCard(p) {
    const img = productCover(p);
    const price = currency(p.price);
    const desc = (p.description || '').slice(0, 70);
    const title = p.name || p.title || 'Product';

    const card = document.createElement('div');
    card.className = 'p-card';
    card.dataset.id = p._id;

    card.innerHTML = `
      <div class="p-img">${img ? `<img src="${img}" alt="${title}"/>` : ''}</div>
      <div class="p-info">
        <div class="p-name">${escapeHTML(title)}</div>
        <div class="p-price">${price}</div>
        ${desc ? `<div class="muted" style="margin-top:4px;font-size:12px">${escapeHTML(desc)}</div>` : ''}
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

    favs.forEach(item => {
      const div = document.createElement("div");
      div.className = "p-card";
      div.innerHTML = `
        <div class="p-img"><img src="${item.images[0]}" /></div>
        <div class="p-info">
            <div class="p-name">${item.name}</div>
            <div class="p-price">${item.price} TSh</div>
        </div>
    `;
      div.onclick = () => window.location.href = `/product.html?id=${item._id}`;
      grid.appendChild(div);
    });
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  async function loadProducts(page = 1, opts = {}) {
    if (state.loading || (page > state.pages)) return;
    state.loading = true;

    try {
      // If real search is active, prefer server search
      if (opts.searchTerm && opts.remote) {
        const data = await apiPost(`${API_BASE}/api/search`, { q: opts.searchTerm });
        // Normalize into {products, page, pages}
        const products = (data.products || data || []);
        if (page === 1) {
          state.products = [];
          els.grid.innerHTML = '';
        }
        for (const p of products) {
          indexProduct(p);
          els.grid.appendChild(renderCard(p));
        }
        state.page = 1; state.pages = 1; // single-shot search results
        return;
      }

      const data = await apiGet(`${API_BASE}/api/products?page=${page}`);
      const products = data.products || [];
      state.page = data.page || page;
      state.pages = data.pages || state.pages;

      if (page === 1 && !opts.append) {
        state.products = [];
        els.grid.innerHTML = '';
      }

      for (const p of products) {
        indexProduct(p);
        els.grid.appendChild(renderCard(p));
      }
    } catch (err) {
      console.error('loadProducts', err);
      toast('Failed to load products');
    } finally {
      state.loading = false;
    }
  }

  function indexProduct(p) {
    state.productById.set(p._id, p);
    if (!state.products.find(x => x._id === p._id)) state.products.push(p);
  }

  function initInfiniteScroll() {
    const sentinel = document.createElement('div');
    sentinel.style.height = '1px';
    els.grid.appendChild(sentinel);

    state.gridObserver = new IntersectionObserver(async (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !state.loading) {
          if (state.page < state.pages && !state.search.term) {
            await loadProducts(state.page + 1, { append: true });
          }
        }
      }
    }, { rootMargin: '1200px 0px 0px 0px' });

    state.gridObserver.observe(sentinel);
  }

  // -----------------------------
  // Product Sheet
  // -----------------------------

  function openProductSheet() { return; }
  function closeProductSheet() {
    if (els.productSheet) {
      els.productSheet.classList.remove('open');
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
        if (data.length && typeof data[0] === 'string') {
          // IDs
          data.forEach(id => state.favorites.add(id));
        } else if (data.length && typeof data[0] === 'object') {
          data.forEach(p => { state.favorites.add(p._id); indexProduct(p); });
        }
      } else if (Array.isArray(data?.ids)) {
        data.ids.forEach(id => state.favorites.add(id));
      }
    } catch (e) {
      console.warn('favorites load failed', e);
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
      const cart = JSON.parse(localStorage.getItem('ngoxi_cart') || '[]');
      count = cart.reduce((a, b) => a + (b.qty || 1), 0);
    }
    state.cartCount = count;
    if (els.cartCount) els.cartCount.textContent = String(count);
  }

  // -----------------------------
  // Search (text + server + suggestions + history)
  // -----------------------------
  function persistHistory() {
    localStorage.setItem('ngoxi_search_history', JSON.stringify(state.search.history.slice(0, 15)));
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
        const filtered = state.products.filter(p => {
          const hay = `${p.name || ''} ${(p.category || '')} ${(p.description || '')}`.toLowerCase();
          return hay.includes(q.toLowerCase());
        });
        els.grid.innerHTML = '';
        filtered.forEach(p => els.grid.appendChild(renderCard(p)));
      }
    }, 250);
  }

  // -----------------------------
  // Image Search (Cloudinary upload -> /api/image-search)
  // -----------------------------
  function initImageSearch() {
    if (!els.imgSearchBtn || !els.imgFile) return;
    els.imgSearchBtn.addEventListener('click', () => els.imgFile.click());
    els.imgFile.addEventListener('change', async () => {
      const file = els.imgFile.files?.[0];
      if (!file) return;
      try {
        toast('Uploading image…');
        // 1) Upload to your backend -> Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        const up = await fetch(`${API_BASE}/api/upload/image`, {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        if (!up.ok) throw new Error('Upload failed');
        const upJson = await up.json();
        const url = upJson.url || upJson.secure_url;
        if (!url) throw new Error('No URL returned');

        // 2) Call image-search
        const result = await apiPost(`${API_BASE}/api/image-search`, { url });
        const products = result.products || result || [];
        if (!Array.isArray(products) || !products.length) {
          toast('No visual matches found');
          return;
        }
        // render
        els.grid.innerHTML = '';
        products.forEach(p => { indexProduct(p); els.grid.appendChild(renderCard(p)); });
        state.page = 1; state.pages = 1; // single-shot
        pushHistory('[image]');
      } catch (e) {
        console.error(e);
        toast('Image search failed');
      } finally {
        els.imgFile.value = '';
      }
    });
  }

  // -----------------------------
  // QR Scan -> seller store
  // Progressive: BarcodeDetector -> file upload fallback -> prompt
  // -----------------------------
  function initQR() {
    if (!els.qrBtn) return;
    els.qrBtn.addEventListener('click', async () => {
      // Try modern API
      if ('BarcodeDetector' in window) {
        try {
          const det = new BarcodeDetector({ formats: ['qr_code'] });
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          const video = document.createElement('video');
          video.srcObject = stream;
          video.setAttribute('playsinline', true);
          await video.play();

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

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
          const cleanup = () => { stream.getTracks().forEach(t => t.stop()); };
          scanLoop();
          toast('Scanning… show seller QR to camera');
          return;
        } catch (e) {
          console.warn('BarcodeDetector fallback', e);
        }
      }

      // Fallback: ask user to paste code
      const code = prompt('Paste seller QR code text (dev mode):');
      if (code) handleQR(code);
    });
  }

  async function handleQR(code) {
    try {
      const res = await apiPost(`${API_BASE}/api/qr-scan`, { code });
      const sellerId = res.sellerId || res?.seller?._id;
      if (!sellerId) {
        toast('QR not recognized');
        return;
      }
      location.href = `/seller/${sellerId}`;
    } catch (e) {
      console.error(e);
      toast('QR scan failed');
    }
  }

  // -----------------------------
  // Location / Mini Map & Settings Map (+ reverse geocode)
  // -----------------------------
  function initLocation() {
    if (els.locBtn) {
      els.locBtn.addEventListener('click', async () => {
        if (els.map.style.display === 'none') {
          els.map.style.display = 'block';
          initMiniMap();
        } else {
          els.map.style.display = 'none';
        }
      });
    }

    // Settings map shown when user clicks Settings pill
  }

  function initMiniMap() {
    if (state.miniMap) { state.miniMap.invalidateSize(); return; }
    state.miniMap = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(state.miniMap);

    navigator.geolocation.getCurrentPosition((pos) => {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      state.miniMap.setView(latlng, 14);
      L.marker(latlng).addTo(state.miniMap);
    }, () => {
      state.miniMap.setView([0, 0], 2);
    }, { enableHighAccuracy: true });
  }

  function ensureSettingsMap() {
    if (!els.buyerMap) return;
    if (state.settingsMap) { state.settingsMap.invalidateSize(); return; }

    state.settingsMap = L.map('buyerMap');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(state.settingsMap);

    navigator.geolocation.getCurrentPosition((pos) => {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      state.settingsMap.setView(latlng, 14);
      state.settingsMarker = L.marker(latlng, { draggable: true }).addTo(state.settingsMap);
      state.settingsMarker.on('dragend', () => onMarkerMove(state.settingsMarker.getLatLng()));
      onMarkerMove({ lat: latlng[0], lng: latlng[1] });
    }, () => {
      const latlng = [0, 0];
      state.settingsMap.setView(latlng, 2);
      state.settingsMarker = L.marker(latlng, { draggable: true }).addTo(state.settingsMap);
      state.settingsMarker.on('dragend', () => onMarkerMove(state.settingsMarker.getLatLng()));
    }, { enableHighAccuracy: true });

    state.settingsMap.on('click', (e) => {
      const latlng = e.latlng;
      state.settingsMarker.setLatLng(latlng);
      onMarkerMove(latlng);
    });
  }

  async function onMarkerMove(latlng) {
    if (!USE_NOMINATIM) return;
    try {
      const url = `${NOMINATIM_URL}&lat=${latlng.lat}&lon=${latlng.lng}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const json = await res.json();
      els.setLocation.value = json.display_name || `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    } catch {
      els.setLocation.value = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    }
  }

  // -----------------------------
  // Bottom Nav / Views / Pills
  // -----------------------------
  function initNav() {
    els.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        els.navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.view;
        Object.entries(els.views).forEach(([k, el]) => el.classList.toggle('active', k === view));
        if (view === 'me') {
          // default to Profile shown via pills; ensure map only when Settings tab opened
        }
      });
    });
    // --- Location and Cart Redirects ---
    if (els.locBtn) {
      els.locBtn.addEventListener("click", () => {
        // Switch to Me → Settings
        els.navBtns.forEach(b => b.classList.remove('active'));
        const meBtn = els.navBtns.find(b => b.dataset.view === 'me');
        if (meBtn) meBtn.classList.add('active');
        Object.entries(els.views).forEach(([k, el]) => el.classList.toggle('active', k === 'me'));
        showMeSection('settings');
        ensureSettingsMap();
      });
    }

    if (els.cartBtn) {
      els.cartBtn.addEventListener("click", () => {
        // Switch to Packages → My Cart
        els.navBtns.forEach(b => b.classList.remove('active'));
        const pkgBtn = els.navBtns.find(b => b.dataset.view === 'packages');
        if (pkgBtn) pkgBtn.classList.add('active');
        Object.entries(els.views).forEach(([k, el]) => el.classList.toggle('active', k === 'packages'));
        toast('Opening your cart…');
      });
    }

    // Packages pills
    els.pkgPills.forEach(p => p.addEventListener('click', () => {
      els.pkgPills.forEach(b => b.classList.remove('active'));
      p.classList.add('active');
      const key = p.dataset.pkg;
      els.pkgProgress.style.display = key === 'progress' ? '' : 'none';
      els.pkgReady.style.display = key === 'ready' ? '' : 'none';
      // 'cart' lives in Me -> My Cart per your flow
      if (key === 'cart') gotoCartTab();
    }));

    // Me pills
    els.mePills.forEach(p => p.addEventListener('click', () => {
      els.mePills.forEach(b => b.classList.remove('active'));
      p.classList.add('active');
      const key = p.dataset.me;
      showMeSection(key);
    }));
    // Display messages when empty
    if (!els.pkgProgress.innerHTML.trim()) els.pkgProgress.textContent = 'No products in progress.';
    if (!els.pkgReady.innerHTML.trim()) els.pkgReady.textContent = 'No products ready for pickup.';
  }

  function gotoCartTab() {
    const cartPill = els.mePills.find(p => p.dataset.me === 'cart');
    if (cartPill) {
      els.mePills.forEach(b => b.classList.remove('active'));
      cartPill.classList.add('active');
    }
    showMeSection('cart');
    // render cart
    renderCart();
  }

  function showMeSection(key) {
    els.meProfile.style.display = key === 'profile' ? '' : 'none';
    els.meSettings.style.display = key === 'settings' ? '' : 'none';
    els.meCart.style.display = key === 'cart' ? '' : 'none';
    els.meOrders.style.display = key === 'orders' ? '' : 'none';
    els.meMore.style.display = key === 'more' ? '' : 'none';

    if (key === 'settings') ensureSettingsMap();
  }

  // -----------------------------
  // Cart (basic local fallback)
  // -----------------------------
  function renderCart() {
    // Try server cart later; for now read local fallback (we already update count from server if available)
    const cart = JSON.parse(localStorage.getItem('ngoxi_cart') || '[]');
    els.cartList.innerHTML = '';
    if (!cart.length) {
      els.cartEmpty.style.display = '';
      els.checkoutBtn.style.display = 'none';
      return;
    }
    els.cartEmpty.style.display = 'none';
    els.checkoutBtn.style.display = '';

    for (const item of cart) {
      const p = state.productById.get(item.id);
      const row = document.createElement('div');
      row.className = 'cart-row';
      const img = p ? productCover(p) : '';
      row.innerHTML = `
        <img class="cart-img" src="${img}" alt=""/>
        <div>
          <div style="font-weight:700">${escapeHTML(p?.name || 'Product')}</div>
          <div class="muted" style="font-size:12px">${escapeHTML((p?.description || '').slice(0, 60))}</div>
          <div class="cart-controls">
            <button class="btn sm dec">-</button>
            <span>${item.qty}</span>
            <button class="btn sm inc">+</button>
            <button class="btn sm outline rm">Remove</button>
          </div>
        </div>
        <div class="cart-price">${currency((p?.price || 0) * item.qty)}</div>
      `;
      $('.dec', row).onclick = () => { item.qty = Math.max(1, item.qty - 1); saveCart(cart); renderCart(); updateCartCount(); };
      $('.inc', row).onclick = () => { item.qty += 1; saveCart(cart); renderCart(); updateCartCount(); };
      $('.rm', row).onclick = () => { const idx = cart.findIndex(x => x.id === item.id); cart.splice(idx, 1); saveCart(cart); renderCart(); updateCartCount(); };
      els.cartList.appendChild(row);
    }
  }
  function saveCart(cart) {
    localStorage.setItem('ngoxi_cart', JSON.stringify(cart));
  }

  // -----------------------------
  // Chat (Socket.io)
  // -----------------------------
  function initSocket() {
    if (!window.io) return;
    state.socket = io(API_BASE, { transports: ['websocket'], withCredentials: true, reconnection: true });

    const setStatus = (s) => { if (els.chatStatus) { els.chatStatus.textContent = s; els.chatStatus.className = `status ${s}`; } };

    state.socket.on('connect', () => setStatus('online'));
    state.socket.on('disconnect', () => setStatus('offline'));
    state.socket.on('connect_error', () => setStatus('offline'));

    // Example events; adjust to your server events:
    state.socket.on('message', (msg) => pushChat('them', msg.text || JSON.stringify(msg)));
    state.socket.on('system', (msg) => pushChat('system', msg.text || JSON.stringify(msg)));

    if (els.chatSend) {
      els.chatSend.addEventListener('click', sendChat);
      els.chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    }
    if (els.chatAttach && els.chatFile) {
      els.chatAttach.addEventListener('click', () => els.chatFile.click());
      els.chatFile.addEventListener('change', sendChatImage);
    }
    // Default support chat

    if (els.chatList) {
      const btn = document.createElement("button");
      btn.className = "chat-tab";
      btn.innerHTML = `
      <div class="chat-avatar">💬</div>
      <div>
      <div class="chat-title">NgoXi Support</div>
      <div class="chat-last">Ask anything here</div>
      </div>`;
      btn.onclick = () => {
        $('#chatWith').textContent = 'NgoXi Support';
        els.chatBody.innerHTML = '<div class="chat-row system">Welcome to NgoXi Support 👋</div>';
      };
      els.chatList.appendChild(btn);
    }
    pushChat('system', 'Welcome to NgoXi Support 👋');
    pushChat('them', 'How can we help you today?');

  }

  function pushChat(who, text) {
    if (!els.chatBody) return;
    const row = document.createElement('div');
    row.className = `chat-row ${who}`;
    row.textContent = text;
    els.chatBody.appendChild(row);
    els.chatBody.scrollTop = els.chatBody.scrollHeight;
  }

  function sendChat() {
    const text = els.chatInput.value.trim();
    if (!text) return;
    state.socket?.emit('message', { text });
    pushChat('me', text);
    els.chatInput.value = '';
  }

  async function sendChatImage() {
    const file = els.chatFile.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch(`${API_BASE}/api/upload/image`, {
        method: 'POST', body: fd, credentials: 'include'
      });
      const js = await up.json();
      const url = js.url || js.secure_url;
      if (url) {
        state.socket?.emit('message', { image: url });
        pushChat('me', '[image] ' + url);
      } else {
        toast('Upload failed');
      }
    } catch {
      toast('Upload failed');
    } finally {
      els.chatFile.value = '';
    }
  }
  function loadDeals(products) {
    const deals = products.filter(p => p.deal === true);
    const grid = document.getElementById("dealsGrid");
    grid.innerHTML = "";

    deals.forEach(item => {
      const div = document.createElement("div");
      div.className = "p-card";
      div.innerHTML = `
        <div class="p-img"><img src="${item.images[0]}" /></div>
        <div class="p-info">
            <div class="p-name">${item.name}</div>
            <div class="p-price">${item.price} TSh</div>
        </div>
      `;
      div.onclick = () => window.location.href = `/product.html?id=${item._id}`;
      grid.appendChild(div);
    });
  }

  // -----------------------------
  // Events wiring
  // -----------------------------
  function wireEvents() {
    els.themeToggle?.addEventListener('click', toggleTheme);
    els.searchInput?.addEventListener('input', onSearchInput);
    els.psClose?.addEventListener('click', closeProductSheet);

    // Close sheet on backdrop click
    els.productSheet?.addEventListener('click', (e) => {
      if (e.target === els.productSheet) closeProductSheet();
    });

    // Save settings
    els.saveSettings?.addEventListener('click', () => {
      const payload = {
        name: els.setName?.value || '',
        phone: els.setPhone?.value || '',
        email: els.setEmail?.value || '',
        address: els.setLocation?.value || '',
      };
      // Hook to your backend user settings endpoint if you have one:
      // apiPost(`${API_BASE}/api/user/settings`, payload)
      toast('Saved (local demo). Hook your /api/user/settings to persist.');
    });

    els.logoutBtn?.addEventListener('click', () => {
      // location.href = '/logout' (if existed)
      toast('Logged out (demo). Wire to your real /logout.');
    });
  }

  // -----------------------------
  // Boot
  // -----------------------------
  async function boot() {
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

    // initial data
    await Promise.all([
      loadFavorites(),
      updateCartCount()
    ]);

    await loadProducts(1);
    initInfiniteScroll();
  }

  // Kickoff
  document.addEventListener('DOMContentLoaded', boot);
})();

// ======== Orders Mini Tabs ========
document.querySelectorAll('#meOrders .pill').forEach((btn, i, all) => {
  btn.addEventListener('click', () => {
    all.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const list = document.getElementById('meOrders');
    let msg = '';
    if (i === 0) msg = 'No orders to be filled.';
    if (i === 1) msg = 'No filled orders yet.';
    if (i === 2) msg = 'No order history.';
    list.querySelector('.mt16.muted').textContent = msg;
  });
});
// 1) nav active icon swap (if not already)
els.navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    els.navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    Object.entries(els.views).forEach(([k, el]) => el.classList.toggle('active', k === view));
  });
});

// 2) ensure API works (serve over http, not file://)
const isFile = location.protocol === 'file:';
if (isFile) {
  console.warn('Open via http:// (not file://) so fetch works.');
  // Optional: fallback to mock or show toast
}
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = () => {
    const target = btn.dataset.view;

    document.body.setAttribute("data-view", target);

    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.querySelector(`#view-${target}`).classList.add("active");

    document.querySelectorAll(".nav-btn").forEach(n => n.classList.remove("active"));
    btn.classList.add("active");
  };
});
qrBtn.onclick = () => {
  alert("QR scanning coming soon...");
};

const uploadInput = document.getElementById('profileUpload');
const previewImg = document.getElementById('profilePreview');
document.getElementById('photoAddBtn').onclick = () => uploadInput.click();
uploadInput.onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  localStorage.setItem('profilePic', url);
};

document.getElementById("chatSend").onclick = () => {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  const bubble = document.createElement("div");
  bubble.className = "chat-row me";
  bubble.textContent = msg;
  document.getElementById("chatBody").appendChild(bubble);
  input.value = "";
  document.getElementById("chatBody").scrollTop = document.getElementById("chatBody").scrollHeight;
};


loadFavorites();
