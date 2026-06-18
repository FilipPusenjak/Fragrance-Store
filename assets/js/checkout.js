/* ============================================================
   Robot Fragrances — checkout
   Renders an order summary from the cart, handles the (demo)
   form, and shows a confirmation. No real payment is processed.
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("checkout-root");
  if (!root) return;

  var BOTTLE = window.RF_BOTTLE || "";
  var get = window.RF_get || function () { return null; };
  function cart() { return window.RFCart; }

  function priceFor(p, ml) {
    for (var i = 0; i < p.sizes.length; i++) { if (p.sizes[i].ml === ml) return p.sizes[i].price; }
    return 0;
  }
  function shippingFor(sub) { return sub === 0 || sub >= 50 ? 0 : 5; }

  function showEmpty() {
    root.innerHTML =
      '<div class="container section" style="text-align:center">' +
        '<span class="eyebrow">Checkout</span>' +
        '<h1 style="margin:0.6rem 0 0">Your cart is empty</h1>' +
        '<p class="lead" style="margin:1rem auto 2rem">Add a decant or two and they’ll show up here.</p>' +
        '<a class="btn" href="shop.html">Browse the shelf</a>' +
      "</div>";
  }

  function showConfirm() {
    var order = "RF-" + Math.floor(100000 + Math.random() * 900000);
    root.innerHTML =
      '<div class="container section confirm">' +
        '<div class="confirm-card">' +
          '<div class="confirm-check" aria-hidden="true">&check;</div>' +
          '<span class="eyebrow">Order confirmed</span>' +
          "<h1>Thank you.</h1>" +
          '<p class="lead" style="margin:1rem auto 1.5rem">This is a demo store, so no payment was taken and nothing will ship — but your order <strong>' + order + "</strong> is on the books.</p>" +
          '<a class="btn" href="shop.html">Continue shopping</a>' +
        "</div>" +
      "</div>";
    if (cart()) cart().clear();
  }

  /* Fill the order summary in place (form stays put). */
  function fillSummary() {
    var summary = document.getElementById("checkout-summary");
    if (!summary) return;
    var its = cart() ? cart().items() : [];
    if (!its.length) { showEmpty(); return; }

    var sub = 0;
    var rows = its.map(function (it) {
      var p = get(it.slug); if (!p) return "";
      var price = priceFor(p, it.ml); sub += price * it.qty;
      var media = p.image ? '<img src="' + p.image + '" alt="' + p.name + '">' : '<span class="cart-svg">' + BOTTLE + "</span>";
      return '<div class="sum-item">' +
        '<div class="sum-media' + (p.image ? " has-photo" : "") + '">' + media + '<span class="sum-qty">' + it.qty + "</span></div>" +
        '<div class="sum-info"><div class="sum-name">' + p.name + '</div><div class="sum-size">' + it.ml + " ml decant</div></div>" +
        '<div class="sum-price">$' + (price * it.qty) + "</div>" +
      "</div>";
    }).join("");
    var ship = shippingFor(sub);
    summary.querySelector(".sum-items").innerHTML = rows;
    summary.querySelector(".sum-sub").textContent = "$" + sub;
    summary.querySelector(".sum-ship").textContent = ship === 0 ? "Free" : "$" + ship;
    summary.querySelector(".sum-total").textContent = "$" + (sub + ship);
  }

  var initItems = cart() ? cart().items() : [];
  if (!initItems.length) {
    showEmpty();
  } else {
    fillSummary();
    var form = document.getElementById("checkout-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        showConfirm();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  /* Keep the summary in sync if the cart is edited via the drawer. */
  document.addEventListener("rfcart:change", function () {
    if (document.getElementById("checkout-summary")) fillSummary();
  });
})();
