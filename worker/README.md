# Robot Fragrances — checkout worker

A single Cloudflare Worker that turns a cart into a Stripe Checkout Session.
The storefront stays on GitHub Pages; this is the only part that needs a server.

```
browser  ──POST /api/checkout──▶  worker  ──▶  Stripe
   ▲                                │
   └────── url / clientSecret ──────┘
```

## Why a worker at all

A static site can't hold a secret and can't be trusted with prices. Anyone can
edit `localStorage` and tell the page a 30 ml Bleu de Chanel costs $1. The worker
prices every order from its **own** copy of the catalogue (`src/catalogue.js`) and
ignores anything the browser claims about money. That check is the whole job.

## Setup

Four steps, about ten minutes.

### 1. Install

```bash
npm install          # from the REPO ROOT, not worker/
```

`wrangler.toml` lives at the repo root even though the source is in `worker/`.
That is deliberate — see the comment at the top of that file. Leave **Root
directory** empty in the Workers Builds settings.

### 2. Add your Stripe secret key

Never put this in a file that gets committed.

```bash
npx wrangler secret put STRIPE_SECRET_KEY
# paste sk_test_... (or sk_live_... when you're ready to take real money)
```

For local development instead, copy `.dev.vars.example` to `.dev.vars` and put a
**test** key there. That file is gitignored.

### 3. Deploy

The worker is connected to this repo through **Workers Builds**, so a push to
the production branch builds and deploys it automatically — same model as the
GitHub Pages site. Normally there is nothing to run.

To deploy by hand (first-time setup, or when Builds is unavailable):

```bash
npm run deploy
```

Wrangler prints a URL like `https://robot-fragrances-checkout.<you>.workers.dev`.

### 4. Point the site at it

In `../assets/js/config.js`:

```js
checkoutApi: "https://robot-fragrances-checkout.<you>.workers.dev",
```

Commit and push. Checkout is live.

Sanity check any time:

```bash
curl https://robot-fragrances-checkout.<you>.workers.dev/api/health
# {"ok":true,"stripeConfigured":true,"liveMode":false,"products":16,...}
```

## Switching to in-app checkout

The worker already supports it — `ui_mode: 'embedded'` is implemented and tested.
When you want the payment form inside `robotfragrances.com` instead of on Stripe's
page, set two values in `assets/js/config.js`:

```js
checkoutMode: "embedded",
publishableKey: "pk_live_...",   // safe to commit; this one is public
```

That's the entire migration. No worker changes, no redeploy.

Worth knowing before you flip it:

- **Hosted** is less work for you and carries Stripe's own trust signals. Stripe
  maintains the page, handles new payment methods, and stays PCI compliant.
- **Embedded** keeps the customer on your domain, which usually converts a little
  better. You own the surrounding page, so layout and mobile testing are yours.
- Either way Stripe hosts the actual card fields in an iframe, so card numbers
  never touch your code and your PCI scope stays minimal.

## Local development

```bash
npm run dev            # worker on http://localhost:8787
```

Then, from the repo root in another terminal:

```bash
python3 -m http.server 8000
```

Set `checkoutApi: "http://localhost:8787"` in `assets/js/config.js` (localhost is
already in the worker's CORS allowlist), and open
`http://localhost:8000/checkout.html`.

Test card `4242 4242 4242 4242`, any future expiry, any CVC.

**Remember to change `checkoutApi` back to the deployed URL before pushing.**

## Tests

```bash
npm test
```

30 tests, no network and no Stripe key needed — the Stripe API is stubbed and the
tests assert on the exact amounts the worker *would* have charged. Covers:

- prices come from the catalogue even when the client sends its own
- all 59 product/size combinations charge the right amount
- duplicate cart rows merge, so the 99-per-line cap can't be bypassed
- unknown products and invalid sizes are rejected
- the free-shipping threshold applies at the right subtotal
- hosted vs embedded return the right shape and don't leak each other's fields
- CORS doesn't echo unknown origins
- internal Stripe errors don't leak to the response

## Keeping prices in sync

`src/catalogue.js` is **generated**. Never edit it by hand.

Prices live in `assets/js/main.js` (`window.RF_CATALOGUE`). After changing one:

```bash
node build.js          # from the repo root; regenerates everything
git add -A && git commit && git push
```

`build.js` regenerates the worker catalogue automatically, so the site and the
worker can't disagree about what something costs. Workers Builds then redeploys
the worker on push, so both halves move together.

Note the two halves deploy on different systems — GitHub Pages serves the site,
Workers Builds deploys the worker. A push updates both, but not at the same
instant. Expect a minute or so where the page and the charge could disagree
about a price you just changed.

## Configuration

| Name | Where | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | `wrangler secret` or dashboard | **Secret.** Server-side Stripe auth. Stored on the worker, so it survives redeploys and is never part of a build. |
| `SITE_URL` | `wrangler.toml` (repo root) | Success/cancel/return URLs and CORS. |
| `ALLOWED_ORIGINS` | `wrangler.toml` (repo root) | Optional extra origins, comma-separated. |

`SITE_URL`, its `www.` variant and localhost are always allowed, so most setups
never need `ALLOWED_ORIGINS`.

## Shipping scope

`SHIP_TO` in `worker/src/index.js` lists the countries Stripe will accept an address
for. It is currently `["US"]`.

Adding a country means **two** changes, not one: add it to `SHIP_TO` *and* give
it a rate in `shippingOption()`. A country added to the list without its own
rate ships at the domestic price, which is the mistake the list exists to
prevent — small-parcel international runs $15-25 against a $5 domestic rate.

The customer-facing copy also says US-only in several places (`contact.html`,
`terms.html`, `assets/js/checkout.js`, `assets/js/product.js`, `build.js`), so
widening the list means updating those too.

## Not built yet

- **Webhooks.** Stripe emails receipts and the dashboard shows every order, which
  is enough to start. Add a `/api/webhook` route with signature verification when
  you want order records of your own or automated fulfilment email.
- **Stripe Tax.** Add `automatic_tax[enabled]=true` in `handleCheckout` once
  you've registered tax settings in the dashboard.
- **Inventory.** Nothing tracks stock; a decant can be oversold.
