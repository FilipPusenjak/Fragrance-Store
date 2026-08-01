/* ============================================================
   Robot Fragrances — order confirmation
   ------------------------------------------------------------
   Stripe sends the shopper back here with ?session_id=cs_...
   We ask the worker whether that session actually completed
   before claiming anything, then clear the cart.

   Never trust the redirect alone: landing on this URL doesn't
   mean money moved. The worker's answer does.
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("confirm-root");
  if (!root) return;

  var CFG = window.RF_CONFIG || {};
  var API = (CFG.checkoutApi || "").replace(/\/$/, "");
  var sessionId = new URLSearchParams(location.search).get("session_id") || "";

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function money(cents, currency) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: (currency || "usd").toUpperCase()
      }).format((cents || 0) / 100);
    } catch (e) {
      return "$" + ((cents || 0) / 100).toFixed(2);
    }
  }

  function card(inner) {
    root.innerHTML =
      '<div class="container section confirm"><div class="confirm-card">' + inner + "</div></div>";
  }

  function showPending() {
    card(
      '<span class="eyebrow">One moment</span>' +
      "<h1>Confirming your order…</h1>" +
      '<p class="lead" style="margin:1rem auto 0">Checking with our payment provider.</p>'
    );
  }

  function showSuccess(data) {
    var ref = sessionId ? sessionId.slice(-8).toUpperCase() : "";
    card(
      '<div class="confirm-check" aria-hidden="true">&check;</div>' +
      '<span class="eyebrow">Order confirmed</span>' +
      "<h1>Thank you.</h1>" +
      '<p class="lead" style="margin:1rem auto 1rem">Your decants are on the bench. ' +
        "We hand-pour and dispatch within 48 hours.</p>" +
      (data.email
        ? '<p class="confirm-email">A receipt is on its way to <strong>' +
            escapeHtml(data.email) + "</strong>.</p>"
        : "") +
      (data.amountTotal
        ? '<p class="form-note">Total paid: <strong>' +
            money(data.amountTotal, data.currency) + "</strong></p>"
        : "") +
      (ref ? '<p class="form-note">Order reference: <strong>RF-' + escapeHtml(ref) + "</strong></p>" : "") +
      '<a class="btn" href="shop.html" style="margin-top:1.25rem">Continue shopping</a>'
    );
    if (window.RFCart) window.RFCart.clear();
  }

  function showUnpaid() {
    card(
      '<span class="eyebrow">Not completed</span>' +
      "<h1>Your payment didn’t go through</h1>" +
      '<p class="lead" style="margin:1rem auto 2rem">Nothing has been charged and your ' +
        "cart is still where you left it.</p>" +
      '<a class="btn" href="checkout.html">Back to checkout</a>'
    );
  }

  function showUnknown() {
    card(
      '<span class="eyebrow">Thanks</span>' +
      "<h1>We couldn’t confirm this order</h1>" +
      '<p class="lead" style="margin:1rem auto 2rem">If you completed payment, you’ll still ' +
        "get a receipt by email — nothing is lost. Any questions, email " +
        '<a href="mailto:hello@robotfragrances.com">hello@robotfragrances.com</a>.</p>' +
      '<a class="btn" href="shop.html">Continue shopping</a>'
    );
  }

  if (!sessionId || !API) { showUnknown(); return; }

  showPending();

  fetch(API + "/api/session?id=" + encodeURIComponent(sessionId))
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("lookup failed")); })
    .then(function (data) {
      if (data.status === "complete" || data.paymentStatus === "paid") showSuccess(data);
      else if (data.status === "open") showUnpaid();
      else showUnknown();
    })
    .catch(showUnknown);
})();
