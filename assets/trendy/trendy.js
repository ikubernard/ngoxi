document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("trendyGrid");

  let products = [
    {
      id: 1,
      name: "Premium Hoodie",
      description: "Street fashion style",
      price: "85000",
      image: "/assets/logo.png",
    },

    {
      id: 2,
      name: "Running Shoes",
      description: "Daily comfort",
      price: "120000",
      image: "/assets/logo.png",
    },

    {
      id: 3,
      name: "Smart Watch",
      description: "Modern technology",
      price: "90000",
      image: "/assets/logo.png",
    },
  ];

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
