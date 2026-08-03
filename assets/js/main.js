/* ============================================================
   Robot Fragrances — core data + shop/site interactions
   One catalogue (window.RF_CATALOGUE) feeds the shop, the
   product pages, the quiz and the cart so everything stays
   in sync. window.RF_get(slug) and window.RF_BOTTLE are
   shared helpers.
   ============================================================ */
(function () {
  "use strict";

  /* --- Pricing tiers (USD) ------------------------------- */
  /* Each tier lists the available sizes as [millilitres, price].

     The three priciest tiers stop at 10 ml on purpose. Those bottles
     are held in small quantities — a single 30 ml pour would take
     most of a 50 ml bottle for roughly half what the same volume
     earns as 5 ml decants, and they're the slowest to restock. It's
     also where a decant stops being a trial and starts competing
     with the full bottle. */
  var TIERS = {
    cheapDesigner: [[2, 4],  [5, 9],  [10, 17], [30, 45]],
    designer:      [[2, 6],  [5, 13], [10, 25], [30, 65]],
    niche:         [[2, 8],  [5, 17], [10, 30], [30, 85]],
    expNiche:      [[2, 15], [5, 32], [10, 60]],
    cityExclusive: [[2, 20], [5, 45], [10, 80]],
    byredoLelabo:  [[2, 12], [5, 30], [10, 55]]
  };

  /* --- Discovery set ------------------------------------- */
  /* Pick N different fragrances as 2 ml testers and the testers
     come with a discount. Counted by DISTINCT fragrance, not by
     quantity — the point is breadth, and five of the same scent
     isn't a discovery set.

     The worker enforces this independently from its own copy of
     these numbers (generated into worker/src/catalogue.js), so the
     browser can't invent a discount. Change them here only. */
  var SET_RULE = { ml: 2, min: 5, discount: 0.10 };

  /* --- Catalogue ----------------------------------------- */
  /* group = used for filtering; label = small line on the card. */
  var PRODUCTS = [
    { name: "SWY Powerfully",        label: "Designer", group: "designer", tier: "cheapDesigner", notes: "Bright, bold and built to last", image: "assets/img/swy-powerfully.webp" },
    { name: "Hermès H24",       label: "Designer", group: "designer", tier: "cheapDesigner", notes: "Clary sage · narcissus · rosewood · warm metallic musk", image: "assets/img/hermes-h24.webp" },
    { name: "Prada L'Homme",         label: "Designer", group: "designer", tier: "cheapDesigner", notes: "Neroli · iris · amber · cedar", image: "assets/img/prada-l-homme.webp" },
    { name: "JPG Le Male Le Parfum", label: "Designer", group: "designer", tier: "designer", notes: "Lavender · cardamom · vanilla · benzoin", tag: "Bestseller", image: "assets/img/jpg-le-male-le-parfum.webp" },
    { name: "Bleu de Chanel",        label: "Designer", group: "designer", tier: "designer", notes: "Citrus · cedar · sandalwood · incense", tag: "Bestseller", image: "assets/img/bleu-de-chanel.webp" },
    { name: "Dior Sauvage EDP",      label: "Designer", group: "designer", tier: "designer", notes: "Bergamot · ambroxan · spicy lavender · vanilla", image: "assets/img/dior-sauvage-edp.webp" },
    { name: "By the Fireplace",      label: "Designer", group: "designer", tier: "designer", notes: "Clove · roasted chestnut · vanilla · smoky woods", image: "assets/img/by-the-fireplace.webp" },
    { name: "Wood Neroli",           label: "Designer", group: "designer", tier: "designer", notes: "Neroli · orange blossom · warm woods", image: "assets/img/wood-neroli.webp" },
    { name: "Erba Pura",             label: "Niche", group: "niche", tier: "niche", notes: "Sicilian orange · summer fruits · amber · white musk", image: "assets/img/erba-pura.webp" },
    { name: "Myrrh & Tonka",         label: "Niche", group: "niche", tier: "niche", notes: "Myrrh · tonka bean · vanilla · almond", image: "assets/img/myrrh-tonka.webp" },
    { name: "PDM Greenley",          label: "Niche", group: "niche", tier: "niche", notes: "Mint · fig leaf · vetiver · tonka", image: "assets/img/pdm-greenley.webp" },
    { name: "Tom Ford Ombré Leather", label: "Niche", group: "niche", tier: "niche", notes: "Leather · cardamom · jasmine · amber", image: "assets/img/tom-ford-ombre-leather.webp" },
    { name: "Wild Vetiver",          label: "Niche · Rare", group: "niche", tier: "expNiche", notes: "Vetiver · citrus · spice · dry woods", image: "assets/img/wild-vetiver.webp" },
    { name: "Ombra Lirica",          label: "Niche · Rare", group: "niche", tier: "expNiche", notes: "Incense · amber · soft resins · woods", image: "assets/img/ombra-lirica.webp" },
    { name: "Le Labo Osmanthus 19",  label: "Niche", group: "niche", tier: "cityExclusive", notes: "Osmanthus · apricot · leather · musk", tag: "City Exclusive", image: "assets/img/le-labo-osmanthus-19.webp" },
    { name: "Le Labo Thé Noir 29", label: "Niche", group: "niche", tier: "byredoLelabo", notes: "Black tea · fig · bay leaf · cedarwood", image: "assets/img/le-labo-the-noir-29.webp" },
    { name: "Byredo Animalique",     label: "Niche", group: "niche", tier: "byredoLelabo", notes: "Musk · leather · amber · warm spice", image: "assets/img/byredo-animalique.webp" },
    { name: "Super Cedar",           label: "Niche", group: "niche", tier: "byredoLelabo", notes: "Virginian cedar · rose · sandalwood · musk", image: "assets/img/super-cedar.webp" }
  ];

  /* --- Long-form details (keyed by slug) ----------------- */
  var DETAILS = {
    "swy-powerfully": { description: "A confident, crowd-pleasing signature built to last — bright and energetic on the open, warm and tenacious as it settles into the skin.", family: "Aromatic", season: "Year-round", occasion: "Everyday", longevity: "8–10 hrs" },
    "hermes-h24": { description: "A modern men's fragrance that pairs dewy clary sage and narcissus with a warm, almost metallic woodiness — green, clean and quietly futuristic.", family: "Aromatic green", season: "Spring–Summer", occasion: "Office & day", longevity: "6–8 hrs" },
    "prada-l-homme": { description: "Powdery iris and neroli rest over soft amber and cedar — an understated, impeccably-groomed scent that whispers rather than shouts.", family: "Floral musk", season: "Spring", occasion: "Office & day", longevity: "6–8 hrs" },
    "jpg-le-male-le-parfum": { description: "The classic lavender–vanilla pairing turned rich and resinous with cardamom and benzoin — sweet, warm and unmistakably night-time.", family: "Oriental fougère", season: "Autumn–Winter", occasion: "Date & evening", longevity: "10+ hrs" },
    "bleu-de-chanel": { description: "The definitive do-everything fragrance: bright citrus, dry cedar, smoky incense and creamy sandalwood that carry effortlessly from the office to the evening.", family: "Woody aromatic", season: "Year-round", occasion: "Versatile", longevity: "8–10 hrs" },
    "dior-sauvage-edp": { description: "Juicy bergamot meets a huge ambroxan-and-vanilla base for that radiant, magnetic trail — bold, fresh-spicy and endlessly wearable.", family: "Amber fougère", season: "Year-round", occasion: "Versatile", longevity: "9–12 hrs" },
    "by-the-fireplace": { description: "Roasted chestnut, clove and creamy vanilla wrapped in smoky guaiac wood — like a winter evening spent beside an open fire.", family: "Woody gourmand", season: "Autumn–Winter", occasion: "Cosy evenings", longevity: "7–9 hrs" },
    "wood-neroli": { description: "Sun-warmed neroli and orange blossom resting on soft, clean woods — fresh, elegant and effortless to wear.", family: "Floral woody", season: "Spring–Summer", occasion: "Day & office", longevity: "6–8 hrs" },
    "erba-pura": { description: "A luminous burst of Sicilian orange and candied fruits over white musk and amber — joyful, fruity and famously easy to love.", family: "Fruity amber", season: "Spring–Summer", occasion: "Versatile", longevity: "8–10 hrs" },
    "pdm-greenley": { description: "Cool mint and fig leaf over green vetiver and soft tonka — a crisp, contemporary green that feels both fresh and refined.", family: "Green aromatic", season: "Spring–Summer", occasion: "Day & office", longevity: "7–9 hrs" },
    "tom-ford-ombre-leather": { description: "Supple leather softened with jasmine and cardamom over amber and a touch of moss — rugged yet refined, equally at home day or night.", family: "Leather", season: "Autumn–Winter", occasion: "Versatile", longevity: "8–10 hrs" },
    "wild-vetiver": { description: "Earthy vetiver lifted by bright citrus and a whisper of spice, drying down to clean, dry woods — a sophisticated everyday signature.", family: "Woody", season: "Spring–Autumn", occasion: "Office & day", longevity: "7–9 hrs" },
    "ombra-lirica": { description: "Smoky incense and soft resins glow over warm amber and woods — a contemplative, almost ceremonial scent for cooler evenings.", family: "Amber woody", season: "Autumn–Winter", occasion: "Evening", longevity: "8–10 hrs" },
    "le-labo-osmanthus-19": { description: "Apricot-tinged osmanthus laced with supple leather and musk — a city exclusive that's luminous, leathery and quietly unconventional.", family: "Floral leather", season: "Spring–Autumn", occasion: "Special", longevity: "7–9 hrs" },
    "le-labo-the-noir-29": { description: "Black tea, fig and bay leaf over cedar and vetiver — dry, sophisticated and endlessly versatile, the kind of scent people lean in to ask about.", family: "Woody aromatic", season: "Year-round", occasion: "Versatile", longevity: "7–9 hrs" },
    "byredo-animalique": { description: "Warm musk, supple leather and amber with a spiced undertone — intimate, skin-like and undeniably after-dark.", family: "Leather musk", season: "Autumn–Winter", occasion: "Evening", longevity: "8–10 hrs" },
    "super-cedar": { description: "Sharp Virginian cedar softened by a single rose, drying down to creamy sandalwood and musk — clean, woody and deceptively simple.", family: "Woody floral", season: "Year-round", occasion: "Versatile", longevity: "6–8 hrs" },
    "myrrh-tonka": { description: "Resinous myrrh wrapped in tonka bean, vanilla and almond — warm, sweet and faintly smoky, the kind of scent that sits close and lingers.", family: "Amber gourmand", season: "Autumn–Winter", occasion: "Evening", longevity: "8–10 hrs" }
  };

  function slugify(str) {
    return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  /* Enriched, shared catalogue (slug, sizes, starting price, details). */
  var CATALOGUE = PRODUCTS.map(function (p) {
    var slug = slugify(p.name);
    var d = DETAILS[slug] || {};
    var sizes = TIERS[p.tier].map(function (s) { return { ml: s[0], price: s[1] }; });
    return {
      name: p.name, label: p.label, group: p.group, tier: p.tier,
      notes: p.notes, tag: p.tag || "", image: p.image || "",
      slug: slug, sizes: sizes, from: sizes[0].price,
      description: d.description || p.notes,
      family: d.family || "", season: d.season || "", occasion: d.occasion || "", longevity: d.longevity || ""
    };
  });

  var BY_SLUG = {};
  CATALOGUE.forEach(function (p) { BY_SLUG[p.slug] = p; });

  var BOTTLE_SVG =
    '<svg class="bottle" viewBox="0 0 100 150" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="40" y="5" width="20" height="15" rx="2.5"/><path d="M44 20h12v8H44z"/>' +
    '<path d="M28 28h44a8 8 0 0 1 8 8v100a8 8 0 0 1-8 8H28a8 8 0 0 1-8-8V36a8 8 0 0 1 8-8z"/>' +
    '<circle cx="42" cy="66" r="3.4" fill="currentColor" stroke="none"/>' +
    '<circle cx="58" cy="66" r="3.4" fill="currentColor" stroke="none"/>' +
    '<path d="M42 80c3 3 13 3 16 0"/></svg>';

  /* Shared globals for the other scripts */
  window.RF_CATALOGUE = CATALOGUE;
  window.RF_SET_RULE = SET_RULE;
  window.RF_BOTTLE = BOTTLE_SVG;
  window.RF_get = function (slug) { return BY_SLUG[slug] || null; };

  /* Path helpers — static product pages live in /fragrance/, one
     level deep, so links and assets need a "../" prefix there.
     Used by main/cart/product/quiz so URLs resolve from any page. */
  var IN_SUB = /\/fragrance\//.test(location.pathname);
  function rfSite(p) { return (IN_SUB ? "../" : "") + p; }                       // assets + top-level pages
  function rfProd(slug) { return (IN_SUB ? "" : "fragrance/") + slug + ".html"; } // canonical product page
  window.RF_inSub = IN_SUB;
  window.RF_site = rfSite;
  window.RF_prod = rfProd;

  /* --- Render the shop grid ------------------------------ */
  var grid = document.getElementById("shop-grid");
  if (grid) {
    grid.innerHTML = CATALOGUE.map(function (p) {
      var first = p.sizes[0];
      var pills = p.sizes.map(function (s, i) {
        return '<button class="size-opt' + (i === 0 ? " is-active" : "") +
          '" type="button" data-ml="' + s.ml + '" data-price="' + s.price + '">' + s.ml + " ml</button>";
      }).join("");
      var tag = p.tag ? '<span class="product-tag">' + p.tag + "</span>" : "";
      var media = p.image
        ? '<img class="product-photo" src="' + rfSite(p.image) + '" alt="' + p.name + '" loading="lazy">'
        : BOTTLE_SVG;
      var href = rfProd(p.slug);
      return '' +
        '<article class="product-card reveal" id="' + p.slug + '" data-group="' + p.group + '">' +
          '<a class="product-thumb' + (p.image ? " has-photo" : "") + '" href="' + href + '" aria-label="' + p.name + '">' + tag + media + "</a>" +
          '<div class="product-body">' +
            '<span class="product-house">' + p.label + "</span>" +
            '<h3 class="product-name"><a href="' + href + '">' + p.name + "</a></h3>" +
            '<p class="product-notes">' + p.notes + "</p>" +
            '<div class="size-options" role="group" aria-label="Choose size">' + pills + "</div>" +
            '<div class="product-foot">' +
              '<span class="product-price">$' + first.price + ' <small>/ ' + first.ml + ' ml</small></span>' +
              '<button class="product-add" type="button">Add decant</button>' +
            "</div>" +
          "</div>" +
        "</article>";
    }).join("");

    // If we arrived via a deep link (e.g. from the quiz), reveal that card.
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) {
        target.classList.add("is-visible");
        target.scrollIntoView({ block: "center" });
      }
    }
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

  /* --- Scroll reveal ------------------------------------- */
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

  /* --- Shop-card size selection (delegated) -------------- */
  /* Adding to cart is handled in cart.js. */
  document.addEventListener("click", function (e) {
    var size = e.target.closest(".size-opt");
    if (!size) return;
    var card = size.closest(".product-card");
    if (!card) return;   // product page manages its own size state
    card.querySelectorAll(".size-opt").forEach(function (b) {
      b.classList.toggle("is-active", b === size);
    });
    var priceEl = card.querySelector(".product-price");
    if (priceEl) {
      priceEl.innerHTML = "$" + size.dataset.price + " <small>/ " + size.dataset.ml + " ml</small>";
    }
  });

  /* --- Forms (Formspree-ready) --------------------------- *
   * Progressive enhancement: without JS the form does a normal
   * POST to its action; with JS we POST via fetch and show an
   * inline message. Both need a real endpoint in the form's
   * action — until then it stays honestly non-functional.
   * Set action to your Formspree endpoint (replace
   * FORM_ENDPOINT_TODO), e.g. https://formspree.io/f/xxxxxxx     */
  function setNote(form, msg, ok) {
    /* The contact form keeps its note inside the form; the newsletter
       card puts it after. Look inside first, then alongside. */
    var note = form.querySelector("[data-form-note]");
    if (!note && form.parentNode) note = form.parentNode.querySelector("[data-form-note]");
    if (!note) return;
    note.textContent = msg;
    note.style.color = ok ? "var(--accent)" : "#b23b3b";
  }
  document.querySelectorAll("form[data-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      var action = form.getAttribute("action") || "";
      var configured = action && action.indexOf("FORM_ENDPOINT_TODO") === -1 && /^https?:\/\//.test(action);
      if (!configured) {
        e.preventDefault();
        setNote(form, "This form isn’t connected yet — add your form endpoint to enable it.", false);
        return;
      }
      e.preventDefault();
      setNote(form, "Sending…", true);
      fetch(action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) {
          if (r.ok) {
            setNote(form, form.getAttribute("data-form-success") ||
              "Thank you — your message is on its way. We’ll be in touch soon.", true);
            form.reset();
          }
          else { setNote(form, "Something went wrong. Please email hello@robotfragrances.com instead.", false); }
        })
        .catch(function () { form.submit(); }); // network hiccup: fall back to a normal POST
    });
  });

  /* --- Footer year --------------------------------------- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* --- Catalogue size (so the hero stat can't go stale) --- */
  document.querySelectorAll("[data-scent-count]").forEach(function (el) {
    el.textContent = CATALOGUE.length;
  });
})();
