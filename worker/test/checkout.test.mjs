/* ============================================================
   Robot Fragrances — checkout worker tests
   ------------------------------------------------------------
   Runs the real worker with the Stripe API stubbed out, so the
   pricing and validation logic is exercised without a key, a
   network call, or a live account.

   Usage:  node --test worker/test/
           (or: node worker/test/checkout.test.mjs)
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";

import worker from "../src/index.js";
import { CATALOGUE, FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT_RATE } from "../src/catalogue.js";

const ENV = { STRIPE_SECRET_KEY: "sk_test_stub", SITE_URL: "https://robotfragrances.com" };
const ORIGIN = "https://robotfragrances.com";

/* ---- Stripe stub ----------------------------------------- */
/* Captures the form body the worker sends so tests can assert on
   the exact amounts that would have been charged. */
let lastStripeCall = null;
const realFetch = globalThis.fetch;

function stubStripe({ fail = false } = {}) {
  globalThis.fetch = async (url, init) => {
    lastStripeCall = { url: String(url), body: init?.body || "", headers: init?.headers || {} };
    if (fail) {
      return new Response(JSON.stringify({ error: { message: "stubbed failure" } }),
        { status: 402, headers: { "Content-Type": "application/json" } });
    }
    if (String(url).includes("/checkout/sessions/")) {
      return new Response(JSON.stringify({
        id: "cs_test_123", status: "complete", payment_status: "paid",
        customer_details: { email: "buyer@example.com" },
        amount_total: 2900, currency: "usd", livemode: false
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
      client_secret: "cs_test_123_secret_abc"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}
function restore() { globalThis.fetch = realFetch; lastStripeCall = null; }

/* ---- helpers --------------------------------------------- */
function post(body, origin = ORIGIN) {
  return new Request("https://api.example/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body)
  });
}

/* Decode the form-encoded body Stripe would have received. */
function sent() {
  const params = new URLSearchParams(lastStripeCall.body);
  const out = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

/* Sum of unit_amount * quantity across all line items. */
function chargedSubtotal() {
  const p = sent();
  let total = 0, i = 0;
  while (p[`line_items[${i}][price_data][unit_amount]`] !== undefined) {
    total += Number(p[`line_items[${i}][price_data][unit_amount]`]) *
             Number(p[`line_items[${i}][quantity]`]);
    i++;
  }
  return total;
}
function lineCount() {
  const p = sent();
  let i = 0;
  while (p[`line_items[${i}][quantity]`] !== undefined) i++;
  return i;
}

/* ============================================================
   Pricing — the security-critical part
   ============================================================ */

test("prices from the server catalogue, ignoring the client", async () => {
  stubStripe();
  // Bleu de Chanel 5 ml is $13 -> 1300 cents. Client claims it's $1.
  const res = await worker.fetch(post({
    items: [{ slug: "bleu-de-chanel", ml: 5, qty: 1, price: 1, unit_amount: 100 }]
  }), ENV);
  assert.equal(res.status, 200);
  assert.equal(chargedSubtotal(), 1300, "must charge catalogue price, not client price");
  restore();
});

test("computes multi-item subtotals correctly", async () => {
  stubStripe();
  // 2 x Bleu de Chanel 5ml (1300) + 1 x Erba Pura 10ml (3000) = 5600
  await worker.fetch(post({
    items: [
      { slug: "bleu-de-chanel", ml: 5, qty: 2 },
      { slug: "erba-pura", ml: 10, qty: 1 }
    ]
  }), ENV);
  assert.equal(chargedSubtotal(), 2 * 1300 + 3000);
  assert.equal(lineCount(), 2);
  restore();
});

test("merges duplicate rows so the qty cap can't be bypassed", async () => {
  stubStripe();
  const items = Array.from({ length: 5 }, () => ({ slug: "bleu-de-chanel", ml: 5, qty: 50 }));
  await worker.fetch(post({ items }), ENV);
  assert.equal(lineCount(), 1, "duplicates should collapse to one line");
  assert.equal(chargedSubtotal(), 99 * 1300, "quantity must clamp to 99");
  restore();
});

test("every catalogue product/size can be ordered", async () => {
  stubStripe();
  for (const [slug, product] of Object.entries(CATALOGUE)) {
    for (const ml of Object.keys(product.sizes)) {
      const res = await worker.fetch(post({ items: [{ slug, ml: Number(ml), qty: 1 }] }), ENV);
      assert.equal(res.status, 200, `${slug} ${ml}ml should be orderable`);
      assert.equal(chargedSubtotal(), product.sizes[ml], `${slug} ${ml}ml wrong price`);
    }
  }
  restore();
});

/* ============================================================
   Stripe Product linking
   ============================================================ */

test("describes the product inline when no Stripe ID is mapped", async () => {
  stubStripe();
  await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 5, qty: 1 }] }), ENV);
  const p = sent();
  assert.equal(p["line_items[0][price_data][product]"], undefined);
  assert.match(p["line_items[0][price_data][product_data][name]"], /Bleu de Chanel — 5 ml decant/);
  restore();
});

