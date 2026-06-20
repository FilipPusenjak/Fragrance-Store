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

  var resultMount = document.getElementById("quiz-result");
  var bar = document.getElementById("quiz-bar-fill");
  var counter = document.getElementById("quiz-count");

  /* Quiz answer keys -> catalogue slug (stable, ASCII-safe). */
  var KEY2SLUG = {
    swy: "swy-powerfully", h24: "hermes-h24", prada: "prada-l-homme",
    jpg: "jpg-le-male-le-parfum", bdc: "bleu-de-chanel", sauv: "dior-sauvage-edp",
    fire: "by-the-fireplace", woodn: "wood-neroli", erba: "erba-pura",
    green: "pdm-greenley", wildv: "wild-vetiver", ombra: "ombra-lirica",
    osm: "le-labo-osmanthus-19", then: "le-labo-the-noir-29", anim: "byredo-animalique",
    tfol: "tom-ford-ombre-leather"
  };

  /* Tie-breaker order (crowd-pleasers first). */
  var PRIORITY = ["bdc", "sauv", "erba", "then", "jpg", "osm", "h24", "prada",
    "wildv", "green", "fire", "woodn", "ombra", "anim", "tfol", "swy"];

  var QUESTIONS = [
    { q: "What's the occasion?", options: [
      { label: "Everyday & the office", s: { bdc: 2, prada: 2, h24: 2, then: 1, wildv: 1, woodn: 1, tfol: 1 } },
      { label: "A date or a night out", s: { jpg: 2, anim: 2, sauv: 1, ombra: 1, osm: 1, tfol: 2 } },
      { label: "A special occasion", s: { osm: 2, then: 2, ombra: 1, bdc: 1 } },
      { label: "Honestly, anything", s: { sauv: 2, swy: 2, bdc: 1, erba: 1 } }
    ]},
    { q: "Which scent family calls to you?", options: [
      { label: "Fresh & citrusy", s: { h24: 2, woodn: 2, green: 1, bdc: 1, erba: 1, swy: 1 } },
      { label: "Warm & spicy", s: { sauv: 2, ombra: 2, jpg: 1, anim: 1, tfol: 2 } },
      { label: "Woody & earthy", s: { wildv: 2, then: 2, bdc: 1, prada: 1, tfol: 1 } },
      { label: "Sweet & gourmand", s: { jpg: 2, fire: 2, erba: 1 } },
      { label: "Soft & floral", s: { osm: 2, prada: 2, h24: 1 } }
    ]},
    { q: "Pick a season.", options: [
      { label: "Spring", s: { woodn: 2, green: 2, h24: 1, prada: 1, osm: 1 } },
      { label: "Summer", s: { erba: 2, h24: 2, green: 1, woodn: 1, swy: 1 } },
      { label: "Autumn", s: { then: 2, wildv: 2, bdc: 1, ombra: 1, fire: 2, tfol: 2 } },
      { label: "Winter", s: { jpg: 2, fire: 2, anim: 2, ombra: 1, tfol: 1 } }
    ]},
    { q: "Your style in a word?", options: [
      { label: "Classic & understated", s: { prada: 2, bdc: 2, wildv: 1, h24: 1, tfol: 1 } },
      { label: "Bold & magnetic", s: { sauv: 2, jpg: 2, swy: 2, anim: 1, tfol: 2 } },
      { label: "Creative & unexpected", s: { then: 2, osm: 2, ombra: 1, green: 1, fire: 1 } },
      { label: "Clean & minimal", s: { h24: 2, woodn: 2, prada: 1, green: 1 } }
    ]},
    { q: "How much presence do you want?", options: [
      { label: "Subtle — close to the skin", s: { prada: 2, h24: 2, then: 1, woodn: 1 } },
      { label: "Moderate — an arm's length", s: { bdc: 2, then: 2, woodn: 1, wildv: 1, osm: 1, fire: 1, tfol: 2 } },
      { label: "Bold — fills the room", s: { sauv: 2, jpg: 2, anim: 2, ombra: 1, swy: 2, tfol: 1 } }
    ]},
    { q: "Which note draws you in?", options: [
      { label: "Citrus & bergamot", s: { sauv: 2, bdc: 2, h24: 1, erba: 1, swy: 1 } },
      { label: "Vanilla, amber & spice", s: { jpg: 2, fire: 2, ombra: 1, sauv: 1, tfol: 1 } },
      { label: "Vetiver, fig & green leaves", s: { wildv: 2, green: 2, then: 1 } },
      { label: "Leather, tea & musk", s: { anim: 2, osm: 2, then: 1, ombra: 1, tfol: 2 } }
    ]},
    { q: "Day or night?", options: [
      { label: "Daytime", s: { h24: 2, green: 2, woodn: 1, prada: 1, wildv: 1, erba: 1 } },
      { label: "After dark", s: { jpg: 2, anim: 2, ombra: 2, fire: 1, osm: 1, tfol: 2 } },
      { label: "Both, all the time", s: { bdc: 2, then: 2, sauv: 1, swy: 2, erba: 1, tfol: 1 } }
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
      btn.addEventListener("click", function () {
        answers[current] = parseInt(btn.dataset.i, 10);
        mount.querySelectorAll(".quiz-option").forEach(function (b) {
          b.classList.toggle("is-selected", b === btn);
        });
        setTimeout(function () { current++; render(); }, 240);
      });
    });

    var back = mount.querySelector(".quiz-back");
    if (back) back.addEventListener("click", function () {
      if (current > 0) { current--; render(); }
    });
  }

  function computeResult() {
    var totals = {};
    QUESTIONS.forEach(function (q, qi) {
      if (q.filter) return;
      var opt = q.options[answers[qi]];
      if (!opt || !opt.s) return;
      Object.keys(opt.s).forEach(function (k) { totals[k] = (totals[k] || 0) + opt.s[k]; });
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
    return entries;
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
          '<div class="result-price">from $' + win.from + ' <small>/ 2 ml</small></div>' +
          '<div class="result-actions">' +
            '<a class="btn" href="' + prod(win.slug) + '">Shop this decant</a>' +
            '<button type="button" class="btn btn--ghost" id="quiz-retake">Retake quiz</button>' +
          "</div>" +
          altHTML +
        "</div>" +
      "</div>";
    resultMount.hidden = false;

    var retake = document.getElementById("quiz-retake");
    if (retake) retake.addEventListener("click", function () {
      answers = [];
      current = 0;
      resultMount.hidden = true;
      resultMount.innerHTML = "";
      render();
      if (mount.scrollIntoView) mount.scrollIntoView({ block: "start" });
    });
  }

  render();
})();
