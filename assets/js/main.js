/* ============================================================
   Robot Fragrances — interactions
   Mostly progressive enhancement. The shop grid is rendered
   from the catalogue below (single source of truth for pricing).
   ============================================================ */
(function () {
  "use strict";

  /* --- Pricing tiers (USD) ------------------------------- */
  /* Each tier lists the available sizes as [millilitres, price]. */
  var TIERS = {
    cheapDesigner: [[2, 4],  [5, 9],  [10, 17], [30, 45]],
    designer:      [[2, 6],  [5, 13], [10, 25], [30, 65]],
    niche:         [[2, 8],  [5, 17], [10, 30], [30, 85]],
    expNiche:      [[2, 15], [5, 32], [10, 60], [30, 160]],
    cityExclusive: [[2, 20], [5, 45], [10, 80]],
    byredoLelabo:  [[2, 12], [5, 30], [10, 55], [30, 150]]
  };

  /* --- Catalogue ----------------------------------------- */
  /* group = used for filtering; label = small line on the card. */
  var PRODUCTS = [
    { name: "SWY Powerfully",        label: "Designer", group: "designer", tier: "cheapDesigner", notes: "Bright, bold and built to last" },
    { name: "Hermès H24",       label: "Designer", group: "designer", tier: "cheapDesigner", notes: "Clary sage · narcissus · rosewood · warm metallic musk" },
    { name: "Prada L'Homme",         label: "Designer", group: "designer", tier: "cheapDesigner", notes: "Neroli · iris · amber · cedar" },
    { name: "JPG Le Male Le Parfum", label: "Designer", group: "designer", tier: "designer", notes: "Lavender · cardamom · vanilla · benzoin", tag: "Bestseller" },
    { name: "Bleu de Chanel",        label: "Designer", group: "designer", tier: "designer", notes: "Citrus · cedar · sandalwood · incense", tag: "Bestseller" },
    { name: "Dior Sauvage EDP",      label: "Designer", group: "designer", tier: "designer", notes: "Bergamot · ambroxan · spicy lavender · vanilla" },
    { name: "By the Fireplace",      label: "Designer", group: "designer", tier: "designer", notes: "Clove · roasted chestnut · vanilla · smoky woods" },
    { name: "Wood Neroli",           label: "Designer", group: "designer", tier: "designer", notes: "Neroli · orange blossom · warm woods" },
    { name: "Erba Pura",             label: "Niche", group: "niche", tier: "niche", notes: "Sicilian orange · summer fruits · amber · white musk" },
    { name: "PDM Greenley",          label: "Niche", group: "niche", tier: "niche", notes: "Mint · fig leaf · vetiver · tonka" },
    { name: "Wild Vetiver",          label: "Niche · Rare", group: "niche", tier: "expNiche", notes: "Vetiver · citrus · spice · dry woods" },
    { name: "Ombra Lirica",          label: "Niche · Rare", group: "niche", tier: "expNiche", notes: "Incense · amber · soft resins · woods" },
    { name: "Le Labo Osmanthus 19",  label: "Niche", group: "niche", tier: "cityExclusive", notes: "Osmanthus · apricot · leather · musk", tag: "City Exclusive" },
    { name: "Le Labo Thé Noir 29", label: "Niche", group: "niche", tier: "byredoLelabo", notes: "Black tea · fig · bay leaf · cedarwood" },
    { name: "Byredo Animalique",     label: "Niche", group: "niche", tier: "byredoLelabo", notes: "Musk · leather · amber · warm spice" }
  ];

  var BOTTLE_SVG =
    '<svg class="bottle" viewBox="0 0 100 150" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="40" y="5" width="20" height="15" rx="2.5"/><path d="M44 20h12v8H44z"/>' +
    '<path d="M28 28h44a8 8 0 0 1 8 8v100a8 8 0 0 1-8 8H28a8 8 0 0 1-8-8V36a8 8 0 0 1 8-8z"/>' +
    '<circle cx="42" cy="66" r="3.4" fill="currentColor" stroke="none"/>' +
    '<circle cx="58" cy="66" r="3.4" fill="currentColor" stroke="none"/>' +
    '<path d="M42 80c3 3 13 3 16 0"/></svg>';

  /* --- Render the shop grid ------------------------------ */
  var grid = document.getElementById("shop-grid");
  if (grid) {
    grid.innerHTML = PRODUCTS.map(function (p) {
      var sizes = TIERS[p.tier];
      var first = sizes[0];
      var pills = sizes.map(function (s, i) {
        return '<button class="size-opt' + (i === 0 ? " is-active" : "") +
          '" type="button" data-ml="' + s[0] + '" data-price="' + s[1] + '">' + s[0] + " ml</button>";
      }).join("");
      var tag = p.tag ? '<span class="product-tag">' + p.tag + "</span>" : "";
      return '' +
        '<article class="product-card reveal" data-group="' + p.group + '">' +
          '<div class="product-thumb">' + tag + BOTTLE_SVG + "</div>" +
          '<div class="product-body">' +
            '<span class="product-house">' + p.label + "</span>" +
            '<h3 class="product-name">' + p.name + "</h3>" +
            '<p class="product-notes">' + p.notes + "</p>" +
            '<div class="size-options" role="group" aria-label="Choose size">' + pills + "</div>" +
            '<div class="product-foot">' +
              '<span class="product-price">$' + first[1] + ' <small>/ ' + first[0] + ' ml</small></span>' +
              '<button class="product-add" type="button">Add decant</button>' +
            "</div>" +
          "</div>" +
        "</article>";
    }).join("");
  }

  /* --- Mobile nav toggle --------------------------------- */
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  if (header && toggle) {
    toggle.addEventListener("click", function () {
      var open = header.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    header.querySelectorAll(".nav-links a").forEach(function (link) {
      link.addEventListener("click", function () {
        header.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* --- Scroll reveal (covers freshly rendered cards) ----- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* --- Shop filter --------------------------------------- */
  var filterBar = document.querySelector(".filter-bar");
  if (filterBar) {
    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-filter]");
      if (!btn) return;
      filterBar.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      var filter = btn.dataset.filter;
      document.querySelectorAll("#shop-grid [data-group]").forEach(function (card) {
        var show = filter === "all" || card.dataset.group === filter;
        card.style.display = show ? "" : "none";
      });
    });
  }

  /* --- Card interactions (delegated: works on rendered DOM) */
  document.addEventListener("click", function (e) {
    // Size selection updates the displayed price
    var size = e.target.closest(".size-opt");
    if (size) {
      var card = size.closest(".product-card");
      card.querySelectorAll(".size-opt").forEach(function (b) {
        b.classList.toggle("is-active", b === size);
      });
      var priceEl = card.querySelector(".product-price");
      if (priceEl) {
        priceEl.innerHTML = "$" + size.dataset.price + " <small>/ " + size.dataset.ml + " ml</small>";
      }
      return;
    }
    // Add-to-decant feedback (demo). Anchors (e.g. "View sizes") just navigate.
    var add = e.target.closest("button.product-add");
    if (add && !add.disabled) {
      var original = add.textContent;
      add.textContent = "Added ✓";
      add.disabled = true;
      setTimeout(function () {
        add.textContent = original;
        add.disabled = false;
      }, 1400);
    }
  });

  /* --- Demo forms (no backend) --------------------------- */
  document.querySelectorAll("form[data-demo]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var note = form.querySelector("[data-form-note]");
      if (note) {
        note.textContent = "Thank you — this is a demo, so nothing was sent. We'll be in touch soon.";
        note.style.color = "var(--accent)";
      }
      form.reset();
    });
  });

  /* --- Footer year --------------------------------------- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
