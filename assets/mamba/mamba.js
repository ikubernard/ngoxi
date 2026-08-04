/* =========================================================
   NGOXI MAMBA JS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  /* ===============================
       INTRO ANIMATION
    =============================== */

  const intro = document.getElementById("mambaIntro");

  if (intro) {
    setTimeout(() => {
      intro.remove();
    }, 1800);
  }

  /* ===============================
       CATEGORY SWITCH
    =============================== */

  const categories = document.querySelectorAll(".mamba-category .category");

  categories.forEach((category) => {
    category.addEventListener("click", () => {
      categories.forEach((item) => {
        item.classList.remove("active");
      });

      category.classList.add("active");

      const selected = category.textContent.trim();

      console.log("Mamba category:", selected);
    });
  });

  /* ===============================
       TEMP MAMBA PRODUCTS
       (later replaced by backend)
    =============================== */

  const mambaProducts = [
    {
      name: "Premium Leather Bag",

      description: "Elegant handmade leather collection",

      price: "180,000",

      image: "../assets/mamba/demo/bag.png",
    },

    {
      name: "Luxury Watch",

      description: "Premium stainless steel design",

      price: "350,000",

      image: "../assets/mamba/demo/watch.png",
    },

    {
      name: "Original Sneakers",

      description: "Comfortable premium footwear",

      price: "220,000",

      image: "../assets/mamba/demo/shoes.png",
    },

    {
      name: "Wireless Headphones",

      description: "High quality sound experience",

      price: "150,000",

      image: "../assets/mamba/demo/headphones.png",
    },

    {
      name: "Smart Device",

      description: "Modern technology collection",

      price: "500,000",

      image: "../assets/mamba/demo/device.png",
    },
  ];
});
/* =========================================================
   NGOXI MAMBA JS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  // Intro animation
  const intro = document.getElementById("mambaIntro");

  if (intro) {
    setTimeout(() => {
      intro.remove();
    }, 1800);
  }

  // Category switching
  const categories = document.querySelectorAll(".mamba-category .category");

  categories.forEach((category) => {
    category.addEventListener("click", () => {
      categories.forEach((item) => {
        item.classList.remove("active");
      });

      category.classList.add("active");

      console.log("Mamba category:", category.dataset.filter);
    });
  });

  // Temporary products
  const mambaProducts = [
    {
      name: "Premium Leather Bag",
      description: "Elegant handmade leather collection",
      price: "180,000",
      image: "../assets/mamba/demo/bag.jpg",
    },

    {
      name: "Luxury Watch",
      description: "Premium stainless steel design",
      price: "350,000",
      image: "../assets/mamba/demo/watch.jpg",
    },

    {
      name: "Original Sneakers",
      description: "Comfortable premium footwear",
      price: "220,000",
      image: "../assets/mamba/demo/shoes.jpg",
    },

    {
      name: "Wireless Headphones",
      description: "High quality sound experience",
      price: "150,000",
      image: "../assets/mamba/demo/headphones.jpg",
    },

    {
      name: "Smart Device",
      description: "Modern technology collection",
      price: "500,000",
      image: "../assets/mamba/demo/device.jpg",
    },
  ];

  // Create card
  function createMambaCard(product) {
    return `

        <article class="mamba-card">

            <div class="product-image">

                <img 
                src="${product.image}"
                alt="${product.name}"
                >

            </div>


            <div class="card-info">

                <h3>
                ${product.name}
                </h3>


                <p>
                ${product.description}
                </p>


                <div class="price-area">

                    <strong>
                    TSh ${product.price}
                    </strong>

                </div>

            </div>

        </article>

        `;
  }

  // Render cards
  const productGrid = document.getElementById("mambaProductGrid");

  if (productGrid) {
    productGrid.innerHTML = mambaProducts
      .map((product) => createMambaCard(product))
      .join("");
  }
});
