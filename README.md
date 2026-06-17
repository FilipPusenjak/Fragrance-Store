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
| **Shop** | `shop.html` | Catalogue-driven product grid with collection filters and a per-card size selector (live pricing), discovery-set call-to-action |
| **How It Works** | `how-it-works.html` | 3-step decanting process, size guide, authenticity stats, mini-FAQ |
| **About** | `about.html` | Brand story, core values, mission quote |
| **Contact** | `contact.html` | Contact form, direct details, full FAQ |

Shared across every page: a sticky translucent header with active-page nav, a
mobile menu, and a dark footer.

## Structure

```
.
├── index.html
├── shop.html
├── how-it-works.html
├── about.html
├── contact.html
└── assets/
    ├── css/
    │   └── style.css     # design tokens + all components
    └── js/
        └── main.js        # mobile nav, scroll reveal, shop filter, demo forms
```

## Running it

It's a static site — no build step. Open `index.html` directly, or serve the
folder for clean routing:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

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
EDP, JPG Le Male Le Parfum, By the Fireplace, Erba Pura, PDM Greenley, Le Labo
Thé Noir 29, Le Labo Osmanthus 19, Byredo Animalique, and more.

## Notes

- Forms (newsletter, contact), the size selector, and the "Add decant" buttons
  are front-end demos with no backend — wire them to your platform of choice to
  go live.
- The shop grid is rendered from the catalogue at runtime; a `<noscript>`
  fallback summarises pricing if JavaScript is disabled. All other pages are
  fully readable without JS, and animations respect `prefers-reduced-motion`.
