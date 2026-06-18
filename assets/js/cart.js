/* ============================================================
   Robot Fragrances — cart + drawer
   localStorage-backed cart shared across pages. Exposes
   window.RFCart and dispatches "rfcart:change" on mutation.
   Injects the header cart button and the slide-out drawer.
   ============================================================ */
(function () {
  "use strict";

  var KEY = "rf_cart";
  var catGet = window.RF_get || function () { return null; };
  var BOTTLE = window.RF_BOTTLE || "";

  function load() {
    try { var a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} }

  var items = load(); // [{ slug, ml, qty }]

  function priceFor(slug, ml) {
    var p = catGet(slug); if (!p) return 0;
    for (var i = 0; i < p.sizes.length; i++) { if (p.sizes[i].ml === ml) return p.sizes[i].price; }
    return 0;
  }
  function find(slug, ml) {
    for (var i = 0; i < items.length; i++) { if (items[i].slug === slug && items[i].ml === ml) return items[i]; }
    return null;
  }
  function count() { return items.reduce(function (n, it) { return n + it.qty; }, 0); }
  function subtotal() { return items.reduce(function (s, it) { return s + priceFor(it.slug, it.ml) * it.qty; }, 0); }

  function changed() {
    persist();
    renderBadge();
    renderDrawer();
    document.dispatchEvent(new CustomEvent("rfcart:change"));
  }

  var API = {
    items: function () { return items.map(function (it) { return { slug: it.slug, ml: it.ml, qty: it.qty }; }); },
    count: count,
    subtotal: subtotal,
    priceFor: priceFor,
    add: function (slug, ml, qty) {
      ml = +ml; qty = qty || 1;
      if (!catGet(slug)) return;
      var it = find(slug, ml);
      if (it) it.qty += qty; else items.push({ slug: slug, ml: ml, qty: qty });
      changed();
    },
    setQty: function (slug, ml, qty) {
      var it = find(slug, +ml); if (!it) return;
      it.qty = Math.max(0, qty | 0);
      if (it.qty === 0) items = items.filter(function (x) { return x !== it; });
      changed();
    },
    remove: function (slug, ml) {
      items = items.filter(function (x) { return !(x.slug === slug && x.ml === +ml); });
      changed();
    },
    clear: function () { items = []; changed(); },
    open: openDrawer,
    close: closeDrawer
  };
  window.RFCart = API;

  /* ---- UI ------------------------------------------------ */
  var BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 8h11l-1 12.5h-9L6.5 8z"/><path d="M9.2 8.5V6.2a2.8 2.8 0 0 1 5.6 0v2.3"/></svg>';
  var cartBtn, badgeEl, drawer, overlay, bodyEl, subtotalEl;

  function buildUI() {
    var actions = document.querySelector(".nav-actions");
    if (actions) {
      cartBtn = document.createElement("button");
      cartBtn.className = "cart-btn";
      cartBtn.type = "button";
      cartBtn.setAttribute("aria-label", "Open cart");
      cartBtn.innerHTML = BAG + '<span class="cart-count" hidden>0</span>';
      actions.insertBefore(cartBtn, actions.firstChild);
      badgeEl = cartBtn.querySelector(".cart-count");
      cartBtn.addEventListener("click", openDrawer);
    }

    overlay = document.createElement("div");
    overlay.className = "cart-overlay";
    overlay.addEventListener("click", closeDrawer);

    drawer = document.createElement("aside");
    drawer.className = "cart-drawer";
    drawer.setAttribute("aria-label", "Shopping cart");
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML =
      '<div class="cart-head"><h2>Your cart</h2><button class="cart-close" type="button" aria-label="Close cart">&times;</button></div>' +
      '<div class="cart-body"></div>' +
      '<div class="cart-foot">' +
        '<div class="cart-subtotal"><span>Subtotal</span><span class="cart-subtotal-val">$0</span></div>' +
        '<p class="cart-note">Shipping &amp; taxes calculated at checkout.</p>' +
        '<a class="btn cart-checkout" href="checkout.html">Checkout</a>' +
        '<button class="btn btn--ghost cart-continue" type="button">Continue shopping</button>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    bodyEl = drawer.querySelector(".cart-body");
    subtotalEl = drawer.querySelector(".cart-subtotal-val");

    drawer.querySelector(".cart-close").addEventListener("click", closeDrawer);
    drawer.querySelector(".cart-continue").addEventListener("click", closeDrawer);

    bodyEl.addEventListener("click", function (e) {
      var row = e.target.closest(".cart-item"); if (!row) return;
      var slug = row.dataset.slug, ml = +row.dataset.ml;
      var it = find(slug, ml);
      if (e.target.closest(".qty-inc")) API.setQty(slug, ml, (it ? it.qty : 0) + 1);
      else if (e.target.closest(".qty-dec")) API.setQty(slug, ml, (it ? it.qty : 0) - 1);
      else if (e.target.closest(".cart-remove")) API.remove(slug, ml);
    });
  }

  function openDrawer() {
    if (!drawer) return;
    renderDrawer();
    document.body.classList.add("cart-open");
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
  }
  function closeDrawer() {
    if (!drawer) return;
    document.body.classList.remove("cart-open");
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
  }

  function lineMedia(p) {
    return p.image ? '<img src="' + p.image + '" alt="' + p.name + '">' : '<span class="cart-svg">' + BOTTLE + "</span>";
  }

  function renderBadge() {
    if (!badgeEl) return;
    var c = count();
    badgeEl.textContent = c;
    badgeEl.hidden = c === 0;
    if (cartBtn && c > 0) { cartBtn.classList.remove("bump"); void cartBtn.offsetWidth; cartBtn.classList.add("bump"); }
  }

  function renderDrawer() {
    if (!bodyEl) return;
    if (!items.length) {
      drawer.classList.add("is-empty");
      bodyEl.innerHTML = '<div class="cart-empty"><p>Your cart is empty.</p><a class="link-arrow" href="shop.html">Browse the shelf →</a></div>';
    } else {
      drawer.classList.remove("is-empty");
      bodyEl.innerHTML = items.map(function (it) {
        var p = catGet(it.slug); if (!p) return "";
        var price = priceFor(it.slug, it.ml);
        return '<div class="cart-item" data-slug="' + it.slug + '" data-ml="' + it.ml + '">' +
          '<a class="cart-item-media' + (p.image ? " has-photo" : "") + '" href="product.html?id=' + p.slug + '">' + lineMedia(p) + "</a>" +
          '<div class="cart-item-info">' +
            '<a class="cart-item-name" href="product.html?id=' + p.slug + '">' + p.name + "</a>" +
            '<div class="cart-item-size">' + it.ml + " ml decant · $" + price + "</div>" +
            '<div class="cart-item-controls">' +
              '<div class="qty"><button type="button" class="qty-dec" aria-label="Decrease quantity">&minus;</button><span class="qty-val">' + it.qty + '</span><button type="button" class="qty-inc" aria-label="Increase quantity">+</button></div>' +
              '<button type="button" class="cart-remove">Remove</button>' +
            "</div>" +
          "</div>" +
          '<div class="cart-item-price">$' + (price * it.qty) + "</div>" +
        "</div>";
      }).join("");
    }
    if (subtotalEl) subtotalEl.textContent = "$" + subtotal();
  }

  /* Quick-add from shop cards (button.product-add) */
  document.addEventListener("click", function (e) {
    var add = e.target.closest("button.product-add");
    if (!add || add.disabled) return;
    var card = add.closest(".product-card"); if (!card) return;
    var slug = card.id;
    var sizeEl = card.querySelector(".size-opt.is-active") || card.querySelector(".size-opt");
    if (!slug || !sizeEl) return;
    API.add(slug, +sizeEl.dataset.ml, 1);
    openDrawer();
  });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });

  function init() { buildUI(); renderBadge(); renderDrawer(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
