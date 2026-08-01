/* ============================================================
   Robot Fragrances — checkout worker
   ------------------------------------------------------------
   A single Cloudflare Worker that turns a cart into a Stripe
   Checkout Session. The static site stays on GitHub Pages; only
   this call leaves it.

   Routes
     POST /api/checkout        cart -> Checkout Session
     GET  /api/session?id=...  safe status for the confirm page
     GET  /api/health          liveness + config sanity

   Two UI modes, one endpoint:
     hosted    -> returns { url }          browser redirects to Stripe
     embedded  -> returns { clientSecret } checkout mounts in-page

   That is deliberate. Moving checkout in-app later is a config
   flag on the client (assets/js/config.js), not a rewrite here.

   SECURITY — the load-bearing rule:
   Prices come from ./catalogue.js, never from the request body.
   The browser sends only { slug, ml, qty }; anything it claims
   about money is ignored. Same for shipping, which is derived
   from the server-computed subtotal.
   ============================================================ */

import {
  CATALOGUE,
  CURRENCY,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FLAT_RATE
} from "./catalogue.js";

const STRIPE_API = "https://api.stripe.com/v1";

/* Countries we'll ship to — Stripe needs these enumerated. */
const SHIP_TO = [
  "US", "CA", "GB", "IE", "AU", "NZ", "DE", "FR", "NL", "BE", "LU",
  "AT", "CH", "IT", "ES", "PT", "DK", "SE", "NO", "FI", "IS", "PL",
  "CZ", "SK", "SI", "HR", "HU", "RO", "BG", "GR", "EE", "LV", "LT",
  "JP", "SG", "HK", "KR", "AE", "IL", "ZA", "MX", "BR"
];

const MAX_LINES = 50;   // distinct product+size rows in one order
const MAX_QTY = 99;     // per row; mirrors the cart's own clamp

/* ---------- tiny helpers ---------------------------------- */

function allowedOrigins(env) {
  const site = (env.SITE_URL || "https://robotfragrances.com").replace(/\/$/, "");
  const extra = (env.ALLOWED_ORIGINS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  return [
    site,
    site.replace("://", "://www."),
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    ...extra
  ];
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const ok = allowedOrigins(env).includes(origin);
  const h = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
  if (ok) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request, env)
    }
  });
}

function fail(message, status, request, env, detail) {
  const body = { error: message };
  if (detail) body.detail = detail;
  return json(body, status || 400, request, env);
}

/* Stripe's API is form-encoded with bracketed nesting, e.g.
   line_items[0][price_data][unit_amount]=1300 */
function formEncode(obj, prefix, out) {
  out = out || [];
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (value === undefined || value === null) return;
    const path = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (v !== null && typeof v === "object") formEncode(v, `${path}[${i}]`, out);
        else out.push(`${encodeURIComponent(`${path}[${i}]`)}=${encodeURIComponent(v)}`);
      });
    } else if (typeof value === "object") {
      formEncode(value, path, out);
    } else {
      out.push(`${encodeURIComponent(path)}=${encodeURIComponent(value)}`);
    }
  });
  return out;
}

async function stripe(env, path, params, method) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: method || "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20"
    },
    body: params ? formEncode(params).join("&") : undefined
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `Stripe error ${res.status}`;
    const err = new Error(msg);
    err.stripe = data && data.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------- cart -> priced line items --------------------- */
/* Returns { lines, subtotal, summary } or throws a plain Error
   whose message is safe to show the shopper. */
function priceCart(rawItems, siteUrl) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Your cart is empty.");
  }
  if (rawItems.length > MAX_LINES) {
    throw new Error("That's more distinct items than one order can hold.");
  }

  /* Merge duplicate slug+ml rows so quantity limits can't be
     side-stepped by repeating a line. */
  const merged = new Map();
  rawItems.forEach((it) => {
    const slug = String((it && it.slug) || "");
    const ml = Number((it && it.ml) || 0);
    let qty = Math.floor(Number((it && it.qty) || 0));

    const product = CATALOGUE[slug];
    if (!product) throw new Error(`We don't carry "${slug}".`);

    const unitAmount = product.sizes[String(ml)];
    if (!unitAmount) throw new Error(`${product.name} doesn't come in ${ml} ml.`);

    if (!Number.isFinite(qty) || qty < 1) qty = 1;

    const key = `${slug}:${ml}`;
    const prev = merged.get(key);
    merged.set(key, {
      slug, ml, product, unitAmount,
      qty: Math.min(MAX_QTY, (prev ? prev.qty : 0) + qty)
    });
  });

  const rows = [...merged.values()];
  let subtotal = 0;

  const lines = rows.map((r) => {
    subtotal += r.unitAmount * r.qty;
    const line = {
      quantity: r.qty,
      price_data: {
        currency: CURRENCY,
        unit_amount: r.unitAmount,
        product_data: {
          name: `${r.product.name} — ${r.ml} ml decant`,
          description: r.product.label,
          metadata: { slug: r.slug, ml: String(r.ml) }
        }
      }
    };
    if (r.product.image) {
      line.price_data.product_data.images = [`${siteUrl}/${r.product.image}`];
    }
    return line;
  });

  const summary = rows.map((r) => `${r.slug}:${r.ml}:${r.qty}`).join(",");
  return { lines, subtotal, summary };
}

