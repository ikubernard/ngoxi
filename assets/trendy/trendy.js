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

<div class="product-card"
data-id="${product._id}">


<div class="product-image">


<img src="${product.cover?.url || ""}"
alt="${product.name}">


</div>


<div class="product-info">


<h3>${product.name}</h3>


<p>
${
  product.description
    ? product.description.slice(0, 55)
    : "Discover this trending product"
}
</p>


<div class="price">

TSh ${product.price.toLocaleString()}

</div>


</div>


</div>


<div class="image-box">

<img src="${product.cover?.url || ""}">

</div>


<div class="product-info">

<h3>${product.name}</h3>

<p>${product.description.slice(0, 45)}...</p>


<strong>
TSh ${product.price.toLocaleString()}
</strong>


</div>


</div>

`,
      )
      .join("");
  }

  window.openProduct = function (id) {
    window.location.href = `/views/product.html?id=${id}`;
  };

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
