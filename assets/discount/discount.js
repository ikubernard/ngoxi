document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("discountGrid");

  const searchInput = document.getElementById("discountSearch");

  const categoryButtons = document.querySelectorAll(".discount-category");

  const timer = document.getElementById("discountTimer");

  /* =========================
     PRODUCTS
  ========================= */

  let allProducts = [];
  let activeCategory = "all";
  let searchTerm = "";

  async function loadDiscountProducts() {
    try {
      const res = await fetch("/api/products");

      if (!res.ok) {
        throw new Error(`Product request failed: ${res.status}`);
      }

      const data = await res.json();

      allProducts = (data.products || []).filter((product) => {
        const discount = Number(product.discountPercent || 0);

        const original = Number(product.originalPrice || 0);

        const current = Number(product.price || 0);

        return discount > 0 && original > current;
      });

      refreshProducts();
    } catch (error) {
      console.error("Discount products failed:", error);

      grid.innerHTML = `
        <div class="discount-empty">
          Failed to load discounted products.
        </div>
      `;
    }
  }

  function getFilteredProducts() {
    return allProducts.filter((product) => {
      const category = String(product.category || "").toLowerCase();

      const searchableText = `
        ${product.name || ""}
        ${product.description || ""}
        ${product.category || ""}
      `.toLowerCase();

      const categoryMatches =
        activeCategory === "all" || category === activeCategory;

      const searchMatches = !searchTerm || searchableText.includes(searchTerm);

      return categoryMatches && searchMatches;
    });
  }

  function refreshProducts() {
    renderProducts(getFilteredProducts());
  }

  function renderProducts(products) {
    grid.innerHTML = "";

    if (!products.length) {
      grid.innerHTML = `
        <div class="discount-empty">
          No discounted products found.
        </div>
      `;

      return;
    }

    products.forEach((product) => {
      grid.appendChild(createDiscountCard(product));
    });
  }

  function createDiscountCard(product) {
    const card = document.createElement("article");

    card.className = "discount-card";

    card.dataset.id = product._id;

    const image = product.cover?.url || product.images?.[0]?.url || "";

    const originalPrice = Number(product.originalPrice || product.price || 0);

    const currentPrice = Number(product.price || 0);

    const discountPercent = Number(product.discountPercent || 0);

    const saveAmount = Math.max(0, originalPrice - currentPrice);

    card.innerHTML = `

      <div class="discount-image">

        ${
          image
            ? `
              <img
                src="${image}"
                alt="${escapeHTML(product.name || "Product")}"
                loading="lazy"
              >
            `
            : ""
        }

        <div class="discount-badge">
          ${discountPercent}% OFF
        </div>

      </div>


      <div class="discount-info">

        <div class="product-name">
          ${escapeHTML(product.name || "Product")}
        </div>


        <div class="old-price">
          TSh ${originalPrice.toLocaleString()}
        </div>


        <div class="new-price">
          TSh ${currentPrice.toLocaleString()}
        </div>


        <div class="save">
          Save TSh ${saveAmount.toLocaleString()}
        </div>

      </div>

    `;

    card.addEventListener("click", () => {
      window.location.href = `/product.html?id=${product._id}`;
    });

    return card;
  }

  /* =========================
     SEARCH
  ========================= */

  searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value.trim().toLowerCase();

    refreshProducts();
  });

  /* =========================
     CATEGORIES
  ========================= */

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      categoryButtons.forEach((btn) => btn.classList.remove("active"));

      button.classList.add("active");

      activeCategory = button.dataset.category || "all";

      refreshProducts();
    });
  });

  /* =========================
     HERO
  ========================= */

  const track = document.getElementById("discountSlides");

  const dots = Array.from(document.querySelectorAll(".hero-dot"));

  const prevButton = document.getElementById("heroPrev");

  const nextButton = document.getElementById("heroNext");

  let currentSlide = 0;

  let autoSlideTimer = null;

  function showSlide(index) {
    const total = dots.length;

    if (index < 0) {
      index = total - 1;
    }

    if (index >= total) {
      index = 0;
    }

    currentSlide = index;

    track.style.transform = `translateX(-${currentSlide * 100}%)`;

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === currentSlide);
    });
  }

  function nextSlide() {
    showSlide(currentSlide + 1);
  }

  function previousSlide() {
    showSlide(currentSlide - 1);
  }

  function startAutoSlide() {
    stopAutoSlide();

    autoSlideTimer = setInterval(nextSlide, 5000);
  }

  function stopAutoSlide() {
    if (autoSlideTimer) {
      clearInterval(autoSlideTimer);

      autoSlideTimer = null;
    }
  }

  nextButton.addEventListener("click", () => {
    nextSlide();
    startAutoSlide();
  });

  prevButton.addEventListener("click", () => {
    previousSlide();
    startAutoSlide();
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      showSlide(Number(dot.dataset.slide));

      startAutoSlide();
    });
  });

  startAutoSlide();

  /* =========================
     COUNTDOWN
  ========================= */

  function updateCountdown() {
    const now = new Date();

    const end = new Date(now);

    end.setHours(23, 59, 59, 999);

    const difference = Math.max(0, end - now);

    const hours = String(Math.floor(difference / 3600000)).padStart(2, "0");

    const minutes = String(Math.floor((difference % 3600000) / 60000)).padStart(
      2,
      "0",
    );

    const seconds = String(Math.floor((difference % 60000) / 1000)).padStart(
      2,
      "0",
    );

    timer.textContent = `${hours} : ${minutes} : ${seconds}`;
  }

  updateCountdown();

  setInterval(updateCountdown, 1000);

  /* =========================
     UTILITY
  ========================= */

  function escapeHTML(value) {
    return String(value).replace(
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

  loadDiscountProducts();
});
