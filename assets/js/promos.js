/* ============================================================
   Robot Fragrances — promotional placements
   ------------------------------------------------------------
   Injects the discovery-set and newsletter prompts that don't
   belong to any one page's own script. Each is behind a flag in
   assets/js/config.js; turn one off and that placement simply
   isn't rendered — no other behaviour changes.

     homeDiscoveryBand   band on the homepage
     footerNewsletter    compact signup in every footer
     confirmNewsletter   signup after a completed order
     productSetLink      set link under the buy box

   Nothing here is required for the shop to work. It is all
   additive by design so it can be reverted piecemeal.
   ============================================================ */
(function () {
  "use strict";

  var on = window.RF_feature || function () { return false; };
  var site = window.RF_site || function (x) { return x; };
  var RULE = window.RF_SET_RULE || { ml: 2, min: 5, discount: 0.10 };
  var PCT = Math.round(RULE.discount * 100);

  /* One endpoint, shared with the other forms. main.js owns the
     resolving — it's the same rule that rewrites the hand-written
     forms, so an injected box can't end up pointing somewhere else.
     Reading it off a form on the page is only a fallback, because
     that is what limited the footer newsletter to the two pages that
     happen to have a form of their own. */
  function formAction() {
    if (window.RF_newsletterUrl) {
      var url = window.RF_newsletterUrl();
      if (url) return url;
    }
    var cfg = window.RF_CONFIG && window.RF_CONFIG.formEndpoint;
    if (cfg) return cfg;
    var f = document.querySelector('form[data-form][action^="http"]');
    return f ? f.getAttribute("action") : null;
  }

  /* Every email MailerLite sends carries its own unsubscribe link, so
     the opt-out beside the box is no longer the only way out — but it
     stays, because someone deciding whether to hand over an address
     shouldn't have to take the way back on faith. Same wording as
     index.html and privacy.html. */
  var OPT_OUT =
    '<small class="news-optout">One email a month, and you can leave whenever you like — ' +
    "every email has an unsubscribe link, or " +
    '<a href="mailto:hello@robotfragrances.com?subject=Unsubscribe">email us</a> ' +
    "and we’ll take you off the list.</small>";

  function newsletterForm(opts) {
    var action = formAction();
    /* Without a configured endpoint a signup box would silently eat
       addresses, which is worse than not offering one. */
    if (!action) return "";
    var id = opts.id;
    return '<form class="' + opts.cls + '" data-form data-newsletter ' +
        'data-form-success="' + opts.success + '" ' +
        'method="POST" action="' + action + '">' +
        '<label class="sr-only" for="' + id + '" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Email address</label>' +
        '<input id="' + id + '" name="email" type="email" placeholder="you@example.com" required />' +
        '<input type="hidden" name="_subject" value="' + opts.subject + '" />' +
        '<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="display:none !important" aria-hidden="true" />' +
        '<button class="btn' + (opts.light ? " btn--light" : "") + '" type="submit">' + opts.cta + "</button>" +
      "</form>" +
      '<p data-form-note class="form-note"></p>' +
      OPT_OUT;
  }

  /* ---- Homepage: discovery set band ---------------------- */
  function homeBand() {
    if (!on("homeDiscoveryBand")) return;
    var anchor = document.getElementById("newsletter");
    if (!anchor) return;   // homepage only

    var sec = document.createElement("section");
    sec.className = "section--tight discovery-band";
    sec.innerHTML =
      '<div class="container">' +
        '<div class="db-inner reveal">' +
          '<div class="db-copy">' +
            '<span class="eyebrow">Not sure where to start?</span>' +
            "<h2>Try " + RULE.min + " before you commit to one.</h2>" +
            "<p>Build a discovery set from any " + RULE.min + " fragrances on the shelf — " +
              RULE.ml + "&nbsp;ml of each, boxed together, " + PCT + "% off. " +
              "It's the cheapest way to find the one you'll actually wear.</p>" +
            '<a class="btn" href="' + site("discovery.html") + '">Build a set</a>' +
          "</div>" +
          '<div class="db-visual" aria-hidden="true">' + vialRow() + "</div>" +
        "</div>" +
      "</div>";
    anchor.parentNode.insertBefore(sec, anchor);
  }

  /* Five little atomisers, drawn rather than photographed so the band
     doesn't imply a specific five. */
  function vialRow() {
    var out = "";
    for (var i = 0; i < RULE.min; i++) {
      out += '<svg class="db-vial" viewBox="0 0 24 60" fill="none" stroke="currentColor" ' +
        'stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="9" y="2" width="6" height="6" rx="1"/>' +
        '<path d="M10.5 8h3v4h-3z"/>' +
        '<rect x="4" y="12" width="16" height="44" rx="4"/>' +
        '<line x1="8" y1="' + (46 - i * 6) + '" x2="16" y2="' + (46 - i * 6) + '" opacity="0.35"/>' +
        "</svg>";
    }
    return out;
  }

  /* ---- Every footer: compact newsletter ------------------ */
  function footerSignup() {
    if (!on("footerNewsletter")) return;
    var brand = document.querySelector(".site-footer .footer-brand");
    if (!brand) return;
    var html = newsletterForm({
      cls: "footer-news", id: "footer-news-email", light: true,
      cta: "Join", subject: "Newsletter sign-up — robotfragrances.com",
      success: "You’re on the list."
    });
    if (!html) return;
    var wrap = document.createElement("div");
    wrap.className = "footer-news-wrap";
    wrap.innerHTML = "<h4>The dispatch</h4>" +
      "<p>New decants and restocks, once a month. No noise.</p>" + html;
    brand.appendChild(wrap);
  }

  /* ---- After an order: newsletter ------------------------ */
  /* The warmest moment on the site — they've just bought something. */
  function confirmSignup() {
    if (!on("confirmNewsletter")) return;
    var root = document.getElementById("confirm-root");
    if (!root) return;

    var seen = null;
    var obs = new MutationObserver(function () {
      var card = root.querySelector(".confirm-card");
      /* Only on a genuine success, never on the failed/unknown states. */
      if (!card || !card.querySelector(".confirm-check") || card === seen) return;
      seen = card;
      var html = newsletterForm({
        cls: "newsletter", id: "confirm-news-email", light: false,
        cta: "Keep me posted", subject: "Newsletter sign-up (post-order) — robotfragrances.com",
        success: "You’re on the list — see you next month."
      });
      if (!html) return;
      var box = document.createElement("div");
      box.className = "confirm-news";
      box.innerHTML = "<h3>Want first look at new decants?</h3>" +
        "<p>One email a month — new arrivals and restocks, nothing else.</p>" + html;
      card.appendChild(box);
      bindForms();
    });
    obs.observe(root, { childList: true, subtree: true });
  }

  /* ---- Product pages: set link --------------------------- */
  function productLink() {
    if (!on("productSetLink")) return;
    var mount = document.getElementById("product-detail");
    if (!mount) return;

    var place = function () {
      var buy = mount.querySelector(".pd-reassure");
      if (!buy || mount.querySelector(".pd-set-link")) return;
      var p = document.createElement("p");
      p.className = "pd-set-link form-note";
      p.innerHTML = "Still deciding? Put this in a " +
        '<a href="' + site("discovery.html") + '">discovery set</a> with ' +
        (RULE.min - 1) + " others and save " + PCT + "%.";
      buy.parentNode.insertBefore(p, buy.nextSibling);
    };
    place();
    /* product.js rebuilds the panel, so try again once it has. */
    new MutationObserver(place).observe(mount, { childList: true, subtree: true });
  }

  /* Injected content needs two things main.js set up before we ran:
     the shared form handler, and the scroll-reveal observer. Without
     the second, anything with .reveal sits at opacity 0 forever. */
  function bindForms() {
    document.dispatchEvent(new CustomEvent("rf:forms-added"));
    if (window.RF_observeReveals) window.RF_observeReveals();
  }

  function init() {
    homeBand();
    footerSignup();
    confirmSignup();
    productLink();
    bindForms();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
