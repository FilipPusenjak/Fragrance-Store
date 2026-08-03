/* ============================================================
   Robot Fragrances — discovery set builder
   ------------------------------------------------------------
   Pick N different fragrances as 2 ml testers and the testers are
   discounted. Reads window.RF_CATALOGUE and window.RF_SET_RULE so
   the sizes, prices and threshold match the rest of the site.

   The total shown here is a preview. The worker recomputes it from
   its own copy of the same rule, so what's charged never depends on
   anything this page decides.
   ============================================================ */
(function () {
  "use strict";

  var mount = document.getElementById("discovery-builder");
  if (!mount) return;

  var CAT = window.RF_CATALOGUE || [];
  var RULE = window.RF_SET_RULE || { ml: 2, min: 5, discount: 0.10 };
  var BOTTLE = window.RF_BOTTLE || "";
  var site = window.RF_site || function (x) { return x; };
  var prod = window.RF_prod || function (s) { return "product.html?id=" + s; };

  var WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven",
    "eight", "nine", "ten", "eleven", "twelve"];
  function word(n) { return WORDS[n] || String(n); }

  /* Only fragrances actually offered at the tester size. */
  function testerPrice(p) {
    for (var i = 0; i < p.sizes.length; i++) {
      if (p.sizes[i].ml === RULE.ml) return p.sizes[i].price;
    }
    return 0;
  }
  var POOL = CAT.filter(function (p) { return testerPrice(p) > 0; });

  /* Fill the copy in the hero from the rule, so changing the rule
     doesn't leave the page promising something different. */
  document.querySelectorAll("[data-set-min]").forEach(function (el) {
    el.textContent = word(RULE.min);
  });
  document.querySelectorAll("[data-set-discount]").forEach(function (el) {
    el.textContent = Math.round(RULE.discount * 100) + "%";
  });

  var picked = [];   // slugs, in the order chosen

  function money(n) {
    return "$" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function gross() {
    return picked.reduce(function (n, slug) {
      var p = window.RF_get(slug);
      return n + (p ? testerPrice(p) : 0);
    }, 0);
  }
  function qualifies() { return picked.length >= RULE.min; }
  function net() {
    var g = gross();
    return qualifies() ? g * (1 - RULE.discount) : g;
  }

  function cardHTML(p) {
    var on = picked.indexOf(p.slug) !== -1;
    var media = p.image
      ? '<img src="' + site(p.image) + '" alt="' + escapeHtml(p.name) + '" loading="lazy">'
      : '<span class="ds-svg">' + BOTTLE + "</span>";
    return '<button type="button" class="ds-card' + (on ? " is-picked" : "") + '"' +
        ' data-slug="' + p.slug + '" aria-pressed="' + (on ? "true" : "false") + '">' +
        '<span class="ds-tick" aria-hidden="true">&check;</span>' +
        '<span class="ds-media' + (p.image ? " has-photo" : "") + '">' + media + "</span>" +
        '<span class="ds-info">' +
          '<span class="ds-house">' + escapeHtml(p.label) + "</span>" +
          '<span class="ds-name">' + escapeHtml(p.name) + "</span>" +
          '<span class="ds-notes">' + escapeHtml(p.notes) + "</span>" +
        "</span>" +
        '<span class="ds-price">' + money(testerPrice(p)) + "</span>" +
      "</button>";
  }

  function summaryHTML() {
    var n = picked.length;
    var need = Math.max(0, RULE.min - n);
    var g = gross(), t = net();
    var pct = Math.round(RULE.discount * 100);

    var chips = picked.map(function (slug) {
      var p = window.RF_get(slug);
      if (!p) return "";
      return '<span class="ds-chip">' + escapeHtml(p.name) +
        '<button type="button" class="ds-chip-x" data-remove="' + slug +
        '" aria-label="Remove ' + escapeHtml(p.name) + '">&times;</button></span>';
    }).join("");

    var status = qualifies()
      ? '<p class="ds-status is-on">Discount applied — ' + pct + "% off your testers.</p>"
      : '<p class="ds-status">Add ' + word(need) + " more " +
        (need === 1 ? "tester" : "testers") + " to unlock " + pct + "% off.</p>";

    return '<div class="ds-summary-inner">' +
        '<div class="ds-count"><span class="ds-count-num">' + n + "</span>" +
          '<span class="ds-count-lbl">of ' + RULE.min + " selected</span></div>" +
        '<div class="ds-bar"><span style="width:' +
          Math.min(100, (n / RULE.min) * 100) + '%"></span></div>' +
        status +
        (chips ? '<div class="ds-chips">' + chips + "</div>" : "") +
        '<div class="ds-totals">' +
          (qualifies()
            ? '<div class="ds-line"><span>Testers</span><span>' + money(g) + "</span></div>" +
              '<div class="ds-line ds-line--save"><span>Set discount</span><span>&minus;' +
                money(g - t) + "</span></div>"
            : "") +
          '<div class="ds-line ds-line--total"><span>Total</span><span>' + money(t) + "</span></div>" +
        "</div>" +
        '<button type="button" class="btn ds-add"' + (n ? "" : " disabled") + ">" +
          (n ? "Add " + n + " tester" + (n === 1 ? "" : "s") + " to cart" : "Pick some testers") +
        "</button>" +
        (n && !qualifies()
          ? '<p class="ds-note">You can add these now — the discount applies automatically once ' +
            "you reach " + RULE.min + ".</p>"
          : "") +
        (n ? '<button type="button" class="ds-clear">Clear selection</button>' : "") +
      "</div>";
  }

  function render() {
    mount.innerHTML =
      '<div class="ds-layout">' +
        '<div class="ds-grid">' + POOL.map(cardHTML).join("") + "</div>" +
        '<aside class="ds-summary">' + summaryHTML() + "</aside>" +
      "</div>";
  }

  function toggle(slug) {
    var i = picked.indexOf(slug);
    if (i === -1) picked.push(slug); else picked.splice(i, 1);
    render();
  }

  mount.addEventListener("click", function (e) {
    var rm = e.target.closest("[data-remove]");
    if (rm) { toggle(rm.getAttribute("data-remove")); return; }

    if (e.target.closest(".ds-clear")) { picked = []; render(); return; }

    if (e.target.closest(".ds-add")) {
      if (!picked.length || !window.RFCart) return;
      picked.forEach(function (slug) { window.RFCart.add(slug, RULE.ml, 1); });
      picked = [];
      render();
      window.RFCart.open();
      return;
    }

    var card = e.target.closest(".ds-card");
    if (card) toggle(card.getAttribute("data-slug"));
  });

  render();
})();
