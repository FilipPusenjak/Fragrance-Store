/* ============================================================
   Robot Fragrances — checkout
   ------------------------------------------------------------
   Renders the order summary from the cart, then hands payment to
   Stripe through the checkout worker.

   Two modes, chosen in assets/js/config.js:
     hosted    POST /api/checkout -> { url }          -> redirect
     embedded  POST /api/checkout -> { clientSecret }  -> mount here

   The totals drawn on this page are a preview for the shopper.
   The amount actually charged is computed by the worker from its
   own price table, so a tampered cart can't change what's paid.
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("checkout-root");
  if (!root) return;

  var CFG = window.RF_CONFIG || {};
  var API = (CFG.checkoutApi || "").replace(/\/$/, "");
  var MODE = CFG.checkoutMode === "embedded" ? "embedded" : "hosted";
  var PRE = !!(window.RF_preLaunch && window.RF_preLaunch());

  /* The last and firmest of the three pre-launch notices. Whatever
     would otherwise reach Stripe stays inert until this is ticked, so
     nobody gets there on momentum — and it's one click when you want
     to test the checkout yourself. Both payment modes use it, so
     switching to embedded later doesn't quietly drop the guard. */
  function ackHTML() {
    if (!PRE) return "";
    return '<label class="pre-ack">' +
        '<input type="checkbox" id="pre-ack-box" />' +
        "<span><strong>Robot Fragrances hasn’t opened yet.</strong> There is no stock " +
        "on the bench, so nothing ordered here can be packed or shipped. Please don’t " +
        "buy anything — tick this only if you understand that.</span>" +
      "</label>";
  }

  var BOTTLE = window.RF_BOTTLE || "";
  var get = window.RF_get || function () { return null; };
  function cart() { return window.RFCart; }

  function shippingFor(sub) { return sub === 0 || sub >= 50 ? 0 : 7; }
  function money(n) {
    return "$" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---- empty cart ---------------------------------------- */
  function showEmpty() {
    root.innerHTML =
      '<div class="container section" style="text-align:center">' +
        '<span class="eyebrow">Checkout</span>' +
        '<h1 style="margin:0.6rem 0 0">Your cart is empty</h1>' +
        '<p class="lead" style="margin:1rem auto 2rem">Add a decant or two and they’ll show up here.</p>' +
        '<a class="btn" href="shop.html">Browse the shelf</a>' +
      "</div>";
  }

  /* ---- order summary ------------------------------------- *
     Priced by window.RF_priceCart, the same rule the worker applies.
     This page used to compute its own totals, which is how a
     discounted discovery set showed full price here and a lower
     figure on Stripe. */
  function fillSummary() {
    var summary = document.getElementById("checkout-summary");
    if (!summary) return;
    var its = cart() ? cart().items() : [];
    if (!its.length) { showEmpty(); return; }

    var priced = window.RF_priceCart(its);

    var rows = priced.lines.map(function (l) {
      var p = l.product;
      var media = p.image
        ? '<img src="' + p.image + '" alt="' + escapeHtml(p.name) + '">'
        : '<span class="cart-svg">' + BOTTLE + "</span>";
      return '<div class="sum-item">' +
        '<div class="sum-media' + (p.image ? " has-photo" : "") + '">' + media +
          '<span class="sum-qty">' + l.qty + "</span></div>" +
        '<div class="sum-info"><div class="sum-name">' + escapeHtml(p.name) + "</div>" +
          '<div class="sum-size">' + l.ml + " ml decant" +
          (l.discounted ? ' <span class="sum-tag">set</span>' : "") + "</div></div>" +
        '<div class="sum-price">' + money(l.lineTotal) + "</div>" +
      "</div>";
    }).join("");

    var ship = shippingFor(priced.subtotal);
    summary.querySelector(".sum-items").innerHTML = rows;
    summary.querySelector(".sum-sub").textContent = money(priced.gross);
    summary.querySelector(".sum-ship").textContent = ship === 0 ? "Free" : money(ship);
    summary.querySelector(".sum-total").textContent = money(priced.subtotal + ship);

    /* Show the saving as its own line, inserted above shipping. */
    var existing = summary.querySelector(".sum-line--save");
    if (existing) existing.remove();
    if (priced.saving > 0) {
      var shipRow = summary.querySelector(".sum-ship").closest(".sum-line");
      var el = document.createElement("div");
      el.className = "sum-line sum-line--save";
      el.innerHTML = "<span>Discovery set &times;" + priced.sets +
        "</span><span>&minus;" + money(priced.saving) + "</span>";
      shipRow.parentNode.insertBefore(el, shipRow);
    }
  }

  /* ---- pay panel ----------------------------------------- */
  var payPanel = document.getElementById("checkout-pay");

  function setError(msg) {
    var el = document.getElementById("checkout-error");
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ""; return; }
    el.hidden = false;
    el.textContent = msg;
  }

  /* Shown when config.js still has checkoutApi: null. */
  function showUnconfigured() {
    if (!payPanel) return;
    payPanel.innerHTML =
      '<div class="pay-panel">' +
        "<h2>Payment isn’t connected yet</h2>" +
        '<p class="form-note">The checkout worker hasn’t been pointed at this site. ' +
          "Deploy <code>/worker</code>, then set <code>checkoutApi</code> in " +
          "<code>assets/js/config.js</code>.</p>" +
        '<p class="form-note">In the meantime, email ' +
          '<a href="mailto:hello@robotfragrances.com">hello@robotfragrances.com</a> ' +
          "and we’ll take the order by hand.</p>" +
      "</div>";
  }

  function payload() {
    var emailEl = document.getElementById("co-email");
    var body = { items: cart() ? cart().items() : [], mode: MODE };
    if (emailEl && emailEl.value) body.email = emailEl.value.trim();
    return body;
  }

  function createSession() {
    return fetch(API + "/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload())
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || "Checkout is unavailable right now.");
        return data;
      });
    });
  }

  /* ---- hosted: button -> redirect ------------------------ */
  function renderHosted() {
    payPanel.innerHTML =
      '<div class="pay-panel">' +
        "<h2>Secure checkout</h2>" +
        '<p class="form-note">You’ll enter payment and delivery details on Stripe’s ' +
          "secure page, then come straight back here.</p>" +
        /* Say this before the handoff — Stripe will simply not list other
           countries, which reads as a broken form rather than a policy. */
        '<p class="form-note"><strong>We currently ship within the United States only.</strong></p>' +
        '<div class="field full" style="margin-top:1.25rem">' +
          '<label for="co-email">Email <span class="opt">(optional — for your receipt)</span></label>' +
          '<input id="co-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" />' +
        "</div>" +
        '<p id="checkout-error" class="form-note form-note--error" hidden></p>' +
        ackHTML() +
        '<button class="btn" type="button" id="pay-btn"' + (PRE ? " disabled" : "") +
          ">Continue to payment</button>" +
        '<ul class="pd-reassure" style="margin-top:1.5rem">' +
          "<li>Payments handled by Stripe — we never see your card</li>" +
          "<li>Free shipping on orders over $50</li>" +
          "<li>Dispatched within 48 hours, anywhere in the US</li>" +
        "</ul>" +
      "</div>";

    var btn = document.getElementById("pay-btn");
    var ack = document.getElementById("pre-ack-box");
    if (ack) {
      ack.addEventListener("change", function () { btn.disabled = !ack.checked; });
    }

    btn.addEventListener("click", function () {
      if (ack && !ack.checked) return;   // belt and braces; the button is disabled too
      setError("");
      btn.disabled = true;
      btn.textContent = "Taking you to Stripe…";
      createSession()
        .then(function (data) {
          if (!data.url) throw new Error("Checkout is unavailable right now.");
          window.location.href = data.url;
        })
        .catch(function (err) {
          setError(err.message || "Something went wrong. Please try again.");
          btn.disabled = false;
          btn.textContent = "Continue to payment";
        });
    });
  }

  /* ---- embedded: Stripe form mounted in-page ------------- */
  function loadStripeJs() {
    if (window.Stripe) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://js.stripe.com/v3/";
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Couldn’t load Stripe.")); };
      document.head.appendChild(s);
    });
  }

  function renderEmbedded() {
    payPanel.innerHTML =
      '<div class="pay-panel pay-panel--embed">' +
        '<p id="checkout-error" class="form-note form-note--error" hidden></p>' +
        ackHTML() +
        '<div id="checkout-embed">' +
          (PRE ? "" : '<p class="form-note">Loading secure checkout…</p>') +
        "</div>" +
      "</div>";

    /* Unlike the hosted button there is nothing to disable — the form
       simply isn't built until the notice is acknowledged. */
    var ack = document.getElementById("pre-ack-box");
    if (ack) {
      var mounted = false;
      ack.addEventListener("change", function () {
        if (!ack.checked || mounted) return;
        mounted = true;
        document.getElementById("checkout-embed").innerHTML =
          '<p class="form-note">Loading secure checkout…</p>';
        mountEmbedded();
      });
      return;
    }
    mountEmbedded();
  }

  function mountEmbedded() {
    if (!CFG.publishableKey) {
      setError("Embedded checkout needs a publishable key in assets/js/config.js.");
      return;
    }

    loadStripeJs()
      .then(function () { return createSession(); })
      .then(function (data) {
        if (!data.clientSecret) throw new Error("Checkout is unavailable right now.");
        var stripe = window.Stripe(CFG.publishableKey);
        return stripe.initEmbeddedCheckout({ clientSecret: data.clientSecret });
      })
      .then(function (checkout) {
        document.getElementById("checkout-embed").innerHTML = "";
        checkout.mount("#checkout-embed");
      })
      .catch(function (err) {
        var mount = document.getElementById("checkout-embed");
        if (mount) mount.innerHTML = "";
        setError(err.message || "Something went wrong. Please try again.");
      });
  }

  /* ---- boot ---------------------------------------------- */
  var initItems = cart() ? cart().items() : [];
  if (!initItems.length) {
    showEmpty();
  } else {
    fillSummary();
    if (!payPanel) return;
    if (!API) showUnconfigured();
    else if (MODE === "embedded") renderEmbedded();
    else renderHosted();
  }

  /* Keep the summary in sync if the cart is edited via the drawer.
     The embedded form is NOT re-rendered on every change — its
     session is already priced — so we nudge the shopper instead. */
  document.addEventListener("rfcart:change", function () {
    if (!document.getElementById("checkout-summary")) return;
    fillSummary();
    if (MODE === "embedded" && document.querySelector("#checkout-embed iframe")) {
      setError("Your cart changed — reload the page to update the payment form.");
    }
  });
})();
