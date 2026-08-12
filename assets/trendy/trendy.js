document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("trendyGrid");
  const searchInput = document.querySelector(".trendy-search input");
  const categoryButtons = document.querySelectorAll(
    ".trendy-categories button",
  );

  let currentCategory = "";
  let allProducts = [];

  async function loadProducts() {
    try {
      const res = await fetch("/api/products?mode=trendy");

      const data = await res.json();

      allProducts = data.products || [];

      renderProducts(allProducts);
    } catch (err) {
      console.error("Loading trendy products failed", err);
    }
  }
  function renderProducts(products) {
    if (!products.length) {
      grid.innerHTML = `
<p class="empty-products">
No trendy products yet
</p>
`;

      return;
    }

    grid.innerHTML = products
      .map(
        (product) => `

<div class="product-card" data-id="${product._id}">


<div class="product-card"
style="animation-delay:80ms">

<img 
src="${product.cover?.url || ""}"
alt="${product.name}"
>

</div>


<div class="product-info">

<h3>
${product.name}
</h3>


<p>
${product.description ? product.description.slice(0, 55) : "Trending product"}
</p>


<div class="price">
TSh ${product.price.toLocaleString()}
</div>


</div>


</div>

`,
      )
      .join("");

    // product click

    document.querySelectorAll(".product-card").forEach((card) => {
      card.onclick = () => {
        window.location.href = `/product.html?id=${card.dataset.id}`;
      };
    });
  }

  // SEARCH
  searchInput.addEventListener("input", () => {
    const value = searchInput.value.toLowerCase();

    const filtered = allProducts.filter((product) =>
      product.name.toLowerCase().includes(value),
    );

    renderProducts(filtered);
  });

  // CATEGORY BUTTONS

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      categoryButtons.forEach((btn) => {
        btn.classList.remove("active");
      });

      button.classList.add("active");

      const category = button.textContent.trim().toLowerCase();

      if (category === "recommended") {
        renderProducts(allProducts);

        return;
      }

      if (category === "new arrivals") {
        const newest = [...allProducts].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );

        renderProducts(newest);

        return;
      }

      const filtered = allProducts.filter(
        (product) => product.category?.toLowerCase() === category,
      );

      renderProducts(filtered);
    });
  });

  loadProducts();
});
