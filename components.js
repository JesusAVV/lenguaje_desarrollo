/* ================================================
   components.js - Reusable components for Fast Shopping
   ================================================ */

/**
 * Renders the shared navigation bar into the element with the given ID.
 * @param {string} containerId - The ID of the element to render the navbar into.
 */
function renderNavbar(containerId) {
  var navLinks = [
    { href: "index.html", text: "Inicio" },
    { href: "nosotros.html", text: "Niñas/Niños" },
    { href: "servicios.html", text: "Bicicletas" },
    { href: "contacto.html", text: "Abuelitos/as" }
  ];

  var container = document.getElementById(containerId);
  if (!container) return;

  var nav = document.createElement("div");
  nav.className = "navbar";

  for (var i = 0; i < navLinks.length; i++) {
    var a = document.createElement("a");
    a.href = navLinks[i].href;
    a.textContent = navLinks[i].text;
    nav.appendChild(a);
  }

  container.appendChild(nav);
}

/**
 * Renders product cards into the element with the given ID.
 * Each product object should have: { image, alt, name, price, description (optional) }
 * @param {string} containerId - The ID of the element to render the products into.
 * @param {Array} products - Array of product objects.
 */
function renderProductCards(containerId, products) {
  var container = document.getElementById(containerId);
  if (!container) return;

  for (var i = 0; i < products.length; i++) {
    var product = products[i];
    var card = document.createElement("div");
    card.className = "producto";

    var html = "";
    html += '<img src="' + product.image + '" alt="' + (product.alt || product.name) + '">';
    html += "<h3>" + product.name + "</h3>";
    html += "<p>" + product.price + "</p>";
    if (product.description) {
      html += "<p>" + product.description + "</p>";
    }
    html += "<button>Agregar al carrito</button>";

    card.innerHTML = html;
    container.appendChild(card);
  }
}
