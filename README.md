# Robot Fragrances

A classy, minimal storefront for a **fragrance decanting shop** — built as a
fast, dependency-free static site. Robot Fragrances pours authentic designer
and niche perfumes into small, affordable decants (2 ml / 5 ml / 10 ml / 30 ml)
so customers can live with a scent before committing to a full bottle.

## Design

- **Aesthetic** — warm ivory background, charcoal ink, a single antique-brass
  accent. Generous whitespace, hairline rules, subtle hover motion.
- **Type** — [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond)
  for elegant serif headings, paired with [Jost](https://fonts.google.com/specimen/Jost),
  a clean geometric sans that nods to the "Robot" name. Loaded from Google Fonts
  with system-font fallbacks.
- **Logo** — an inline SVG that reads as both a perfume bottle and a friendly
  robot face (two dot "eyes" and a smile).

## Site outline

| Page | File | What's on it |
|------|------|--------------|
| **Home** | `index.html` | Hero, brand promise, feature strip, featured collection, "why decant" editorial, customer quote, newsletter sign-up |
| **Shop** | `shop.html` | Catalogue-driven product grid with collection filters and a per-card size selector (live pricing); cards link through to the detail page |
| **Product** | `product.html?id=<slug>` | Detail page per fragrance: large image, description, specs, size + quantity selector, add-to-cart, and related scents |
| **Checkout** | `checkout.html` | Order summary (from the cart) + real Stripe payment via the checkout worker |
| **Order confirmed** | `order-confirmed.html` | Where Stripe returns the shopper; verifies the session before confirming anything |
| **Scent Finder** | `quiz.html` | An 8-question quiz that recommends one decant (plus two alternates) and links to its product page |
| **How It Works** | `how-it-works.html` | 3-step decanting process, size guide, authenticity stats, mini-FAQ |
| **About** | `about.html` | Brand story, core values, mission quote |
| **Contact** | `contact.html` | Contact form, direct details, full FAQ |

Shared across every page: a sticky translucent header with active-page nav, a
mobile menu, a **cart button + slide-out drawer**, and a dark footer.

## Structure

```
.
├── index.html
├── shop.html
├── product.html         # legacy ?id= shell (noindex); static pages below are canonical
├── checkout.html
├── quiz.html
├── how-it-works.html
├── about.html
├── contact.html
├── privacy.html
├── terms.html
├── build.js             # generates the files below from the catalogue (node build.js)
├── sitemap.xml          # generated
├── robots.txt           # generated
├── fragrance/           # generated: one static, pre-rendered page per product
│   └── <slug>.html
└── assets/
    ├── css/
    │   └── style.css     # design tokens + all components
    ├── img/
    │   ├── favicon.svg        # brand mark (favicon)
    │   ├── og-cover.png       # default social share image (1200×630)
    │   └── <slug>.webp        # one product photo per fragrance
    └── js/
        ├── config.js     # PUBLIC front-end config (worker URL, checkout mode)
        ├── main.js       # catalogue (data) + shop render, nav, reveal, filter
        ├── cart.js       # localStorage cart + header button/badge + slide-out drawer
        ├── product.js    # product detail page (size/qty, add-to-cart, related)
        ├── checkout.js   # order summary + Stripe handoff (hosted or embedded)
        ├── confirm.js    # verifies the Stripe session on the return page
        └── quiz.js       # Scent Finder quiz (scoring + result)
```

Payments live in two extra places:

```
├── worker/              # Cloudflare Worker — cart -> Stripe Checkout Session
│   ├── src/index.js     # the API (see worker/README.md)
│   ├── src/catalogue.js # GENERATED server-side price table
│   └── test/            # 23 tests, no Stripe key needed
└── scripts/
    └── gen-worker-catalogue.js   # main.js prices -> worker/src/catalogue.js
```

`main.js` is the single source of truth: it exposes `window.RF_CATALOGUE`
(each entry has `slug`, `sizes`, `from`, notes, a long-form `description`
and specs), plus helpers `window.RF_get(slug)` and `window.RF_BOTTLE`. The
shop, product pages, quiz and cart all read from it, so pricing and details
never drift. A catalogue entry may include an optional `image` (e.g. Erba
Pura, PDM Greenley); otherwise the inline bottle illustration is used.

**Cart & checkout** (`cart.js`): the cart lives in `localStorage`
(`rf_cart`) and is available on every page via the header bag icon and a
slide-out drawer. `window.RFCart` exposes `add / setQty / remove / clear /
items / count / subtotal`, and a `rfcart:change` event keeps the badge,
drawer and checkout summary in sync. Extras:

- **Shareable cart in the URL** — the cart is mirrored to a `?cart=` query
  param (`slug:ml:qty,…`); opening a link with that param restores the
  cart (validated against the catalogue), so quantities persist in the URL.
- **Decant of the month** — the drawer shows a rotating upsell that changes
  each month (deterministic by month), hidden once that scent is in the cart.

## Payments

Checkout is real. `checkout.html` posts the cart to a small **Cloudflare Worker**
(`/worker`), which creates a Stripe Checkout Session and hands back either a
redirect URL or an embedded client secret. The site itself stays static on GitHub
Pages — the worker is the only server-side piece.

**The prices shown on the page are a preview.** The worker prices every order from
its own copy of the catalogue and ignores anything the browser says about money,
so an edited `localStorage` cart can't change what gets charged.

Two modes, switched with one line in `assets/js/config.js`:

| `checkoutMode` | What the shopper sees | Needs |
|---|---|---|
| `"hosted"` (default) | Redirect to Stripe's page, then back to `order-confirmed.html` | nothing extra |
| `"embedded"` | Payment form inside `checkout.html` — never leaves the domain | `publishableKey` |

Both are implemented and tested; moving to in-app checkout is a config change, not
a rewrite. Setup, deploy, and local dev are in **[`worker/README.md`](worker/README.md)**.

Until `checkoutApi` is set in `assets/js/config.js`, the checkout page says so
plainly and points shoppers at email rather than failing silently.

Shipping is free over $50, otherwise a $5 flat rate — enforced by the worker, not
just displayed.

The homepage "dispatch" newsletter now promises new decants **monthly**.

## Running it

It's a static site. One small Node build pre-renders a crawlable,
shareable HTML page per product (`fragrance/<slug>.html`) plus
`sitemap.xml` and `robots.txt`. Re-run it whenever the catalogue in
`assets/js/main.js` changes:

```bash
node build.js          # regenerate fragrance/*.html, sitemap.xml, robots.txt
```

Then open `index.html` directly, or serve the folder for clean routing:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

> **Deploy note:** absolute URLs (canonical / Open Graph / sitemap) use
> `SITE_URL` in `build.js` and the `<head>` of the hand-written pages.
> Confirm it matches your live URL (custom domain or repo path) before
> deploying — search for the current value to change it.

## Catalogue & pricing

The shop is driven by a single catalogue in `assets/js/main.js` (`PRODUCTS` +
`TIERS`). To add, remove, or re-price a fragrance, edit those two structures —
the grid, filters, and size selector update automatically.

Prices are per decant size (USD):

| Pricing tier | 2 ml | 5 ml | 10 ml | 30 ml |
|--------------|-----:|-----:|------:|------:|
| Designer | $4 | $9 | $17 | $45 |
| Premium designer | $6 | $13 | $25 | $65 |
| Niche | $8 | $17 | $30 | $85 |
| Rare niche | $15 | $32 | $60 | $160 |
| Le Labo & Byredo | $12 | $30 | $55 | $150 |
| Le Labo City Exclusive | $20 | $45 | $80 | — |

The storefront has two shoppable collections — **Designer** and **Niche**.
Le Labo, Byredo and the Le Labo City Exclusive are shelved under **Niche**
while keeping their own pricing tiers above.

Current scents include Hermès H24, Prada L'Homme, Bleu de Chanel, Dior Sauvage
EDP, JPG Le Male Le Parfum, By the Fireplace, Erba Pura, PDM Greenley, Tom Ford
Ombré Leather, Le Labo Thé Noir 29, Le Labo Osmanthus 19, Byredo Animalique, and
more.

## Notes

- The newsletter and contact forms still need an endpoint — replace
  `FORM_ENDPOINT_TODO` in `index.html` and `contact.html` with a Formspree (or
  similar) URL. Checkout is live and does not need this.
- Prices live in `assets/js/main.js`. After changing one, run `node build.js`
  (which regenerates the worker's price table too) and redeploy the worker,
  otherwise the site and the charge will disagree.
- The shop grid is rendered from the catalogue at runtime; a `<noscript>`
  fallback summarises pricing if JavaScript is disabled. All other pages are
  fully readable without JS, and animations respect `prefers-reduced-motion`.
