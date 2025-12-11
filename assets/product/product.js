(function () {
  const API = "http://localhost:5000";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const param = k => new URLSearchParams(location.search).get(k);

  // State
  const id = param("id");
  let product = null, gallery = [], idx = 0;
  let selectedVariant = null, selectedSize = null;

  // DOM
  const ribbon = $("#nx-ribbon"), rTitle = $("#nxRibbonTitle"), rPrice = $("#nxRibbonPrice");
  const slider = $("#nxSlider"), thumbs = $("#nxThumbs");
  const titleEl = $("#nxTitle"), priceEl = $("#nxPrice"), badgesEl = $("#nxBadges");
  const variantBlock = $("#nxVariantBlock"), variantsEl = $("#nxVariants");
  const sizeBlock = $("#nxSizeBlock"), sizesEl = $("#nxSizes");
  const totalEl = $("#nxTotal"), stickyTotal = $("#nxStickyTotal");
  const desc = $("#nxDesc"), toggleDesc = $("#nxToggleDescGallery"), descGrid = $("#nxDescGallery");
  const storeBox = $("#nxStore"), storeLogo = $("#nxStoreLogo"), storeName = $("#nxStoreName"), storeCap = $("#nxStoreCaption");
  const buyTop = $("#nxBuyTop"), buySticky = $("#nxBuySticky");
  const favBtn = $("#nxFav"), storeBtn = $("#nxStoreBtn"), reviewBtn = $("#nxReviewBtn");

  // Sheet
  const sheet = $("#nxSheet"), sClose = $("#nxSheetClose"), sImg = $("#nxSheetImg"),
    sName = $("#nxSheetName"), sPrice = $("#nxSheetPrice"), sVar = $("#nxSheetVariants"),
    sSizes = $("#nxSheetSizes"), sMinus = $("#nxQminus"), sPlus = $("#nxQplus"),
    sQ = $("#nxQval"), sTotal = $("#nxSheetTotal"), sBuy = $("#nxSheetBuy");
  let qty = 1;

  async function load() {
    if (!id) throw new Error("Missing product id");
    const res = await fetch(`${API}/api/products/${id}`);
    if (!res.ok) throw new Error("Failed to fetch product");
    product = await res.json();
  }

  function buildGallery() {
    const cover = product.cover?.url || null;
    const imgs = Array.isArray(product.images) ? product.images.map(i => i.url).filter(Boolean) : [];
    gallery = cover ? [cover, ...imgs.filter(u => u !== cover)] : imgs.slice();
    if (selectedVariant?.image) gallery = [selectedVariant.image, ...gallery.filter(u => u !== selectedVariant.image)];
    if (!gallery.length) gallery = ["https://via.placeholder.com/800x600?text=No+Image"];
    idx = 0;
  }

  function renderSlider() {
    slider.innerHTML = "";
    gallery.forEach((url, i) => {
      const slide = document.createElement("div");
      slide.className = "nx-slide";
      slide.style.transform = `translateX(${(i - idx) * 100}%)`;
      slide.innerHTML = `<img src="${url}" alt="image ${i + 1}">`;
      slider.appendChild(slide);
    });
    thumbs.innerHTML = "";
    gallery.forEach((url, i) => {
      const t = document.createElement("img");
      t.src = url; if (i === idx) t.classList.add("active");
      t.onclick = () => { idx = i; renderSlider(); };
      thumbs.appendChild(t);
    });

    // touch swipe
    let sx = 0, dx = 0, isDown = false;
    slider.ontouchstart = (e) => { isDown = true; sx = e.touches[0].clientX; };
    slider.ontouchmove = (e) => { if (!isDown) return; dx = e.touches[0].clientX - sx; };
    slider.ontouchend = () => {
      if (!isDown) return; isDown = false;
      if (Math.abs(dx) > 40) { if (dx < 0) next(); else prev(); } dx = 0;
    };
  }
  function next() { idx = (idx + 1) % gallery.length; renderSlider(); }
  function prev() { idx = (idx - 1 + gallery.length) % gallery.length; renderSlider(); }

  function renderHeader() {
    titleEl.textContent = product.name || "Product";
    badgesEl.innerHTML = `
      <span class="nx-badge safe">Quality Assured</span>
      <span class="nx-badge">Pay Later</span>`;
    priceEl.textContent = `TSh ${Number(product.price || 0).toLocaleString()}`;
  }

  function renderVariants() {
    const arr = Array.isArray(product.variants) ? product.variants : [];
    if (!arr.length) { variantBlock.hidden = true; return; }
    variantBlock.hidden = false;
    if (!selectedVariant) selectedVariant = arr[0];
    variantsEl.innerHTML = "";
    arr.forEach(v => {
      const b = document.createElement("button");
      b.className = "nx-variant";
      b.innerHTML = `<img src="${v.image || product.cover?.url || ''}" alt="${v.name || 'variant'}">`;
      if (selectedVariant?.name === v.name) b.classList.add("active");
      b.onclick = () => { selectedVariant = v; buildGallery(); renderSlider(); markVariants(); updateTotals(); };
      variantsEl.appendChild(b);
    });
    function markVariants() {
      $$(".nx-variant", variantsEl).forEach(x => x.classList.remove("active"));
      $$(".nx-variant", variantsEl).find((el, i) => arr[i] === selectedVariant)?.classList.add("active");
    }
  }

  function renderSizes() {
    const arr = Array.isArray(product.sizes) ? product.sizes : [];
    if (!arr.length) { sizeBlock.hidden = true; return; }
    sizeBlock.hidden = false;
    if (!selectedSize) selectedSize = arr[0];
    sizesEl.innerHTML = "";
    arr.forEach(s => {
      const b = document.createElement("button"); b.className = "nx-size"; b.textContent = s;
      if (s === selectedSize) b.classList.add("active");
      b.onclick = () => { selectedSize = s; $$(".nx-size", sizesEl).forEach(x => x.classList.remove("active")); b.classList.add("active"); };
      sizesEl.appendChild(b);
    });
  }

  function updateTotals() {
    const price = selectedVariant?.price ?? product.price ?? 0;
    const v = `TSh ${Number(price).toLocaleString()}`;
    totalEl.textContent = v; stickyTotal.textContent = v;
    rTitle.textContent = product.name || "Product"; rPrice.textContent = v;
  }

  function ribbonObserve() {
    const target = $(".nx-total");
    const io = new IntersectionObserver(([e]) => {
      ribbon.hidden = e.isIntersecting; // hide while total is visible; show after scrolled
    }, { rootMargin: "-80px 0px 0px 0px" });
    io.observe(target);
  }

  function renderDescription() {
    const text = (product.description || "").trim();
    const limit = 240; let expanded = false;
    const draw = () => { desc.textContent = expanded ? text : (text.length > limit ? (text.slice(0, limit) + "…") : text); };
    draw();
    if (text.length > limit) {
      const btn = document.createElement("button"); btn.className = "nx-link"; btn.textContent = "See more";
      btn.onclick = () => { expanded = !expanded; draw(); btn.textContent = expanded ? "See less" : "See more"; };
      desc.after(btn);
    }

    const imgs = Array.isArray(product.descriptionImages) ? product.descriptionImages.filter(Boolean) : [];
    if (!imgs.length) { toggleDesc.hidden = true; descGrid.hidden = true; return; }
    descGrid.innerHTML = imgs.map(u => `<img src="${u}" alt="detail">`).join("");
    toggleDesc.hidden = false;
    toggleDesc.onclick = () => {
      const show = descGrid.hidden;
      descGrid.hidden = !show; toggleDesc.textContent = show ? "Hide images" : "View more images";
    };
  }

  function renderStore() {
    if (!product?.sellerId) return;
    // Basic placeholders; replace with your seller API values if available
    storeBox.hidden = false;
    storeLogo.src = (product.cover?.url || product.images?.[0]?.url) || "https://via.placeholder.com/88";
    storeName.textContent = product.sellerName || "Seller";
    storeCap.textContent = "Tap to visit store";
    const go = () => window.location.href = `/views/store.html?seller=${encodeURIComponent(product.sellerId)}`;
    storeBox.onclick = go; storeBtn.onclick = go;
  }

  function attachStickyActions() {
    favBtn.onclick = () => {
      const key = "favorites"; const list = JSON.parse(localStorage.getItem(key) || "[]");
      if (!list.includes(product._id)) { list.push(product._id); localStorage.setItem(key, JSON.stringify(list)); }
      favBtn.style.borderColor = "#ffadc1"; favBtn.textContent = "❤";
    };
    reviewBtn.onclick = () => window.location.href = `/views/review.html?product=${encodeURIComponent(product._id)}`;
  }

  // BUY SHEET
  function openSheet() {
    qty = 1; sQ.textContent = "1";
    sImg.src = selectedVariant?.image || product.cover?.url || product.images?.[0]?.url || "";
    sName.textContent = product.name || "Product";
    const base = selectedVariant?.price ?? product.price ?? 0;
    sPrice.textContent = `TSh ${Number(base).toLocaleString()}`;
    sTotal.textContent = sPrice.textContent;

    // Variant picks inside sheet (optional mirror)
    sVar.innerHTML = "";
    (product.variants || []).forEach(v => {
      const b = document.createElement("button"); b.className = "nx-size"; b.textContent = v.name || "Variant";
      if (selectedVariant?.name === v.name) b.classList.add("active");
      b.onclick = () => {
        selectedVariant = v; buildGallery(); renderSlider(); updateTotals();
        $$(".nx-size", sVar).forEach(x => x.classList.remove("active")); b.classList.add("active");
        sImg.src = selectedVariant?.image || sImg.src;
        const p = selectedVariant?.price ?? product.price ?? 0;
        sPrice.textContent = `TSh ${Number(p).toLocaleString()}`;
        sTotal.textContent = `TSh ${Number(p * qty).toLocaleString()}`;
      };
      sVar.appendChild(b);
    });

    // Sizes in sheet
    sSizes.innerHTML = "";
    (product.sizes || []).forEach(s => {
      const b = document.createElement("button"); b.className = "nx-size"; b.textContent = s;
      if (s === selectedSize || (!selectedSize && s === product.sizes?.[0])) b.classList.add("active");
      b.onclick = () => { selectedSize = s; $$(".nx-size", sSizes).forEach(x => x.classList.remove("active")); b.classList.add("active"); };
      sSizes.appendChild(b);
    });

    const recalc = () => {
      const p = selectedVariant?.price ?? product.price ?? 0;
      sTotal.textContent = `TSh ${Number(p * qty).toLocaleString()}`;
    };
    sPlus.onclick = () => { qty++; sQ.textContent = qty; recalc(); };
    sMinus.onclick = () => { qty = Math.max(1, qty - 1); sQ.textContent = qty; recalc(); };

    sBuy.onclick = () => { sendToChat(qty); };
    sClose.onclick = () => { sheet.hidden = true; };
    sheet.hidden = false;
  }

  function sendToChat(finalQty) {
    const sellerId = product?.sellerId;
    if (!sellerId) { alert("Seller unavailable"); return; }

    let payment = {}; try { payment = JSON.parse(localStorage.getItem("paymentInfo") || "{}"); } catch { }
    const price = selectedVariant?.price ?? product.price ?? 0;

    const lines = [
      "BUY REQUEST – PAYMENT INFO",
      `Product: ${product?.name || "Product"}`,
      `Variant: ${selectedVariant?.name || "-"}`,
      `Size: ${selectedSize || "-"}`,
      `Qty: ${finalQty}`,
      `Price: TSh ${Number(price).toLocaleString()}`,
      `Total: TSh ${Number(price * finalQty).toLocaleString()}`,
      `Method: ${payment.method || "—"}`,
      `Number: ${payment.phone || "—"}`,
      `Account/Till: ${payment.account || "—"}`,
      payment.note ? `Note: ${payment.note}` : "",
      `Reply with "${payment.confirmPhrase || "PAID"}" after payment.`
    ].filter(Boolean).join("\n");

    sessionStorage.setItem("pendingAutoPayMsg", lines);
    // open SPA messages and chat
    window.location.href = `home.html?chat=${encodeURIComponent(sellerId)}&autopay=1`;
  }

  function attachBuyButtons() {
    const open = () => openSheet();
    buyTop.onclick = open; buySticky.onclick = open;
  }

  // Boot
  async function init() {
    try {
      await load();
      buildGallery(); renderSlider(); renderHeader(); renderStore();
      renderVariants(); renderSizes(); renderDescription(); updateTotals(); ribbonObserve();
      attachStickyActions(); attachBuyButtons();
    } catch (e) { console.error(e); alert("Error loading product."); }
  }
  document.addEventListener("DOMContentLoaded", init);
})();
