/* ============================================================
   Robot Fragrances — checkout worker
   ------------------------------------------------------------
   A single Cloudflare Worker that turns a cart into a Stripe
   Checkout Session. The static site stays on GitHub Pages; only
   this call leaves it.

   Routes
     POST /api/checkout        cart -> Checkout Session
     GET  /api/session?id=...  safe status for the confirm page
     POST /api/subscribe       newsletter sign-up -> MailerLite
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
  SET_RULE,
  SHIPPING_FLAT_RATE
} from "./catalogue.js";
import { PRODUCT_IDS } from "./product-ids.js";
import { BRANCH, BUILT_AT, VERSION } from "./version.js";

const STRIPE_API = "https://api.stripe.com/v1";
const MAILERLITE_API = "https://connect.mailerlite.com/api";

/* Countries we'll ship to — Stripe needs these enumerated, and it
   won't let a customer complete checkout to anywhere else.

   US-only for now: small-parcel international runs $15-25 against a
   $7 domestic rate, before customs forms and untracked-loss claims.
   Adding a country means adding it here AND giving it a shipping
   rate below — a destination with no rate would ship at the domestic
   price, which is the exact mistake this list exists to prevent. */
const SHIP_TO = ["US"];

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

  /* Discovery set: N distinct fragrances at the tester size earn a
     discount, and the discount is capped at COMPLETE sets.

     Capping matters. Without it, "5 testers = 10% off" quietly becomes
     "any number of testers = 10% off" — a shopper could add the whole
     range from the shop page and take a blanket discount that was
     never offered. Complete sets keep the offer to what the copy says:
     18 testers is three sets, so fifteen are discounted and three are
     not.

     Most expensive first, so adding one extra cheap tester never
     reduces what a shopper already had.

     Quantity within a discounted row rides along — five scents at two
     each is two sets' worth of juice, and that is a real bulk order,
     not the loophole this guards. Breadth is what's rationed.

     Decided here, from the server's own rule, never from anything the
     browser claims. */
  const testerRows = rows.filter((r) => r.ml === SET_RULE.ml);
  const sets = Math.floor(testerRows.length / SET_RULE.min);
  const discountedSlugs = new Set(
    testerRows
      .slice()
      .sort((a, b) => b.unitAmount - a.unitAmount || a.slug.localeCompare(b.slug))
      .slice(0, sets * SET_RULE.min)
      .map((r) => r.slug)
  );
  const isSet = sets > 0;

  let subtotal = 0;
  let grossSubtotal = 0;   // what it would have cost at full price

  const lines = rows.map((r) => {
    const discounted = r.ml === SET_RULE.ml && discountedSlugs.has(r.slug);
    /* Round the unit price, not the line total, so what Stripe charges
       is always quantity x a real per-item price. */
    const unitAmount = discounted
      ? Math.round(r.unitAmount * (1 - SET_RULE.discount))
      : r.unitAmount;

    subtotal += unitAmount * r.qty;
    grossSubtotal += r.unitAmount * r.qty;
    const line = {
      quantity: r.qty,
      price_data: { currency: CURRENCY, unit_amount: unitAmount }
    };

    /* Either reference a real Stripe Product or describe one inline —
       Stripe rejects both together. Referencing keeps orders grouped
       under the dashboard products instead of creating a throwaway
       product per session. The price is ours either way. */
    const productId = PRODUCT_IDS[r.slug];
    if (productId) {
      line.price_data.product = productId;
    } else {
      line.price_data.product_data = {
        name: `${r.product.name} — ${r.ml} ml decant` +
          (discounted ? " (discovery set)" : ""),
        description: r.product.label,
        metadata: { slug: r.slug, ml: String(r.ml) }
      };
      if (r.product.image) {
        line.price_data.product_data.images = [`${siteUrl}/${r.product.image}`];
      }
    }
    return line;
  });

  /* Machine-readable, for re-parsing an order later. */
  const summary = rows.map((r) => `${r.slug}:${r.ml}:${r.qty}`).join(",");

  /* Human-readable, for whoever is at the bench filling the order.
     Line items lose the size once they reference a Stripe Product, and
     a discounted price is a poor way to infer what to pour — so the
     sizes and quantities live here regardless of how the order was
     priced. A star marks a tester that took the set discount. */
  const packingList = rows
    .map((r) => {
      const star = r.ml === SET_RULE.ml && discountedSlugs.has(r.slug) ? "*" : "";
      return `${r.qty}x ${r.product.name} ${r.ml}ml${star}`;
    })
    .join("; ");

  const setNote = isSet
    ? `${sets} set${sets === 1 ? "" : "s"} of ${SET_RULE.min} ` +
      `(-${Math.round(SET_RULE.discount * 100)}% on * items); ` +
      `full price would be $${(grossSubtotal / 100).toFixed(2)}`
    : "";

  return { lines, subtotal, grossSubtotal, summary, packingList, setNote, sets, isSet };
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
    /* What to pour, in a form that survives however the order was
       priced. Stripe caps each value at 500 chars. */
    metadata: {
      items: priced.packingList.slice(0, 480),
      cart: priced.summary.slice(0, 480),
      ...(priced.setNote ? { discovery_set: priced.setNote.slice(0, 480) } : {}),
      source: "robotfragrances.com"
    }
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

