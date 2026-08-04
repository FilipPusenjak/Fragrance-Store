/* ============================================================
   Robot Fragrances — static build
   ------------------------------------------------------------
   Pre-renders one crawlable, shareable HTML page per product
   into /fragrance/<slug>.html, plus sitemap.xml and robots.txt.

   The product catalogue is the SAME one the browser uses
   (assets/js/main.js → window.RF_CATALOGUE); we load it here
   through a tiny DOM shim so there is a single source of truth.

   Generated pages are the no-JS baseline (full product content
   in static markup); assets/js/product.js then hydrates the
   size/quantity/add-to-cart controls on top.

   Usage:  node build.js
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* ------------------------------------------------------------
   SITE_URL — used for absolute canonical / Open Graph / sitemap
   URLs only. All in-page links stay relative, so the site keeps
   working at any path or domain; only these absolute URLs need
   to match where you actually deploy.

   TODO(owner): confirm this is your live URL. If you use a
   custom domain or a different repo path, change it here and in
   the <head> of the hand-written pages (search for this value).
   ------------------------------------------------------------ */
const SITE_URL = "https://robotfragrances.com";

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, "fragrance");

/* ---- Load the catalogue from main.js (single source) ------ */
function loadCatalogue() {
  const code = fs.readFileSync(path.join(ROOT, "assets/js/main.js"), "utf8");
  const sandbox = {
    window: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      readyState: "complete"
    },
    location: { search: "", hash: "", pathname: "/" },
    navigator: { userAgent: "node" }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const cat = sandbox.window.RF_CATALOGUE;
  if (!Array.isArray(cat) || !cat.length) {
    throw new Error("Could not read window.RF_CATALOGUE from assets/js/main.js");
  }
  return cat;
}

