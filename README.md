# Robot Fragrances

A classy, minimal storefront for a **fragrance decanting shop** — built as a
fast, dependency-free static site. Robot Fragrances pours authentic designer
and niche perfumes into small, affordable decants (2 ml / 5 ml / 10 ml) so
customers can live with a scent before committing to a full bottle.

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
| **Shop** | `shop.html` | Filterable product grid (by fragrance family), nine decants, discovery-set call-to-action |
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

## Notes

- The fragrances, houses, and prices are **fictional placeholders** for the
  demo. Swap in real products as needed.
- Forms (newsletter, contact) and the "Add decant" buttons are front-end demos
  with no backend — wire them to your platform of choice to go live.
- JavaScript is progressive enhancement only; the site is fully readable
  without it, and animations respect `prefers-reduced-motion`.
