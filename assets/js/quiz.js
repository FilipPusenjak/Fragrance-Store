/* ============================================================
   Robot Fragrances — Scent Finder quiz
   Reads window.RF_CATALOGUE (set by main.js) so the
   recommendations and prices always match the shop.
   ============================================================ */
(function () {
  "use strict";

  var mount = document.getElementById("quiz-card");
  if (!mount) return;

  var prod = window.RF_prod || function (s) { return "product.html?id=" + s; }; // canonical product page
  var site = window.RF_site || function (x) { return x; };
  var on = window.RF_feature || function () { return false; };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var resultMount = document.getElementById("quiz-result");
  var bar = document.getElementById("quiz-bar-fill");
  var counter = document.getElementById("quiz-count");

  /* Quiz answer keys -> catalogue slug (stable, ASCII-safe). */
  var KEY2SLUG = {
    swy: "swy-powerfully", h24: "hermes-h24", prada: "prada-l-homme",
    jpg: "jpg-le-male-le-parfum", bdc: "bleu-de-chanel", sauv: "dior-sauvage-edp",
    fire: "by-the-fireplace", ysly: "ysl-y-iced", erba: "erba-pura",
    green: "pdm-greenley", wildv: "wild-vetiver", ombra: "ombra-lirica",
    osm: "le-labo-osmanthus-19", then: "le-labo-the-noir-29", anim: "byredo-animalique",
    tfol: "tom-ford-ombre-leather", cedar: "super-cedar", myrrh: "myrrh-tonka"
  };

  /* Tie-breaker order (crowd-pleasers first). */
  var PRIORITY = ["bdc", "sauv", "erba", "then", "cedar", "jpg", "ysly", "myrrh", "osm",
    "h24", "prada", "wildv", "green", "fire", "ombra", "anim", "tfol", "swy"];

  var QUESTIONS = [
    { q: "What's the occasion?", options: [
      { label: "Everyday & the office", s: { bdc: 2, prada: 2, h24: 2, then: 1, wildv: 1, ysly: 2, tfol: 1, cedar: 2 } },
      { label: "A date or a night out", s: { jpg: 2, anim: 2, sauv: 1, ombra: 1, osm: 1, tfol: 2, myrrh: 2, swy: 2 } },
      { label: "A special occasion", s: { osm: 3, then: 2, ombra: 1, bdc: 1, myrrh: 1 } },
      { label: "Honestly, anything", s: { sauv: 2, bdc: 1, erba: 1, cedar: 1 } }
    ]},
    { q: "Which scent family calls to you?", options: [
      { label: "Fresh & citrusy", s: { h24: 2, ysly: 2, green: 2, bdc: 1, erba: 1 } },
      { label: "Warm & spicy", s: { sauv: 2, ombra: 2, jpg: 1, anim: 1, tfol: 2, myrrh: 2 } },
      { label: "Woody & earthy", s: { wildv: 3, then: 2, bdc: 1, prada: 1, tfol: 1, cedar: 2, green: 1 } },
      { label: "Sweet & gourmand", s: { jpg: 2, fire: 2, erba: 1, myrrh: 2, swy: 3 } },
      { label: "Soft & floral", s: { osm: 2, prada: 2, h24: 1, cedar: 1 } }
    ]},
    { q: "Pick a season.", options: [
      { label: "Spring", s: { ysly: 2, green: 2, h24: 1, prada: 1, osm: 1 } },
      { label: "Summer", s: { erba: 2, h24: 2, green: 1, ysly: 2 } },
      { label: "Autumn", s: { then: 2, wildv: 2, bdc: 1, ombra: 1, fire: 2, tfol: 2, cedar: 1, myrrh: 2, swy: 1 } },
      { label: "Winter", s: { jpg: 2, fire: 2, anim: 2, ombra: 1, tfol: 1, myrrh: 2, swy: 2 } }
    ]},
    { q: "Your style in a word?", options: [
      { label: "Classic & understated", s: { prada: 2, bdc: 2, wildv: 1, h24: 1, tfol: 1, cedar: 2 } },
      { label: "Bold & magnetic", s: { sauv: 2, jpg: 2, swy: 2, anim: 1, tfol: 2, myrrh: 1 } },
      { label: "Creative & unexpected", s: { then: 2, osm: 3, ombra: 1, green: 1, fire: 1 } },
      { label: "Clean & minimal", s: { h24: 2, ysly: 2, prada: 1, green: 1, cedar: 2 } }
    ]},
    { q: "How much presence do you want?", options: [
      { label: "Subtle — close to the skin", s: { prada: 2, h24: 2, then: 1, cedar: 1 } },
      { label: "Moderate — an arm's length", s: { bdc: 2, then: 2, ysly: 2, wildv: 1, osm: 1, fire: 1, tfol: 2, cedar: 2, myrrh: 1 } },
      { label: "Bold — fills the room", s: { sauv: 2, jpg: 2, anim: 2, ombra: 1, swy: 2, tfol: 1, myrrh: 2 } }
    ]},
    { q: "Which note draws you in?", options: [
      { label: "Citrus & bergamot", s: { sauv: 2, bdc: 2, h24: 1, erba: 1, green: 1, ysly: 2 } },
      { label: "Vanilla, amber & spice", s: { jpg: 2, fire: 2, ombra: 1, sauv: 1, tfol: 1, myrrh: 3, swy: 3, osm: 1 } },
      { label: "Vetiver, fig & green leaves", s: { wildv: 3, green: 2, then: 1, cedar: 1 } },
      { label: "Leather, tea & musk", s: { anim: 2, then: 1, ombra: 1, tfol: 2, cedar: 1 } }
    ]},
    { q: "Day or night?", options: [
      { label: "Daytime", s: { h24: 2, green: 2, ysly: 2, prada: 1, wildv: 1, erba: 1, cedar: 1 } },
      { label: "After dark", s: { jpg: 2, anim: 2, ombra: 2, fire: 1, osm: 1, tfol: 2, myrrh: 2, swy: 2 } },
      { label: "Both, all the time", s: { bdc: 2, then: 2, sauv: 1, erba: 1, tfol: 1, cedar: 2 } }
    ]},
    { q: "And your budget per decant?", filter: true, options: [
      { label: "Designer", desc: "From $4 a decant", group: "designer" },
      { label: "Niche — worth the splurge", desc: "From $8 a decant", group: "niche" },
      { label: "Best match, any price", desc: "Show me the one", group: null }
    ]}
  ];

  var BOTTLE_SVG =
    '<svg class="bottle" viewBox="0 0 100 150" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="40" y="5" width="20" height="15" rx="2.5"/><path d="M44 20h12v8H44z"/>' +
    '<path d="M28 28h44a8 8 0 0 1 8 8v100a8 8 0 0 1-8 8H28a8 8 0 0 1-8-8V36a8 8 0 0 1 8-8z"/>' +
    '<circle cx="42" cy="66" r="3.4" fill="currentColor" stroke="none"/>' +
    '<circle cx="58" cy="66" r="3.4" fill="currentColor" stroke="none"/>' +
    '<path d="M42 80c3 3 13 3 16 0"/>' +
    '<line x1="34" y1="106" x2="66" y2="106" opacity="0.4"/>' +
    '<line x1="34" y1="114" x2="58" y2="114" opacity="0.4"/></svg>';

  var answers = [];
  var current = 0;

  /* ---- Shareable results (features.quizShareResult) --------
     Answers live in ?a=, so a result can be sent to someone or
     reloaded later. Indices are validated against the questions on
     the way in — a hand-edited URL can't put the quiz in a bad
     state, it just starts from the beginning. */
  function readAnswersFromUrl() {
    if (!on("quizShareResult")) return null;
    try {
      var raw = new URLSearchParams(location.search).get("a");
      if (!raw) return null;
      var parts = raw.split(",").map(function (n) { return parseInt(n, 10); });
      if (parts.length !== QUESTIONS.length) return null;
      for (var i = 0; i < parts.length; i++) {
        if (!(parts[i] >= 0 && parts[i] < QUESTIONS[i].options.length)) return null;
      }
      return parts;
    } catch (e) { return null; }
  }

  function syncUrl() {
    if (!on("quizShareResult")) return;
    if (!window.history || !history.replaceState || typeof URL === "undefined") return;
    try {
      var url = new URL(location.href);
      var complete = answers.length === QUESTIONS.length &&
        answers.every(function (a) { return typeof a === "number"; });
      if (complete) url.searchParams.set("a", answers.join(","));
      else url.searchParams.delete("a");
      history.replaceState(null, "", url.toString());
    } catch (e) {}
  }

  function setProgress(p) { if (bar) bar.style.transform = "scaleX(" + p + ")"; }

  function render() {
    if (current >= QUESTIONS.length) { renderResult(); return; }
    var q = QUESTIONS[current];

    if (resultMount) { resultMount.hidden = true; resultMount.innerHTML = ""; }
    mount.hidden = false;
    if (counter) counter.textContent = "Question " + (current + 1) + " of " + QUESTIONS.length;
    setProgress(current / QUESTIONS.length);

    var opts = q.options.map(function (o, i) {
      var sel = answers[current] === i ? " is-selected" : "";
      var desc = o.desc ? '<span class="opt-desc">' + o.desc + "</span>" : "";
      return '<button type="button" class="quiz-option' + sel + '" data-i="' + i + '">' +
        '<span class="opt-label">' + o.label + "</span>" + desc + "</button>";
    }).join("");

    mount.innerHTML =
      '<span class="eyebrow">Scent finder</span>' +
      '<h2 class="quiz-question">' + q.q + "</h2>" +
      '<div class="quiz-options">' + opts + "</div>" +
      '<div class="quiz-foot">' +
        '<button type="button" class="quiz-back"' + (current === 0 ? " hidden" : "") + ">&larr; Back</button>" +
        '<span class="quiz-hint">' + (q.filter ? "Last one" : "Tap an answer to continue") + "</span>" +
      "</div>";

    mount.querySelectorAll(".quiz-option").forEach(function (btn) {
      btn.addEventListener("click", function () { choose(parseInt(btn.dataset.i, 10)); });
    });

    var back = mount.querySelector(".quiz-back");
    if (back) back.addEventListener("click", function () {
      if (current > 0) { current--; render(); }
    });

    /* Focus the question so a screen reader announces the change and
       the number keys below have somewhere sensible to land. */
    if (on("quizKeyboard")) {
      var h = mount.querySelector(".quiz-question");
      if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    }
  }

  function choose(i) {
    var q = QUESTIONS[current];
    if (!q || !(i >= 0 && i < q.options.length)) return;
    answers[current] = i;
    mount.querySelectorAll(".quiz-option").forEach(function (b) {
      b.classList.toggle("is-selected", parseInt(b.dataset.i, 10) === i);
    });
    setTimeout(function () { current++; render(); }, 240);
  }

  /* ---- Keyboard (features.quizKeyboard) ------------------- */
  document.addEventListener("keydown", function (e) {
    if (!on("quizKeyboard")) return;
    if (mount.hidden || current >= QUESTIONS.length) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var q = QUESTIONS[current];
    if (e.key >= "1" && e.key <= String(Math.min(9, q.options.length))) {
      e.preventDefault(); choose(parseInt(e.key, 10) - 1); return;
    }
    if (e.key === "ArrowLeft" && current > 0) { e.preventDefault(); current--; render(); return; }
    if (e.key === "ArrowRight" && typeof answers[current] === "number") {
      e.preventDefault(); current++; render();
    }
  });

  function computeResult() {
    var totals = {};
    /* per key: which answers gave it points, and how many */
    var contrib = {};
    QUESTIONS.forEach(function (q, qi) {
      if (q.filter) return;
      var opt = q.options[answers[qi]];
      if (!opt || !opt.s) return;
      Object.keys(opt.s).forEach(function (k) {
        totals[k] = (totals[k] || 0) + opt.s[k];
        (contrib[k] = contrib[k] || []).push({ label: opt.label, pts: opt.s[k] });
      });
    });

    var bOpt = QUESTIONS[QUESTIONS.length - 1].options[answers[QUESTIONS.length - 1]];
    var group = bOpt ? bOpt.group : null;

    var cat = window.RF_CATALOGUE || [];
    var bySlug = {};
    cat.forEach(function (p) { bySlug[p.slug] = p; });

    var entries = Object.keys(KEY2SLUG).map(function (k) {
      return { key: k, p: bySlug[KEY2SLUG[k]], pts: totals[k] || 0 };
    }).filter(function (e) { return e.p; });

    if (group) entries = entries.filter(function (e) { return e.p.group === group; });

    entries.sort(function (a, b) {
      return b.pts - a.pts || PRIORITY.indexOf(a.key) - PRIORITY.indexOf(b.key);
    });
    entries.forEach(function (e) { e.why = contrib[e.key] || []; });
    return entries;
  }

  /* The two or three answers that mattered most, phrased as the
     shopper picked them. Turns "here's a bottle" into "here's why". */
  function whyHTML(entry) {
    if (!on("quizExplainMatch") || !entry.why.length) return "";
    var top = entry.why.slice().sort(function (a, b) { return b.pts - a.pts; }).slice(0, 3);
    var bits = top.map(function (w) {
      return "<em>" + escapeHtml(w.label.toLowerCase()) + "</em>";
    });
    var list = bits.length > 1
      ? bits.slice(0, -1).join(", ") + " and " + bits[bits.length - 1]
      : bits[0];
    return '<p class="result-why">Because you chose ' + list + ".</p>";
  }

  function renderResult() {
    setProgress(1);
    if (counter) counter.textContent = "Your match";
    mount.hidden = true;

    var entries = computeResult();
    if (!entries.length || !resultMount) {
      if (resultMount) {
        resultMount.hidden = false;
        resultMount.innerHTML = '<p class="form-note" style="text-align:center">Something went off-script — <a href="shop.html">browse the shelf</a> instead.</p>';
      }
      return;
    }

    var win = entries[0].p;
    var alts = entries.slice(1, 3).map(function (e) { return e.p; });

    syncUrl();

    /* Quick-add: size buttons + add to cart, so a match can become an
       order without another page load. Reverts to the plain link when
       features.quizQuickAdd is off. */
    var quickAdd = on("quizQuickAdd") && window.RFCart;
    var sizeHTML = quickAdd
      ? '<div class="result-sizes size-options">' + win.sizes.map(function (sz, i) {
          return '<button type="button" class="size-opt' + (i === 0 ? " is-active" : "") +
            '" data-ml="' + sz.ml + '" data-price="' + sz.price + '">' +
            sz.ml + " ml <span>$" + sz.price + "</span></button>";
        }).join("") + "</div>"
      : "";

    var media = win.image
      ? '<img class="result-photo" src="' + win.image + '" alt="' + win.name + '" loading="lazy">'
      : BOTTLE_SVG;

    var altHTML = alts.length
      ? '<div class="result-alts"><h4>You might also like</h4><div class="alt-list">' +
          alts.map(function (p) {
            return '<a class="alt-chip" href="' + prod(p.slug) + '">' + p.name +
              ' <span>· from $' + p.from + "</span></a>";
          }).join("") +
        "</div></div>"
      : "";

    resultMount.innerHTML =
      '<div class="result-eyebrow"><span class="eyebrow">Your match</span></div>' +
      '<div class="result-card">' +
        '<div class="result-media' + (win.image ? " has-photo" : "") + '">' + media + "</div>" +
        '<div class="result-body">' +
          '<span class="product-house">' + win.label + "</span>" +
          '<h3 class="result-name">' + win.name + "</h3>" +
          '<p class="result-notes">' + win.notes + "</p>" +
          whyHTML(entries[0]) +
          (quickAdd
            ? '<div class="result-price"><span class="result-price-val">$' + win.sizes[0].price +
                '</span> <small>/ ' + win.sizes[0].ml + " ml</small></div>" + sizeHTML
            : '<div class="result-price">from $' + win.from + ' <small>/ ' +
                win.sizes[0].ml + " ml</small></div>") +
          '<div class="result-actions">' +
            (quickAdd
              ? '<button type="button" class="btn" id="quiz-add">Add to cart</button>' +
                '<a class="btn btn--ghost" href="' + prod(win.slug) + '">See the details</a>'
              : '<a class="btn" href="' + prod(win.slug) + '">Shop this decant</a>') +
          "</div>" +
          '<div class="result-actions result-actions--minor">' +
            '<button type="button" class="quiz-link" id="quiz-retake">Retake quiz</button>' +
            (on("quizKeyboard")
              ? '<button type="button" class="quiz-link" id="quiz-back-result">&larr; Change my last answer</button>'
              : "") +
            (on("quizShareResult")
              ? '<button type="button" class="quiz-link" id="quiz-share">Copy link to this result</button>'
              : "") +
          "</div>" +
          '<p class="quiz-share-note" data-share-note hidden></p>' +
          (on("quizQuickAdd")
            ? '<p class="result-set-link form-note">Not sure yet? Try it in a ' +
              '<a href="' + site("discovery.html") + '">discovery set</a> alongside four others.</p>'
            : "") +
          altHTML +
        "</div>" +
      "</div>";
    resultMount.hidden = false;

    var retake = document.getElementById("quiz-retake");
    if (retake) retake.addEventListener("click", function () {
      answers = [];
      current = 0;
      syncUrl();
      resultMount.hidden = true;
      resultMount.innerHTML = "";
      render();
      if (mount.scrollIntoView) mount.scrollIntoView({ block: "start" });
    });

    /* Step back into the last question with answers intact — someone
       who mis-tapped shouldn't have to redo all eight. */
    var backFromResult = document.getElementById("quiz-back-result");
    if (backFromResult) backFromResult.addEventListener("click", function () {
      current = QUESTIONS.length - 1;
      resultMount.hidden = true;
      resultMount.innerHTML = "";
      render();
      if (mount.scrollIntoView) mount.scrollIntoView({ block: "start" });
    });

    /* ---- Quick add ---------------------------------------- */
    if (quickAdd) {
      var state = { ml: win.sizes[0].ml, price: win.sizes[0].price };
      var priceVal = resultMount.querySelector(".result-price-val");
      var priceUnit = resultMount.querySelector(".result-price small");
      var sizes = resultMount.querySelector(".result-sizes");
      if (sizes) sizes.addEventListener("click", function (e) {
        var b = e.target.closest(".size-opt"); if (!b) return;
        state.ml = +b.dataset.ml; state.price = +b.dataset.price;
        sizes.querySelectorAll(".size-opt").forEach(function (x) {
          x.classList.toggle("is-active", x === b);
        });
        if (priceVal) priceVal.textContent = "$" + state.price;
        if (priceUnit) priceUnit.textContent = "/ " + state.ml + " ml";
      });

      var addBtn = document.getElementById("quiz-add");
      if (addBtn) addBtn.addEventListener("click", function () {
        window.RFCart.add(win.slug, state.ml, 1);
        window.RFCart.open();
      });
    }

    /* ---- Share -------------------------------------------- */
    /* cart.js mirrors the basket into every URL, so location.href on
       this page carries ?cart= as well as ?a=. Someone pressing "copy
       link to this result" means to send a scent match, not their
       shopping basket — so share the answers and nothing else. */
    function shareUrl() {
      try {
        var u = new URL(location.href);
        var a = u.searchParams.get("a");
        u.search = "";
        if (a) u.searchParams.set("a", a);
        u.hash = "";
        return u.toString();
      } catch (e) { return location.href; }
    }

    var shareBtn = document.getElementById("quiz-share");
    if (shareBtn) shareBtn.addEventListener("click", function () {
      var note = resultMount.querySelector("[data-share-note]");
      var url = shareUrl();
      function done(msg, ok) {
        if (!note) return;
        note.hidden = false;
        note.textContent = msg;
        note.style.color = ok ? "var(--accent)" : "#b23b3b";
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url)
          .then(function () { done("Link copied — it reopens on this result.", true); })
          .catch(function () { done(url, false); });
      } else {
        /* No clipboard access: show the URL so it can be copied by hand. */
        done(url, false);
      }
    });
  }

  /* A shared link lands straight on the result. */
  var restored = readAnswersFromUrl();
  if (restored) { answers = restored; current = QUESTIONS.length; }

  render();
})();