test("a mapped slug references the Stripe Product instead", async () => {
  const { PRODUCT_IDS } = await import("../src/product-ids.js");
  const original = PRODUCT_IDS["bleu-de-chanel"];
  PRODUCT_IDS["bleu-de-chanel"] = "prod_TEST123";
  stubStripe();
  await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 5, qty: 1 }] }), ENV);
  const p = sent();
  assert.equal(p["line_items[0][price_data][product]"], "prod_TEST123");
  assert.equal(p["line_items[0][price_data][product_data][name]"], undefined,
    "Stripe rejects product and product_data together");
  assert.equal(p["line_items[0][price_data][unit_amount]"], "1300",
    "linking a Product must not hand pricing to Stripe");
  PRODUCT_IDS["bleu-de-chanel"] = original;
  restore();
});

test("a partial map mixes linked and inline items in one order", async () => {
  const { PRODUCT_IDS } = await import("../src/product-ids.js");
  const original = PRODUCT_IDS["bleu-de-chanel"];
  PRODUCT_IDS["bleu-de-chanel"] = "prod_TEST123";
  stubStripe();
  await worker.fetch(post({
    items: [
      { slug: "bleu-de-chanel", ml: 5, qty: 1 },
      { slug: "erba-pura", ml: 10, qty: 1 }
    ]
  }), ENV);
  const p = sent();
  assert.equal(p["line_items[0][price_data][product]"], "prod_TEST123");
  assert.ok(p["line_items[1][price_data][product_data][name]"], "unmapped slug still works");
  assert.equal(chargedSubtotal(), 1300 + 3000);
  PRODUCT_IDS["bleu-de-chanel"] = original;
  restore();
});

test("metadata carries a readable packing list with sizes", async () => {
  stubStripe();
  await worker.fetch(post({
    items: [
      { slug: "bleu-de-chanel", ml: 5, qty: 2 },
      { slug: "erba-pura", ml: 10, qty: 1 }
    ]
  }), ENV);
  const p = sent();
  assert.match(p["metadata[items]"], /2x Bleu de Chanel 5ml/);
  assert.match(p["metadata[items]"], /1x Erba Pura 10ml/);
  assert.equal(p["metadata[cart]"], "bleu-de-chanel:5:2,erba-pura:10:1");
  restore();
});

test("every catalogue slug has an entry in the product-id map", async () => {
  const { PRODUCT_IDS } = await import("../src/product-ids.js");
  const missing = Object.keys(CATALOGUE).filter((s) => !(s in PRODUCT_IDS));
  assert.deepEqual(missing, [], "product-ids.js is missing catalogue slugs");
  const extra = Object.keys(PRODUCT_IDS).filter((s) => !(s in CATALOGUE));
  assert.deepEqual(extra, [], "product-ids.js has slugs not in the catalogue");
});

/* ============================================================
   Validation
   ============================================================ */

test("rejects an empty cart", async () => {
  stubStripe();
  const res = await worker.fetch(post({ items: [] }), ENV);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /empty/i);
  restore();
});

test("rejects an unknown product", async () => {
  stubStripe();
  const res = await worker.fetch(post({ items: [{ slug: "not-a-scent", ml: 5, qty: 1 }] }), ENV);
  assert.equal(res.status, 400);
  restore();
});

test("rejects a size the product doesn't come in", async () => {
  stubStripe();
  // cityExclusive tier (Osmanthus 19) has no 30 ml.
  const res = await worker.fetch(post({
    items: [{ slug: "le-labo-osmanthus-19", ml: 30, qty: 1 }]
  }), ENV);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /30 ml/);
  restore();
});

test("rejects negative and zero quantities by flooring to 1", async () => {
  stubStripe();
  await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 5, qty: -10 }] }), ENV);
  assert.equal(chargedSubtotal(), 1300);
  restore();
});

test("rejects malformed JSON", async () => {
  stubStripe();
  const req = new Request("https://api.example/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: "{ not json"
  });
  assert.equal((await worker.fetch(req, ENV)).status, 400);
  restore();
});

test("returns 503 when no Stripe key is configured", async () => {
  stubStripe();
  const res = await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 5, qty: 1 }] }), { SITE_URL: ENV.SITE_URL });
  assert.equal(res.status, 503);
  restore();
});

test("surfaces a Stripe outage as 502 without leaking details", async () => {
  stubStripe({ fail: true });
  const res = await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 5, qty: 1 }] }), ENV);
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.doesNotMatch(JSON.stringify(body), /stubbed failure/, "internal errors must not leak");
  restore();
});

