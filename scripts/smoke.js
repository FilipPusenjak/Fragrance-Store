/* ============================================================
   Robot Fragrances — deployed-worker smoke check
   ------------------------------------------------------------
   Hits the live worker and asserts it is actually the checkout API
   doing its job, not merely "responding".

   Written after a bad build replaced the API with the storefront:
   every URL still returned 200, so nothing looked wrong until
   someone tried to buy something. Availability is not correctness.

   Usage:
     node scripts/smoke.js                    # URL from config.js
     node scripts/smoke.js <worker-url>
     node scripts/smoke.js --expect-version <sha>

   Exits non-zero if anything fails, so it can gate a deploy.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const expectIdx = args.indexOf("--expect-version");
const expectVersion = expectIdx !== -1 ? args[expectIdx + 1] : null;
const urlArg = args.find((a) => a.startsWith("http"));

function apiFromConfig() {
  const src = fs.readFileSync(path.join(ROOT, "assets/js/config.js"), "utf8");
  const m = src.match(/checkoutApi:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

const API = (urlArg || apiFromConfig() || "").replace(/\/$/, "");
if (!API) {
  console.error("No worker URL. Pass one, or set checkoutApi in assets/js/config.js.");
  process.exit(2);
}

const ORIGIN = "https://robotfragrances.com";
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? "  → " + detail : ""}`); }
}

async function main() {
  console.log(`\nSmoke-testing ${API}\n`);

  /* ---- health ------------------------------------------- */
  let health;
  try {
    const r = await fetch(`${API}/api/health`, { headers: { Origin: ORIGIN } });
    health = await r.json();
    check("health responds 200", r.ok, `HTTP ${r.status}`);
  } catch (e) {
    check("health responds", false, e.message);
    return finish();
  }

  /* The storefront-instead-of-API failure returns HTML, not this. */
  check("responding worker is the checkout API", health && health.ok === true,
    JSON.stringify(health).slice(0, 120));
  check("Stripe key is configured", health.stripeConfigured === true);
  check("catalogue loaded", health.products > 0, `products=${health.products}`);
  if (expectVersion) {
    check(`serving expected build ${expectVersion.slice(0, 12)}`,
      health.version === expectVersion.slice(0, 12), `live=${health.version}`);
  }
  console.log(`       build ${health.version} (${health.branch}) · ` +
    `${health.liveMode ? "LIVE MODE" : "test mode"}\n`);

  /* ---- a real priced session ---------------------------- */
  const cart = [{ slug: "bleu-de-chanel", ml: 5, qty: 2 }];
  let session;
  try {
    const r = await fetch(`${API}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      /* Deliberately lie about the price — the worker must ignore it. */
      body: JSON.stringify({ items: cart, price: 1, unit_amount: 100 })
    });
    session = await r.json();
    check("checkout creates a session", r.ok && !!session.url, `HTTP ${r.status}`);
  } catch (e) {
    check("checkout responds", false, e.message);
    return finish();
  }

  if (session.sessionId) {
    const r = await fetch(`${API}/api/session?id=${session.sessionId}`,
      { headers: { Origin: ORIGIN } });
    const s = await r.json();
    /* 2 x Bleu de Chanel 5 ml = $26.00; under $50 so +$7 shipping. */
    check("charges the catalogue price, not the client's", s.amountTotal === 3300,
      `amountTotal=${s.amountTotal} (expected 3300)`);
  }

  /* ---- guardrails still guarding ------------------------ */
  const rejects = async (label, items) => {
    const r = await fetch(`${API}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ items })
    });
    check(label, r.status === 400, `HTTP ${r.status}`);
  };
  await rejects("rejects an unknown product", [{ slug: "not-a-scent", ml: 5, qty: 1 }]);
  await rejects("rejects a discontinued size", [{ slug: "byredo-animalique", ml: 30, qty: 1 }]);
  await rejects("rejects an empty cart", []);

  /* ---- newsletter --------------------------------------- *
     Deliberately never posts a valid address: a smoke test that
     ran on every deploy would fill the list with junk. These
     prove the route is wired up and guarding, which is what a
     deploy can actually break. */
  check("newsletter is configured", health.newsletterConfigured === true,
    "MAILERLITE_API_KEY is not set on the worker");

  const sub = async (label, body, origin, want) => {
    const r = await fetch(`${API}/api/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(body)
    });
    check(label, r.status === want, `HTTP ${r.status} (expected ${want})`);
  };
  await sub("rejects a malformed address", { email: "not-an-address" }, ORIGIN, 400);
  await sub("refuses an unknown origin", { email: "a@b.co" }, "https://evil.example", 403);
  /* A filled honeypot is answered 200 and dropped — proving the
     spam guard is live without adding anyone. */
  await sub("swallows a honeypot submission",
    { email: "bot@example.com", _gotcha: "x" }, ORIGIN, 200);

  /* ---- CORS --------------------------------------------- */
  const eo = await fetch(`${API}/api/checkout`, {
    method: "OPTIONS", headers: { Origin: "https://evil.example" }
  });
  check("does not echo an unknown origin",
    eo.headers.get("access-control-allow-origin") === null,
    eo.headers.get("access-control-allow-origin") || "");

  finish();
}

function finish() {
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
