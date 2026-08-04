/* ============================================================
   Robot Fragrances — client/worker pricing parity
   ------------------------------------------------------------
   The storefront previews a total and the worker charges one. They
   are separate implementations of the same rules, and when they
   drifted the checkout page showed full price for a discounted set
   while Stripe charged less.

   This runs both over the same carts and asserts they agree to the
   cent. If it fails, the browser and the till disagree about money —
   fix that before anything else.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import worker from "../src/index.js";
import { CATALOGUE, SET_RULE } from "../src/catalogue.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/* ---- load the browser's pricing function ------------------ */
function loadClient() {
  const code = fs.readFileSync(path.join(ROOT, "assets/js/main.js"), "utf8");
  const sandbox = {
    window: {},
    document: {
      getElementById: () => null, querySelector: () => null,
      querySelectorAll: () => [], addEventListener: () => {}, readyState: "complete"
    },
    location: { search: "", hash: "", pathname: "/" },
    navigator: { userAgent: "node" }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window;
}
const CLIENT = loadClient();

/* ---- Stripe stub, capturing the charged amount ------------ */
let sent = null;
const realFetch = globalThis.fetch;
function stub() {
  globalThis.fetch = async (url, init) => {
    sent = String(init?.body || "");
    return new Response(JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.com/x" }),
      { status: 200, headers: { "Content-Type": "application/json" } });
  };
}
function restore() { globalThis.fetch = realFetch; sent = null; }

function chargedCents() {
  const p = new URLSearchParams(sent);
  let total = 0;
  for (let i = 0; p.get(`line_items[${i}][quantity]`) !== null; i++) {
    total += Number(p.get(`line_items[${i}][price_data][unit_amount]`)) *
             Number(p.get(`line_items[${i}][quantity]`));
  }
  return total;
}

async function workerCents(items) {
  stub();
  const res = await worker.fetch(new Request("https://api.example/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://robotfragrances.com" },
    body: JSON.stringify({ items })
  }), { STRIPE_SECRET_KEY: "sk_test_stub", SITE_URL: "https://robotfragrances.com" });
  const ok = res.status === 200;
  const cents = ok ? chargedCents() : null;
  restore();
  return cents;
}

function clientCents(items) {
  const r = CLIENT.RF_priceCart(items);
  return Math.round(r.subtotal * 100);
}

const SLUGS = Object.keys(CATALOGUE);
const withTester = SLUGS.filter((s) => CATALOGUE[s].sizes[String(SET_RULE.ml)]);

/* ---- the carts most likely to expose a divergence --------- */
const CASES = {
  "single item": [{ slug: "bleu-de-chanel", ml: 5, qty: 1 }],
  "mixed sizes": [
    { slug: "bleu-de-chanel", ml: 5, qty: 2 },
    { slug: "erba-pura", ml: 10, qty: 1 },
    { slug: "super-cedar", ml: 2, qty: 1 }
  ],
  "four testers (no set)": withTester.slice(0, 4).map((s) => ({ slug: s, ml: 2, qty: 1 })),
  "exactly one set": withTester.slice(0, 5).map((s) => ({ slug: s, ml: 2, qty: 1 })),
  "one set plus a spare": withTester.slice(0, 6).map((s) => ({ slug: s, ml: 2, qty: 1 })),
  "two full sets": withTester.slice(0, 10).map((s) => ({ slug: s, ml: 2, qty: 1 })),
  "every tester": withTester.map((s) => ({ slug: s, ml: 2, qty: 1 })),
  "set with quantities": withTester.slice(0, 5).map((s) => ({ slug: s, ml: 2, qty: 3 })),
  "set plus larger sizes": [
    ...withTester.slice(0, 5).map((s) => ({ slug: s, ml: 2, qty: 1 })),
    { slug: "erba-pura", ml: 30, qty: 1 },
    { slug: "bleu-de-chanel", ml: 10, qty: 2 }
  ],
  "duplicate rows merge": [
    { slug: "bleu-de-chanel", ml: 2, qty: 1 },
    { slug: "bleu-de-chanel", ml: 2, qty: 2 },
    ...withTester.slice(1, 5).map((s) => ({ slug: s, ml: 2, qty: 1 }))
  ]
};

for (const [name, items] of Object.entries(CASES)) {
  test(`parity — ${name}`, async () => {
    const w = await workerCents(items);
    const c = clientCents(items);
    assert.notEqual(w, null, "worker rejected a cart the client priced");
    assert.equal(c, w, `client previews ${c}c but worker charges ${w}c`);
  });
}

test("parity — 200 random carts", async () => {
  /* Deterministic pseudo-random so a failure is reproducible. */
  let seed = 20260803;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

  for (let n = 0; n < 200; n++) {
    const count = 1 + Math.floor(rnd() * 8);
    const items = [];
    for (let i = 0; i < count; i++) {
      const slug = SLUGS[Math.floor(rnd() * SLUGS.length)];
      const mls = Object.keys(CATALOGUE[slug].sizes);
      const ml = Number(mls[Math.floor(rnd() * mls.length)]);
      items.push({ slug, ml, qty: 1 + Math.floor(rnd() * 3) });
    }
    const w = await workerCents(items);
    const c = clientCents(items);
    assert.equal(c, w, `cart ${JSON.stringify(items)} → client ${c}c vs worker ${w}c`);
  }
});

test("the discount is capped at complete sets", async () => {
  const all = withTester.map((s) => ({ slug: s, ml: 2, qty: 1 }));
  const full = all.reduce((n, i) => n + CATALOGUE[i.slug].sizes["2"], 0);
  const charged = await workerCents(all);
  const sets = Math.floor(all.length / SET_RULE.min);

  assert.ok(sets >= 1, "test needs enough testers to form a set");
  assert.ok(charged > full * (1 - SET_RULE.discount),
    "a whole-range cart must NOT get a blanket discount");
  assert.ok(charged < full, "but complete sets within it should still discount");

  /* Exactly sets*min items discounted, most expensive first. */
  const prices = all.map((i) => CATALOGUE[i.slug].sizes["2"]).sort((a, b) => b - a);
  const expected = prices.reduce((n, p, idx) =>
    n + (idx < sets * SET_RULE.min ? Math.round(p * (1 - SET_RULE.discount)) : p), 0);
  assert.equal(charged, expected);
});