/* ---- Escaping --------------------------------------------- */
function esc(s) {
  return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
function escAttr(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* ---- Brand bottle/robot illustration (matches main.js) ---- */
const BOTTLE_SVG =
  '<svg class="bottle" viewBox="0 0 100 150" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="40" y="5" width="20" height="15" rx="2.5"/><path d="M44 20h12v8H44z"/>' +
  '<path d="M28 28h44a8 8 0 0 1 8 8v100a8 8 0 0 1-8 8H28a8 8 0 0 1-8-8V36a8 8 0 0 1 8-8z"/>' +
  '<circle cx="42" cy="66" r="3.4" fill="currentColor" stroke="none"/>' +
  '<circle cx="58" cy="66" r="3.4" fill="currentColor" stroke="none"/>' +
  '<path d="M42 80c3 3 13 3 16 0"/></svg>';

const LOGO_MARK =
  '<svg class="logo-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="8" width="12" height="13" rx="3"/><path d="M10 8V5.5h4V8"/><rect x="10.5" y="2.5" width="3" height="3" rx="0.6"/><circle cx="9.7" cy="13.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.3" cy="13.5" r="1.1" fill="currentColor" stroke="none"/><path d="M9.6 17.4h4.8"/></svg>';

/* ---- Shared chrome (base = "../" for /fragrance/ pages) ---- */
function headHTML(p, base) {
  const title = `${p.name} — ${p.label} decant | Robot Fragrances`;
  /* Sizes vary by tier — the priciest stop at 10 ml — so list what
     this product actually offers rather than a fixed set. */
  const sizeList = p.sizes
    .map(s => `${s.ml} ml`)
    .join(", ")
    .replace(/, ([^,]+)$/, " & $1");
  const desc = `${p.name} (${p.label}) — ${p.notes}. An authentic decant filled to the millilitre, in ${sizeList} from $${p.from}.`;
  const url = `${SITE_URL}/fragrance/${p.slug}.html`;
  const imageAbs = `${SITE_URL}/${p.image}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${escAttr(desc)}" />
  <link rel="canonical" href="${escAttr(url)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="Robot Fragrances" />
  <meta property="og:title" content="${escAttr(title)}" />
  <meta property="og:description" content="${escAttr(desc)}" />
  <meta property="og:url" content="${escAttr(url)}" />
  <meta property="og:image" content="${escAttr(imageAbs)}" />
  <meta property="og:image:alt" content="${escAttr(p.name + " fragrance decant")}" />
  <meta property="product:price:amount" content="${p.from}" />
  <meta property="product:price:currency" content="USD" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escAttr(title)}" />
  <meta name="twitter:description" content="${escAttr(desc)}" />
  <meta name="twitter:image" content="${escAttr(imageAbs)}" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500;600&display=swap" />
  <link rel="stylesheet" href="${base}assets/css/style.css" />
  <link rel="icon" href="${base}assets/img/favicon.svg" type="image/svg+xml" />
</head>
<body>`;
}

function headerHTML(base) {
  return `
  <!-- ======================= HEADER ======================= -->
  <header class="site-header">
    <div class="container nav">
      <a class="brand" href="${base}index.html" aria-label="Robot Fragrances home">
        ${LOGO_MARK}
        <span><b>Robot</b> Fragrances</span>
      </a>
      <nav class="nav-links" aria-label="Primary">
        <a href="${base}index.html">Home</a>
        <a href="${base}shop.html">Shop</a>
        <a href="${base}quiz.html">Scent Finder</a>
        <a href="${base}how-it-works.html">How It Works</a>
        <a href="${base}about.html">About</a>
        <a href="${base}contact.html">Contact</a>
      </nav>
      <div class="nav-actions">
        <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false"><span></span></button>
      </div>
    </div>
  </header>`;
}

function footerHTML(base) {
  return `
  <!-- ======================= FOOTER ======================= -->
  <footer class="site-footer">
    <div class="container">
      <div class="footer-top">
        <div class="footer-brand">
          <a class="brand" href="${base}index.html">${LOGO_MARK}<span><b>Robot</b> Fragrances</span></a>
          <p>Authentic designer &amp; niche fragrances, decanted into honest sizes. Discover more, commit when you're sure.</p>
        </div>
        <div class="footer-col"><h4>Shop</h4><ul><li><a href="${base}shop.html">All decants</a></li><li><a href="${base}quiz.html">Scent Finder</a></li><li><a href="${base}discovery.html">Discovery set</a></li><li><a href="${base}shop.html">Bestsellers</a></li></ul></div>
        <div class="footer-col"><h4>Learn</h4><ul><li><a href="${base}how-it-works.html">How it works</a></li><li><a href="${base}about.html">Our story</a></li><li><a href="${base}contact.html">FAQ</a></li><li><a href="${base}contact.html">Contact</a></li></ul></div>
        <div class="footer-col"><h4>Care</h4><ul><li><a href="${base}contact.html">Shipping</a></li><li><a href="${base}contact.html">Returns</a></li><li><a href="${base}contact.html">Authenticity</a></li><li><a href="${base}privacy.html">Privacy</a></li><li><a href="${base}terms.html">Terms</a></li></ul></div>
      </div>
      <div class="footer-bottom">
        <span>© <span data-year>2026</span> Robot Fragrances.</span>
        <div class="socials">
          <a href="https://www.instagram.com/robotfragrances/" target="_blank" rel="me noopener">Instagram</a>
          <a href="https://www.tiktok.com/@robotfragrances" target="_blank" rel="me noopener">TikTok</a>
          <a href="https://www.youtube.com/@robotfragrances" target="_blank" rel="me noopener">YouTube</a>
          <a href="${base}index.html#newsletter">Newsletter</a>
        </div>
      </div>
      <p class="footer-legal">
        Robot Fragrances is an independent decanting house. We are not affiliated with,
        authorised by, sponsored by, or endorsed by any of the brands whose fragrances we
        decant. All brand and fragrance names are the trademarks of their respective owners
        and are used only to identify what is inside the bottle we poured from.
      </p>
    </div>
  </footer>`;
}

/* ---- Product detail markup (mirrors assets/js/product.js) -- */
function specRows(p) {
  return [["Family", p.family], ["Best season", p.season], ["Occasion", p.occasion], ["Longevity", p.longevity]]
    .filter(s => s[1])
    .map(s => `<div class="pd-spec"><dt>${esc(s[0])}</dt><dd>${esc(s[1])}</dd></div>`)
    .join("");
}

function productDetailHTML(p, base) {
  const media = p.image
    ? `<img class="pd-photo" src="${base}${escAttr(p.image)}" alt="${escAttr(p.name)}">`
    : BOTTLE_SVG;
  const tag = p.tag ? `<span class="product-tag">${esc(p.tag)}</span>` : "";
  const specs = specRows(p);
  const sizeHTML = p.sizes.map((s, i) =>
    `<button type="button" class="size-opt${i === 0 ? " is-active" : ""}" data-ml="${s.ml}">${s.ml} ml <span>$${s.price}</span></button>`
  ).join("");

  return `<div class="container">
      <p class="breadcrumb"><a href="${base}index.html">Home</a> / <a href="${base}shop.html">Shop</a> / ${esc(p.name)}</p>
      <div class="pd-grid">
        <div class="pd-media${p.image ? " has-photo" : ""}">${tag}${media}</div>
        <div class="pd-info">
          <span class="product-house">${esc(p.label)}</span>
          <h1 class="pd-name">${esc(p.name)}</h1>
          <p class="pd-notes">${esc(p.notes)}</p>
          <p class="pd-desc">${esc(p.description)}</p>
          ${specs ? `<dl class="pd-specs">${specs}</dl>` : ""}
          <div class="pd-buy">
            <div class="pd-field"><span class="pd-label">Size</span><div class="size-options pd-sizes">${sizeHTML}</div></div>
            <div class="pd-row">
              <div class="pd-field" style="margin:0"><span class="pd-label">Quantity</span>
                <div class="qty pd-qty"><button type="button" class="qty-dec" aria-label="Decrease quantity">&minus;</button><span class="qty-val">1</span><button type="button" class="qty-inc" aria-label="Increase quantity">+</button></div>
              </div>
              <div class="pd-price-wrap"><span class="pd-label">Price</span><span class="pd-price">$${p.sizes[0].price}</span></div>
            </div>
            <button type="button" class="btn pd-add">Add to cart</button>
          </div>
          <ul class="pd-reassure">
            <li>Decanted from an authentic, batch-checked bottle</li>
            <li>Filled to the millilitre &amp; sealed in a travel atomiser</li>
            <li>Dispatched within 48 hours, free US shipping over $50</li>
          </ul>
          <p class="pd-legal">Robot Fragrances is an independent decanting house. This decant is
            poured from an authentic bottle bought at retail; we are not affiliated with,
            authorised by, or endorsed by the brand, and all names and trademarks are the
            property of their respective owners.</p>
        </div>
      </div>
    </div>`;
}

function relatedHTML(p, cat, base) {
  const related = cat.filter(x => x.group === p.group && x.slug !== p.slug).slice(0, 3);
  if (!related.length) return "";
  const cards = related.map(r => {
    const rmedia = r.image
      ? `<img class="product-photo" src="${base}${escAttr(r.image)}" alt="${escAttr(r.name)}" loading="lazy">`
      : BOTTLE_SVG;
    const href = `${r.slug}.html`;
    return `<article class="product-card">` +
      `<a class="product-thumb${r.image ? " has-photo" : ""}" href="${href}">${r.tag ? `<span class="product-tag">${esc(r.tag)}</span>` : ""}${rmedia}</a>` +
      `<div class="product-body">` +
        `<span class="product-house">${esc(r.label)}</span>` +
        `<h3 class="product-name"><a href="${href}">${esc(r.name)}</a></h3>` +
        `<p class="product-notes">${esc(r.notes)}</p>` +
        `<div class="product-foot"><span class="product-price">from $${r.from} <small>/ 2 ml</small></span><a class="link-arrow" href="${href}">View &rarr;</a></div>` +
      `</div>` +
    `</article>`;
  }).join("");
  return `<div class="container">
        <div class="section-head center"><span class="eyebrow">More to explore</span><h2>You might also like</h2></div>
        <div class="product-grid">${cards}</div>
      </div>`;
}

function productPage(p, cat) {
  const base = "../";
  return headHTML(p, base) +
    headerHTML(base) +
    `

  <main>
    <section class="section--tight" style="padding-top: clamp(2.5rem, 5vw, 3.5rem)">
      <div id="product-detail" data-slug="${escAttr(p.slug)}">${productDetailHTML(p, base)}</div>
    </section>
    <section class="section" id="product-related">${relatedHTML(p, cat, base)}</section>
  </main>
` +
    footerHTML(base) +
    `

  <script src="${base}assets/js/config.js"></script>
  <script src="${base}assets/js/main.js"></script>
  <script src="${base}assets/js/cart.js"></script>
  <script src="${base}assets/js/promos.js"></script>
  <script src="${base}assets/js/product.js"></script>
</body>
</html>
`;
}

/* ---- sitemap.xml + robots.txt ----------------------------- */
function buildSitemap(cat) {
  const staticPages = [
    "", "shop.html", "quiz.html", "how-it-works.html",
    "about.html", "contact.html", "discovery.html", "privacy.html", "terms.html"
  ];
  const today = new Date().toISOString().slice(0, 10);
  const urls = staticPages.map(pg => `${SITE_URL}/${pg}`)
    .concat(cat.map(p => `${SITE_URL}/fragrance/${p.slug}.html`));
  const body = urls.map(u =>
    `  <url><loc>${escAttr(u)}</loc><lastmod>${today}</lastmod></url>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function buildRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

/* ---- Run -------------------------------------------------- */
function main() {
  const cat = loadCatalogue();
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  cat.forEach(p => {
    fs.writeFileSync(path.join(OUT_DIR, `${p.slug}.html`), productPage(p, cat), "utf8");
  });
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), buildSitemap(cat), "utf8");
  fs.writeFileSync(path.join(ROOT, "robots.txt"), buildRobots(), "utf8");

  /* The checkout worker prices orders from its own copy of the
     catalogue. Regenerate it here so a price edited in main.js can
     never silently disagree with what customers are charged. */
  require("./scripts/gen-worker-catalogue.js");

  console.log(`Built ${cat.length} product pages → /fragrance/`);
  console.log("Wrote sitemap.xml and robots.txt");
  console.log(`SITE_URL = ${SITE_URL}  (change in build.js if your domain differs)`);
}

main();
