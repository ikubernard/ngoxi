document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("groupGrid");

  const search = document.getElementById("groupSearch");

  const categoryBtns = document.querySelectorAll(".group-categories button");

  /* ---------------- HERO ---------------- */

  const heroTrack = document.getElementById("heroTrack");

  const heroSlides = document.querySelectorAll(".hero-slide");

  const heroDots = document.querySelectorAll(".hero-dot");

  const heroPrev = document.getElementById("heroPrev");

  const heroNext = document.getElementById("heroNext");

  let currentSlide = 0;

  function showSlide(index) {
    if (index < 0) index = heroSlides.length - 1;

    if (index >= heroSlides.length) index = 0;

    currentSlide = index;

    heroTrack.style.transform = `translateX(-${index * 100}%)`;

    heroDots.forEach((dot) => dot.classList.remove("active"));

    heroDots[index].classList.add("active");
  }

  heroNext.onclick = () => showSlide(currentSlide + 1);

  heroPrev.onclick = () => showSlide(currentSlide - 1);

  heroDots.forEach((dot) => {
    dot.onclick = () => {
      showSlide(Number(dot.dataset.slide));
    };
  });

  setInterval(() => {
    showSlide(currentSlide + 1);
  }, 5000);

  /* ---------------- PRODUCTS ---------------- */

  let PRODUCTS = [];

  let ACTIVE_CATEGORY = "all";

  let SEARCH = "";

  async function loadProducts() {
    try {
      const res = await fetch("/api/products?mode=group");

      const data = await res.json();

      PRODUCTS = data.products || [];

      render();
    } catch (err) {
      console.error(err);

      grid.innerHTML = `
        <div class="group-empty">
        No Group Deals Yet
        </div>
        `;
    }
  }

  function render() {
    const filtered = PRODUCTS.filter((product) => {
      const category = (product.category || "").toLowerCase();

      const searchText = `
            ${product.name || ""}
            ${product.description || ""}
            ${product.category || ""}
        `.toLowerCase();

      const categoryMatch =
        ACTIVE_CATEGORY === "all" || category === ACTIVE_CATEGORY;

      const searchMatch = searchText.includes(SEARCH);

      return categoryMatch && searchMatch;
    });

    grid.innerHTML = "";

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="group-empty">
        No matching products.
        </div>
        `;

      return;
    }

    filtered.forEach((product) => {
      const card = document.createElement("article");

      card.className = "group-card";

      const image = product.cover?.url || product.images?.[0]?.url || "";

      card.innerHTML = `

        <div class="group-image">

            ${image ? `<img src="${image}" alt="">` : ""}

            <span class="group-badge">

                👥 GROUP

            </span>

        </div>

        <div class="group-info">

            <div class="group-name">

                ${product.name || "Product"}

            </div>

            <div class="group-price">

                TSh ${Number(product.price || 0).toLocaleString()}

            </div>

            <div class="group-note">

                Nunua pamoja, save zaidi.

            </div>

        </div>

        `;

      card.onclick = () => {
        location.href = `/product.html?id=${product._id}`;
      };

      grid.appendChild(card);
    });
  }

  /* ---------------- SEARCH ---------------- */

  search.addEventListener("input", () => {
    SEARCH = search.value.trim().toLowerCase();

    render();
  });

  /* ---------------- CATEGORY ---------------- */

  categoryBtns.forEach((btn) => {
    btn.onclick = () => {
      categoryBtns.forEach((b) => b.classList.remove("active"));

      btn.classList.add("active");

      ACTIVE_CATEGORY = btn.dataset.category;

      render();
    };
  });

  loadProducts();
});
document.getElementById("backBtn")?.addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
  } else {
    location.href = "/views/home.html";
  }
});