/* ---------- newsletter ------------------------------------ */
/* Sign-ups can't post to MailerLite directly. Its embedded forms
   are a JavaScript widget, and the classic webforms URL doesn't
   send CORS headers this site can use — the same wall that ruled
   out Mailchimp. So the form posts here and the worker makes the
   API call, which is the better shape anyway: the API key stays
   server-side instead of sitting in the page for anyone to lift.

   Before this, sign-ups went to Formspree — an inbox, with no
   unsubscribe link and a list only a human could maintain. */

/* yyyy-MM-dd HH:mm:ss — the only timestamp format the API takes. */
function mlTimestamp(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/* The site's forms post FormData. JSON is accepted too so the
   endpoint can be exercised with a plain fetch. */
async function readSubscribeBody(request) {
  const type = request.headers.get("Content-Type") || "";
  if (type.includes("application/json")) {
    const body = await request.json();
    return { email: body.email, gotcha: body._gotcha };
  }
  const form = await request.formData();
  return { email: form.get("email"), gotcha: form.get("_gotcha") };
}

async function handleSubscribe(request, env) {
  if (!env.MAILERLITE_API_KEY) {
    return fail("The newsletter isn't connected yet.", 503, request, env,
      "MAILERLITE_API_KEY is not set on the worker.");
  }

  /* Checkout can afford an unknown caller: a session nobody pays for
     costs nothing. This writes to a real mailing list, so an
     unrecognised origin is turned away outright rather than merely
     denied its CORS header. A forged Origin still gets through —
     the honeypot and double opt-in are what carry the rest. */
  if (!allowedOrigins(env).includes(request.headers.get("Origin") || "")) {
    return fail("Not allowed.", 403, request, env);
  }

  let fields;
  try {
    fields = await readSubscribeBody(request);
  } catch (e) {
    return fail("Malformed request.", 400, request, env);
  }

  /* Formspree filtered spam for us; that job moves here along with
     the endpoint. A bot that fills the hidden field is told the
     sign-up worked and nothing is sent on — saying otherwise only
     teaches it to try again without the field. */
  if (fields.gotcha) return json({ ok: true }, 200, request, env);

  const email = String(fields.email || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return fail("That doesn't look like an email address.", 400, request, env);
  }

  /* "unconfirmed" is what makes MailerLite send its confirmation
     email. A box anyone can type any address into shouldn't be able
     to put that address on a list without its owner agreeing, and an
     unconfirmed row can never be mailed — so junk sign-ups stay
     inert instead of becoming a deliverability problem.

     This needs double opt-in switched ON in the MailerLite
     dashboard. With it off, these addresses sit unconfirmed forever
     and nobody is ever emailed. */
  const payload = {
    email,
    status: env.MAILERLITE_STATUS || "unconfirmed",
    /* Someone who unsubscribed stays unsubscribed. Quietly re-adding
       them because they hit a form again is how a list earns
       complaints. */
    resubscribe: false,
    subscribed_at: mlTimestamp(new Date())
  };

  /* Where the sign-up came from, kept as the record of consent. */
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) payload.ip_address = ip;
  /* opted_in_at and optin_ip are left for MailerLite to fill in when
     the confirmation link is actually clicked. Writing them here
     would record a consent that hasn't happened yet. */

  const groups = (env.MAILERLITE_GROUP_ID || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (groups.length) payload.groups = groups;

  let res;
  try {
    res = await fetch(`${MAILERLITE_API}/subscribers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("mailerlite unreachable", e.message);
    return fail("We couldn't reach the mailing list. Please try again.",
      502, request, env);
  }

  /* 201 created, 200 already known. Both are a success to the person
     at the form, and distinguishing them would tell any caller
     whether a given address is already on the list. */
  if (res.status === 200 || res.status === 201) {
    return json({ ok: true }, 200, request, env);
  }
  if (res.status === 422) {
    return fail("That doesn't look like an email address.", 400, request, env);
  }
  if (res.status === 429) {
    return fail("Too many sign-ups at once. Please try again in a minute.",
      503, request, env);
  }

  /* Status only — the body can echo the address back. */
  console.error("mailerlite rejected a sign-up", res.status);
  return fail("We couldn't add you just now. Please try again.",
    502, request, env);
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
        newsletterConfigured: Boolean(env.MAILERLITE_API_KEY),
        liveMode: (env.STRIPE_SECRET_KEY || "").startsWith("sk_live_"),
        products: Object.keys(CATALOGUE).length,
        site: env.SITE_URL || "https://robotfragrances.com",
        /* Which build is actually serving. Without this, a bad deploy
           looks the same as a broken one. */
        version: VERSION,
        branch: BRANCH,
        builtAt: BUILT_AT
      }, 200, request, env);
    }

    if (url.pathname === "/api/checkout" && request.method === "POST") {
      return handleCheckout(request, env);
    }

    if (url.pathname === "/api/session" && request.method === "GET") {
      return handleSession(request, env, url);
    }

    if (url.pathname === "/api/subscribe" && request.method === "POST") {
      return handleSubscribe(request, env);
    }

    return fail("Not found.", 404, request, env);
  }
};
