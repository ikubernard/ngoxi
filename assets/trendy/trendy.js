document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("trendyGrid");

  function renderProducts() {
    grid.innerHTML = products
      .map(
        (product) => `


<div class="product-card"
onclick="openProduct('${product.id}')">


<img src="${product.image}">


<div class="product-info">


<h3>
${product.name}
</h3>


<p>
${product.description}
</p>


<div class="product-price">

TSh ${product.price}

</div>


</div>


</div>


`,
      )
      .join("");
  }

  window.openProduct = function (id) {
    window.location.href = `/product.html?id=${id}`;
  };

  renderProducts();
});
document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("trendyGrid");

  async function loadTrendyProducts() {
    try {
      const res = await fetch("/api/products?mode=trendy");

      const data = await res.json();

      const products = data.products || [];

      renderProducts(products);
    } catch (error) {
      console.error("Trendy products error:", error);
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
    onclick="openProduct('${product._id}')">


        <img src="${product.cover?.url || ""}">


        <div class="product-info">

            <h3>
            ${product.name}
            </h3>


            <p>
            ${product.description}
            </p>


            <strong>
            TSh ${product.price}
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

  loadTrendyProducts();
});