/* ============================================================
   Shipping
   ============================================================ */

test("charges flat shipping below the free threshold", async () => {
  stubStripe();
  await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 2, qty: 1 }] }), ENV); // 600
  const p = sent();
  assert.ok(chargedSubtotal() < FREE_SHIPPING_THRESHOLD);
  assert.equal(p["shipping_options[0][shipping_rate_data][fixed_amount][amount]"], String(SHIPPING_FLAT_RATE));
  restore();
});

test("gives free shipping at or above the threshold", async () => {
  stubStripe();
  await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 30, qty: 1 }] }), ENV); // 6500
  const p = sent();
  assert.ok(chargedSubtotal() >= FREE_SHIPPING_THRESHOLD);
  assert.equal(p["shipping_options[0][shipping_rate_data][fixed_amount][amount]"], "0");
  assert.equal(p["shipping_options[0][shipping_rate_data][display_name]"], "Free shipping");
  restore();
});

/* ============================================================
   Shipping destinations
   ============================================================ */

test("only accepts US shipping addresses", async () => {
  stubStripe();
  await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 5, qty: 1 }] }), ENV);
  const p = sent();
  assert.equal(p["shipping_address_collection[allowed_countries][0]"], "US");
  assert.equal(p["shipping_address_collection[allowed_countries][1]"], undefined,
    "a second country needs its own shipping rate before it can be listed");
  restore();
});

/* ============================================================
   UI modes — the in-app checkout path
   ============================================================ */

test("hosted mode returns a redirect url", async () => {
  stubStripe();
  const res = await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 5, qty: 1 }], mode: "hosted" }), ENV);
  const body = await res.json();
  assert.equal(body.mode, "hosted");
  assert.ok(body.url.startsWith("https://checkout.stripe.com/"));
  assert.equal(body.clientSecret, undefined, "hosted must not leak a client secret");
  const p = sent();
  assert.equal(p["ui_mode"], undefined);
  assert.ok(p["success_url"].includes("order-confirmed.html"));
  restore();
});

test("embedded mode returns a client secret and sets ui_mode", async () => {
  stubStripe();
  const res = await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 5, qty: 1 }], mode: "embedded" }), ENV);
  const body = await res.json();
  assert.equal(body.mode, "embedded");
  assert.equal(body.clientSecret, "cs_test_123_secret_abc");
  assert.equal(body.url, undefined);
  const p = sent();
  assert.equal(p["ui_mode"], "embedded");
  assert.ok(p["return_url"].includes("order-confirmed.html"));
  restore();
});

test("an unrecognised mode falls back to hosted", async () => {
  stubStripe();
  const res = await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 5, qty: 1 }], mode: "wat" }), ENV);
  assert.equal((await res.json()).mode, "hosted");
  restore();
});

/* ============================================================
   CORS + routing
   ============================================================ */

test("allows the live site origin", async () => {
  stubStripe();
  const res = await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 5, qty: 1 }] }), ENV);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  restore();
});

test("does not echo an unknown origin", async () => {
  stubStripe();
  const res = await worker.fetch(post({ items: [{ slug: "bleu-de-chanel", ml: 5, qty: 1 }] }, "https://evil.example"), ENV);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
  restore();
});

test("answers preflight", async () => {
  const res = await worker.fetch(new Request("https://api.example/api/checkout", {
    method: "OPTIONS", headers: { Origin: ORIGIN }
  }), ENV);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});

test("session lookup returns only safe fields", async () => {
  stubStripe();
  const res = await worker.fetch(new Request("https://api.example/api/session?id=cs_test_123", {
    headers: { Origin: ORIGIN }
  }), ENV);
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(),
    ["amountTotal", "currency", "email", "paymentStatus", "status"]);
  restore();
});

test("session lookup rejects a malformed id", async () => {
  stubStripe();
  const res = await worker.fetch(new Request("https://api.example/api/session?id=../../secrets", {
    headers: { Origin: ORIGIN }
  }), ENV);
  assert.equal(res.status, 400);
  restore();
});

test("health reports configuration without exposing the key", async () => {
  const res = await worker.fetch(new Request("https://api.example/api/health", {
    headers: { Origin: ORIGIN }
  }), ENV);
  const body = await res.json();
  assert.equal(body.stripeConfigured, true);
  assert.equal(body.liveMode, false);
  assert.equal(body.products, Object.keys(CATALOGUE).length);
  assert.doesNotMatch(JSON.stringify(body), /sk_test_stub/);
});

test("unknown routes 404", async () => {
  const res = await worker.fetch(new Request("https://api.example/nope", { headers: { Origin: ORIGIN } }), ENV);
  assert.equal(res.status, 404);
});