function shippingOption(subtotal) {
  const free = subtotal >= FREE_SHIPPING_THRESHOLD;
  return {
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: free ? "Free shipping" : "Standard shipping",
      fixed_amount: { amount: free ? 0 : SHIPPING_FLAT_RATE, currency: CURRENCY },
      delivery_estimate: {
        minimum: { unit: "business_day", value: 3 },
        maximum: { unit: "business_day", value: 10 }
      }
    }
  };
}

/* ---------- routes ---------------------------------------- */

async function handleCheckout(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return fail("Checkout isn't configured yet.", 503, request, env,
      "STRIPE_SECRET_KEY is not set on the worker.");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail("Malformed request.", 400, request, env);
  }

  const siteUrl = (env.SITE_URL || "https://robotfragrances.com").replace(/\/$/, "");
  const uiMode = body.mode === "embedded" ? "embedded" : "hosted";

  let priced;
  try {
    priced = priceCart(body.items, siteUrl);
  } catch (e) {
    return fail(e.message, 400, request, env);
  }

  const params = {
    mode: "payment",
    line_items: priced.lines,
    shipping_address_collection: { allowed_countries: SHIP_TO },
    shipping_options: [shippingOption(priced.subtotal)],
    phone_number_collection: { enabled: false },
    billing_address_collection: "auto",
    allow_promotion_codes: true,
    metadata: { cart: priced.summary.slice(0, 480), source: "robotfragrances.com" }
  };

  /* An email typed on our page pre-fills Stripe's; harmless if absent. */
  if (typeof body.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
    params.customer_email = body.email;
  }

  if (uiMode === "embedded") {
    params.ui_mode = "embedded";
    params.return_url = `${siteUrl}/order-confirmed.html?session_id={CHECKOUT_SESSION_ID}`;
  } else {
    params.success_url = `${siteUrl}/order-confirmed.html?session_id={CHECKOUT_SESSION_ID}`;
    params.cancel_url = `${siteUrl}/checkout.html`;
  }

  let session;
  try {
    session = await stripe(env, "/checkout/sessions", params);
  } catch (e) {
    console.error("stripe create session failed", e.message, e.stripe);
    return fail("We couldn't reach the payment provider. Please try again.",
      502, request, env);
  }

  return json(
    uiMode === "embedded"
      ? { mode: "embedded", clientSecret: session.client_secret, sessionId: session.id }
      : { mode: "hosted", url: session.url, sessionId: session.id },
    200, request, env
  );
}

async function handleSession(request, env, url) {
  if (!env.STRIPE_SECRET_KEY) {
    return fail("Checkout isn't configured yet.", 503, request, env);
  }
  const id = url.searchParams.get("id") || "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) {
    return fail("Unknown session.", 400, request, env);
  }

  let session;
  try {
    session = await stripe(env, `/checkout/sessions/${id}`, null, "GET");
  } catch (e) {
    return fail("Unknown session.", 404, request, env);
  }

  /* Only fields the confirmation page needs. */
  return json({
    status: session.status,                         // open | complete | expired
    paymentStatus: session.payment_status,          // paid | unpaid | no_payment_required
    email: (session.customer_details && session.customer_details.email) || "",
    amountTotal: session.amount_total,
    currency: session.currency
  }, 200, request, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        stripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
        liveMode: (env.STRIPE_SECRET_KEY || "").startsWith("sk_live_"),
        products: Object.keys(CATALOGUE).length,
        site: env.SITE_URL || "https://robotfragrances.com",
        /* Binding NAMES only — never values. Makes a misnamed secret
           obvious instead of looking like a missing one. */
        bindings: Object.keys(env).sort()
      }, 200, request, env);
    }

    if (url.pathname === "/api/checkout" && request.method === "POST") {
      return handleCheckout(request, env);
    }

    if (url.pathname === "/api/session" && request.method === "GET") {
      return handleSession(request, env, url);
    }

    return fail("Not found.", 404, request, env);
  }
};
