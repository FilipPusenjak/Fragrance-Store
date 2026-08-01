/* ============================================================
   Robot Fragrances — worker catalogue generator
   ------------------------------------------------------------
   The Cloudflare Worker must NEVER trust prices sent by the
   browser, so it keeps its own copy of the price table. This
   script generates that copy from the same single source of
   truth the site uses (assets/js/main.js → window.RF_CATALOGUE).

   Prices are emitted in CENTS, because that is what the Stripe
   API expects and it keeps float arithmetic out of the worker.

   Usage:  node scripts/gen-worker-catalogue.js
           (also run automatically by `node build.js`)
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "worker/src/catalogue.js");

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

function generate() {
  const cat = loadCatalogue();

  /* slug -> { name, label, image, sizes: { <ml>: <cents> } } */
  const out = {};
  let priceCount = 0;

  cat.forEach((p) => {
    const sizes = {};
    p.sizes.forEach((s) => {
      if (!Number.isInteger(s.ml) || s.ml <= 0) {
        throw new Error(`Bad size on ${p.slug}: ${JSON.stringify(s)}`);
      }
      const cents = Math.round(s.price * 100);
      if (!Number.isInteger(cents) || cents <= 0) {
        throw new Error(`Bad price on ${p.slug} ${s.ml}ml: ${s.price}`);
      }
      sizes[s.ml] = cents;
      priceCount++;
    });
    out[p.slug] = { name: p.name, label: p.label, image: p.image || "", sizes };
  });

  const banner =
    "/* ============================================================\n" +
    "   Robot Fragrances — worker-side catalogue (GENERATED)\n" +
    "   ------------------------------------------------------------\n" +
    "   DO NOT EDIT BY HAND. Regenerate with:\n" +
    "       node scripts/gen-worker-catalogue.js\n" +
    "\n" +
    "   Source of truth: assets/js/main.js (window.RF_CATALOGUE).\n" +
    "   Prices are in CENTS. The worker prices every order from\n" +
    "   this table and ignores anything the browser claims a decant\n" +
    "   costs — that check is the whole point of having a server.\n" +
    "   ============================================================ */\n\n";

  const body =
    "export const CATALOGUE = " + JSON.stringify(out, null, 2) + ";\n\n" +
    "/* Free shipping at or above this subtotal (cents). */\n" +
    "export const FREE_SHIPPING_THRESHOLD = 5000;\n\n" +
    "/* Flat rate charged below the threshold (cents). */\n" +
    "export const SHIPPING_FLAT_RATE = 500;\n\n" +
    "export const CURRENCY = \"usd\";\n";

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, banner + body);

  console.log(
    `worker catalogue → ${path.relative(ROOT, OUT)} ` +
    `(${Object.keys(out).length} products, ${priceCount} prices)`
  );
}

generate();
