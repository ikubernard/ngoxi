/* =========================================================
   NGOXI MAMBA
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  /* =====================================================
     INTRO
  ===================================================== */

  const intro = document.getElementById("mambaIntro");

  if (intro) {
    setTimeout(() => {
      intro.remove();
    }, 1800);
  }

  /* =====================================================
     BACK BUTTON
  ===================================================== */

  const backBtn = document.getElementById("backBtn");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (history.length > 1) {
        history.back();
      } else {
        location.href = "/views/home.html";
      }
    });
  }

  /* =====================================================
     ELEMENTS
  ===================================================== */

  const grid = document.getElementById("mambaProductGrid");

  const searchInput = document.querySelector(".mamba-search input");

  const categories = document.querySelectorAll(".mamba-category .category");

  /* =====================================================
     DATA
  ===================================================== */

  let allProducts = [];

  let activeFilter = "recommended";

  let searchTerm = "";

  /* =====================================================
     LOAD REAL MAMBA PRODUCTS
  ===================================================== */

  async function loadMambaProducts() {
    if (!grid) return;

    grid.innerHTML = `
      <div class="mamba-loading">
        Curating Mamba collection...
      </div>
    `;

    try {
      const response = await fetch("/api/products?mode=mamba");

      if (!response.ok) {
        throw new Error(`Mamba request failed: ${response.status}`);
      }

      const data = await response.json();

      allProducts = Array.isArray(data) ? data : data.products || [];

      refreshProducts();
    } catch (error) {
      console.error("Mamba products failed:", error);

      grid.innerHTML = `
        <div class="mamba-empty">
          Mamba collection unavailable right now.
        </div>
      `;
    }
  }

  /* =====================================================
     FILTER PRODUCTS
  ===================================================== */

  function getVisibleProducts() {
    let products = [...allProducts];

    /* SEARCH */

    if (searchTerm) {
      products = products.filter((product) => {
        const searchText = `
            ${product.name || ""}
            ${product.description || ""}
            ${product.category || ""}
            ${product.brand || ""}
          `.toLowerCase();

        return searchText.includes(searchTerm);
      });
    }

    /* FILTER */

    switch (activeFilter) {
      case "new":
        products.sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
        );

        break;

      case "top":
        products.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));

        break;

      case "best-selling":
        products.sort(
          (a, b) =>
            Number(b.sales || b.sold || 0) - Number(a.sales || a.sold || 0),
        );

        break;

      case "limited":
        products = products.filter(
          (product) =>
            product.limited === true ||
            product.isLimited === true ||
            product.stock <= 10,
        );

        break;

      case "stores":
        /*
          Until the backend has a proper
          Top Stores endpoint, leave the
          Mamba product collection intact.
        */

        break;

      case "recommended":
      default:
        break;
    }

    return products;
  }

  /* =====================================================
     ESCAPE HTML
  ===================================================== */

  function escapeHTML(value) {
    return String(value || "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character],
    );
  }

  /* =====================================================
     GET PRODUCT IMAGE
  ===================================================== */

  function getProductImage(product) {
    return (
      product.cover?.url ||
      product.cover ||
      product.image?.url ||
      product.image ||
      product.images?.[0]?.url ||
      product.images?.[0] ||
      product.gallery?.[0]?.url ||
      ""
    );
  }

  /* =====================================================
     GET PRODUCT LABEL
  ===================================================== */

  function getMambaLabel(product) {
    if (product.limited === true || product.isLimited === true) {
      return "LIMITED";
    }

    const createdAt = new Date(product.createdAt || 0);

    const age = Date.now() - createdAt.getTime();

    const fiveDays = 5 * 24 * 60 * 60 * 1000;

    if (createdAt.getTime() && age <= fiveDays) {
      return "NEW";
    }

    if (Number(product.rating || 0) >= 4.7) {
      return "ELITE";
    }

    return "CERTIFIED";
  }

  /* =====================================================
     CREATE CARD
  ===================================================== */

  function createMambaCard(product, index) {
    const image = getProductImage(product);

    const label = getMambaLabel(product);

    const name = escapeHTML(product.name || "Mamba Product");

    const description = escapeHTML(
      product.description || "Selected for the Mamba collection.",
    );

    const brand = escapeHTML(
      product.brand || product.seller?.storeName || "MAMBA SELECT",
    );

    const price = Number(product.price || 0).toLocaleString();

    const id = product._id || product.id || "";

    return `

      <article
        class="mamba-card"
        data-id="${id}"
        style="animation-delay:${index * 55}ms"
      >

        <div class="product-image">

          <span class="mamba-certified">
            ${label}
          </span>

          <button
            class="product-favorite"
            type="button"
            aria-label="Save product"
          >
            ♡
          </button>

          ${
            image
              ? `
                <img
                  src="${image}"
                  alt="${name}"
                  loading="lazy"
                >
              `
              : `
                <div class="mamba-no-image">
                  M
                </div>
              `
          }

        </div>


        <div class="card-info">

          <div class="mamba-brand-line">
            ${brand}
          </div>

          <h3>
            ${name}
          </h3>

          <p>
            ${description}
          </p>


          <div class="mamba-authentic">

            <span class="auth-check">
              ✓
            </span>

            <span>
              Authenticity guaranteed
            </span>

          </div>


          <div class="mamba-price-row">

            <strong>
              TSh ${price}
            </strong>

            <span class="product-arrow">
              →
            </span>

          </div>

        </div>

      </article>

    `;
  }

  /* =====================================================
     RENDER
  ===================================================== */

  function refreshProducts() {
    if (!grid) return;

    const products = getVisibleProducts();

    if (!products.length) {
      grid.innerHTML = `
        <div class="mamba-empty">

          <div class="empty-mark">
            M
          </div>

          <strong>
            Nothing here yet.
          </strong>

          <span>
            Mamba products matching this selection will appear here.
          </span>

        </div>
      `;

      return;
    }

    grid.innerHTML = products
      .map((product, index) => createMambaCard(product, index))
      .join("");

    bindCardEvents();
  }

  /* =====================================================
     CARD EVENTS
  ===================================================== */

  function bindCardEvents() {
    document.querySelectorAll(".mamba-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;

        if (!id) return;

        window.location.href = `/product.html?id=${encodeURIComponent(id)}`;
      });

      const favorite = card.querySelector(".product-favorite");

      if (favorite) {
        favorite.addEventListener("click", (event) => {
          event.stopPropagation();

          favorite.classList.toggle("active");

          favorite.textContent = favorite.classList.contains("active")
            ? "♥"
            : "♡";
        });
      }
    });
  }

  /* =====================================================
     SEARCH
  ===================================================== */

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value.trim().toLowerCase();

      refreshProducts();
    });
  }

  /* =====================================================
     CATEGORY SWITCH
  ===================================================== */

  categories.forEach((category) => {
    category.addEventListener("click", () => {
      categories.forEach((item) => item.classList.remove("active"));

      category.classList.add("active");

      activeFilter = category.dataset.filter || "recommended";

      refreshProducts();
    });
  });

  /* =====================================================
     BRAND FILTER
  ===================================================== */

  document.querySelectorAll(".brand-item").forEach((brandItem) => {
    brandItem.addEventListener("click", () => {
      const brand = brandItem
        .querySelector("span")
        ?.textContent?.trim()
        ?.toLowerCase();

      if (!brand) return;

      searchTerm = brand;

      if (searchInput) {
        searchInput.value =
          brandItem.querySelector("span")?.textContent?.trim() || "";
      }

      refreshProducts();
    });
  });

  /* =====================================================
     START
  ===================================================== */

  loadMambaProducts();
});
