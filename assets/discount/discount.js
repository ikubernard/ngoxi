document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("discountGrid");

  const search = document.getElementById("discountSearch");

  const buttons = document.querySelectorAll(".categories button");

  let products = [];

  async function loadDiscounts() {
    const res = await fetch("/api/products");

    const data = await res.json();

    products = (data.products || []).filter(
      (p) => Number(p.discountPercent) > 0,
    );

    render(products);
  }

  function render(list) {
    grid.innerHTML = "";

    list.forEach((product) => {
      grid.appendChild(createCard(product));
    });
  }

  function createCard(product) {
    const card = document.createElement("div");

    card.className = "discount-card";

    const oldPrice = product.originalPrice || product.price;

    const save = oldPrice - product.price;

    card.innerHTML = `


<div class="discount-image">


<img src="
${product.cover?.url || product.images?.[0]?.url || ""}
">


<div class="discount-badge">

-${product.discountPercent}%

</div>


</div>




<div class="discount-info">


<div class="product-name">

${product.name}

</div>



<div class="old-price">

TSh ${Number(oldPrice).toLocaleString()}

</div>



<div class="new-price">

TSh ${Number(product.price).toLocaleString()}

</div>



<div class="save">

Save TSh ${Number(save).toLocaleString()}

</div>



</div>


`;

    card.onclick = () => {
      location.href = `/product.html?id=${product._id}`;
    };

    return card;
  }

  search.addEventListener("input", () => {
    const text = search.value.toLowerCase();

    render(products.filter((p) => p.name.toLowerCase().includes(text)));
  });

  buttons.forEach((btn) => {
    btn.onclick = () => {
      buttons.forEach((b) => b.classList.remove("active"));

      btn.classList.add("active");

      const category = btn.dataset.category;

      if (category === "all") {
        render(products);

        return;
      }

      render(products.filter((p) => p.category?.toLowerCase() === category));
    };
  });

  loadDiscounts();
});
