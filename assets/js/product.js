/* ============================================================
   Robot Fragrances — product detail page
   Reads ?id=<slug>, renders the full product with a size +
   quantity selector and an add-to-cart action, plus related
   scents. Uses window.RF_CATALOGUE / RF_get / RF_BOTTLE.
   ============================================================ */
(function () {
  "use strict";

  var mount = document.getElementById("product-detail");
  if (!mount) return;

  var BOTTLE = window.RF_BOTTLE || "";
  var site = window.RF_site || function (x) { return x; };
  var prod = window.RF_prod || function (s) { return "product.html?id=" + s; };

  /* Slug comes from ?id= (legacy product.html) or the static
     page's data-slug (/fragrance/<slug>.html). */
  var fromQuery = new URLSearchParams(location.search).get("id");
  var slug = fromQuery || mount.getAttribute("data-slug");
  var p = window.RF_get ? window.RF_get(slug) : null;

  /* On the legacy ?id= page, point the canonical at the static page. */
  if (p && fromQuery) {
    var canon = document.querySelector('link[rel="canonical"]');
    if (!canon) { canon = document.createElement("link"); canon.rel = "canonical"; document.head.appendChild(canon); }
    canon.setAttribute("href", prod(p.slug));
  }

  if (!p) {
    mount.innerHTML =
      '<div class="container" style="text-align:center; padding-block: 2rem">' +
        '<p class="breadcrumb"><a href="' + site("index.html") + '">Home</a> / <a href="' + site("shop.html") + '">Shop</a></p>' +
        '<h1>Fragrance not found</h1>' +
        '<p class="lead" style="margin:1rem auto 2rem">We couldn’t find that one on the shelf.</p>' +
        '<a class="btn" href="' + site("shop.html") + '">Browse the full shelf</a>' +
      "</div>";
    var rel0 = document.getElementById("product-related");
    if (rel0) rel0.style.display = "none";
    return;
  }

  document.title = p.name + " — Robot Fragrances";
  var meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", p.name + " decant — " + p.notes);

  var state = { ml: p.sizes[0].ml, qty: 1 };
  function priceFor(ml) {
    for (var i = 0; i < p.sizes.length; i++) { if (p.sizes[i].ml === ml) return p.sizes[i].price; }
    return p.sizes[0].price;
  }

  var media = p.image ? '<img class="pd-photo" src="' + site(p.image) + '" alt="' + p.name + '">' : BOTTLE;
  var tag = p.tag ? '<span class="product-tag">' + p.tag + "</span>" : "";

  var specRows = [["Family", p.family], ["Best season", p.season], ["Occasion", p.occasion], ["Longevity", p.longevity]]
    .filter(function (s) { return s[1]; })
    .map(function (s) { return '<div class="pd-spec"><dt>' + s[0] + "</dt><dd>" + s[1] + "</dd></div>"; }).join("");

  var sizeHTML = p.sizes.map(function (s) {
    return '<button type="button" class="size-opt' + (s.ml === state.ml ? " is-active" : "") +
      '" data-ml="' + s.ml + '">' + s.ml + " ml <span>$" + s.price + "</span></button>";
  }).join("");

  mount.innerHTML =
    '<div class="container">' +
      '<p class="breadcrumb"><a href="' + site("index.html") + '">Home</a> / <a href="' + site("shop.html") + '">Shop</a> / ' + p.name + "</p>" +
      '<div class="pd-grid">' +
        '<div class="pd-media' + (p.image ? " has-photo" : "") + '">' + tag + media + "</div>" +
        '<div class="pd-info">' +
          '<span class="product-house">' + p.label + "</span>" +
          '<h1 class="pd-name">' + p.name + "</h1>" +
          '<p class="pd-notes">' + p.notes + "</p>" +
          '<p class="pd-desc">' + p.description + "</p>" +
          (specRows ? '<dl class="pd-specs">' + specRows + "</dl>" : "") +
          '<div class="pd-buy">' +
            '<div class="pd-field"><span class="pd-label">Size</span><div class="size-options pd-sizes">' + sizeHTML + "</div></div>" +
            '<div class="pd-row">' +
              '<div class="pd-field" style="margin:0"><span class="pd-label">Quantity</span>' +
                '<div class="qty pd-qty"><button type="button" class="qty-dec" aria-label="Decrease quantity">&minus;</button><span class="qty-val">1</span><button type="button" class="qty-inc" aria-label="Increase quantity">+</button></div>' +
              "</div>" +
              '<div class="pd-price-wrap"><span class="pd-label">Price</span><span class="pd-price">$' + priceFor(state.ml) + "</span></div>" +
            "</div>" +
            '<button type="button" class="btn pd-add">Add to cart</button>' +
          "</div>" +
          '<ul class="pd-reassure">' +
            "<li>Decanted from an authentic, batch-checked bottle</li>" +
            "<li>Filled to the millilitre &amp; sealed in a travel atomiser</li>" +
            "<li>Dispatched within 48 hours, anywhere in the US</li>" +
          "</ul>" +
        "</div>" +
      "</div>" +
    "</div>";

  var priceEl = mount.querySelector(".pd-price");
  var qtyValEl = mount.querySelector(".pd-qty .qty-val");
  function refresh() { priceEl.textContent = "$" + priceFor(state.ml) * state.qty; }

  mount.querySelector(".pd-sizes").addEventListener("click", function (e) {
    var b = e.target.closest(".size-opt"); if (!b) return;
    state.ml = +b.dataset.ml;
    mount.querySelectorAll(".pd-sizes .size-opt").forEach(function (x) { x.classList.toggle("is-active", x === b); });
    refresh();
  });
  mount.querySelector(".pd-qty").addEventListener("click", function (e) {
    if (e.target.closest(".qty-inc")) state.qty++;
    else if (e.target.closest(".qty-dec")) state.qty = Math.max(1, state.qty - 1);
    else return;
    qtyValEl.textContent = state.qty;
    refresh();
  });
  mount.querySelector(".pd-add").addEventListener("click", function () {
    if (window.RFCart) { window.RFCart.add(p.slug, state.ml, state.qty); window.RFCart.open(); }
  });

  /* ---- Related (same collection) ------------------------ */
  var rel = document.getElementById("product-related");
  var related = (window.RF_CATALOGUE || []).filter(function (x) { return x.group === p.group && x.slug !== p.slug; }).slice(0, 3);
  if (rel && related.length) {
    rel.innerHTML =
      '<div class="container">' +
        '<div class="section-head center"><span class="eyebrow">More to explore</span><h2>You might also like</h2></div>' +
        '<div class="product-grid">' + related.map(function (r) {
          var rmedia = r.image ? '<img class="product-photo" src="' + site(r.image) + '" alt="' + r.name + '" loading="lazy">' : BOTTLE;
          var href = prod(r.slug);
          return '<article class="product-card">' +
            '<a class="product-thumb' + (r.image ? " has-photo" : "") + '" href="' + href + '">' + (r.tag ? '<span class="product-tag">' + r.tag + "</span>" : "") + rmedia + "</a>" +
            '<div class="product-body">' +
              '<span class="product-house">' + r.label + "</span>" +
              '<h3 class="product-name"><a href="' + href + '">' + r.name + "</a></h3>" +
              '<p class="product-notes">' + r.notes + "</p>" +
              '<div class="product-foot"><span class="product-price">from $' + r.from + ' <small>/ 2 ml</small></span><a class="link-arrow" href="' + href + '">View &rarr;</a></div>' +
            "</div>" +
          "</article>";
        }).join("") + "</div>" +
      "</div>";
  } else if (rel) {
    rel.style.display = "none";
  }
})();
