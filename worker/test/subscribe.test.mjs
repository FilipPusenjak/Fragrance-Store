/* ============================================================
   Robot Fragrances — newsletter sign-up tests
   ------------------------------------------------------------
   Runs the real worker with MailerLite stubbed out, so what gets
   sent to the mailing list is asserted without a key, a network
   call, or a junk subscriber in a live account.

   The things worth breaking a build over: the API key never
   reaching the browser, an unsubscribe never being undone, and a
   sign-up never being taken as confirmed consent.

   Usage:  node --test worker/test/
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";

import worker from "../src/index.js";

const ENV = {
  MAILERLITE_API_KEY: "ml_test_stub_key",
  SITE_URL: "https://robotfragrances.com"
};
const ORIGIN = "https://robotfragrances.com";

/* ---- MailerLite stub -------------------------------------- */
let lastCall = null;
const realFetch = globalThis.fetch;

function stubMailerLite({ status = 201, body = {} } = {}) {
  globalThis.fetch = async (url, init) => {
    lastCall = {
      url: String(url),
      headers: init?.headers || {},
      body: init?.body ? JSON.parse(init.body) : null
    };
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  };
}
function stubUnreachable() {
  globalThis.fetch = async () => { throw new Error("ECONNREFUSED"); };
}
function restore() { globalThis.fetch = realFetch; lastCall = null; }

/* ---- helpers ---------------------------------------------- */

/* What the site actually sends: main.js posts `new FormData(form)`. */
function formPost(fields, origin = ORIGIN) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return new Request("https://api.example/api/subscribe", {
    method: "POST",
    headers: { Origin: origin, Accept: "application/json" },
    body: fd
  });
}

function jsonPost(body, origin = ORIGIN) {
  return new Request("https://api.example/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body)
  });
}

/* ============================================================
   The happy path
   ============================================================ */

test("a form sign-up reaches MailerLite", async () => {
  stubMailerLite();
  const res = await worker.fetch(formPost({ email: "buyer@example.com" }), ENV);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
  assert.equal(lastCall.url, "https://connect.mailerlite.com/api/subscribers");
  assert.equal(lastCall.body.email, "buyer@example.com");
  restore();
});

test("a JSON sign-up works too", async () => {
  stubMailerLite();
  const res = await worker.fetch(jsonPost({ email: "buyer@example.com" }), ENV);
  assert.equal(res.status, 200);
  assert.equal(lastCall.body.email, "buyer@example.com");
  restore();
});

test("authenticates with the bearer token", async () => {
  stubMailerLite();
  await worker.fetch(formPost({ email: "buyer@example.com" }), ENV);
  assert.equal(lastCall.headers.Authorization, "Bearer ml_test_stub_key");
  restore();
});

test("addresses are normalised before they reach the list", async () => {
  stubMailerLite();
  await worker.fetch(formPost({ email: "  Buyer@Example.COM  " }), ENV);
  assert.equal(lastCall.body.email, "buyer@example.com",
    "trimmed and lowercased, so one person isn't two subscribers");
  restore();
});

test("an address already on the list still reads as success", async () => {
  /* MailerLite answers 200 for a known address, 201 for a new one.
     Telling them apart would leak who is already subscribed. */
  stubMailerLite({ status: 200 });
  const res = await worker.fetch(formPost({ email: "buyer@example.com" }), ENV);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
  restore();
});

/* ============================================================
   Consent — the part that is hard to undo
   ============================================================ */

test("sign-ups land unconfirmed so MailerLite asks first", async () => {
  stubMailerLite();
  await worker.fetch(formPost({ email: "buyer@example.com" }), ENV);
  assert.equal(lastCall.body.status, "unconfirmed",
    "anyone can type anyone's address into a public form");
  restore();
});

test("an unsubscribe is never undone by a new sign-up", async () => {
  stubMailerLite();
  await worker.fetch(formPost({ email: "buyer@example.com" }), ENV);
  assert.equal(lastCall.body.resubscribe, false);
  restore();
});

test("does not record an opt-in that hasn't happened", async () => {
  stubMailerLite();
  await worker.fetch(formPost({ email: "buyer@example.com" }), ENV);
  assert.equal(lastCall.body.opted_in_at, undefined,
    "MailerLite sets this when the confirmation link is clicked");
  assert.equal(lastCall.body.optin_ip, undefined);
  restore();
});

test("records when and where the sign-up came from", async () => {
  stubMailerLite();
  const req = formPost({ email: "buyer@example.com" });
  req.headers.set("CF-Connecting-IP", "203.0.113.9");
  await worker.fetch(req, ENV);
  assert.equal(lastCall.body.ip_address, "203.0.113.9");
  assert.match(lastCall.body.subscribed_at, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/,
    "MailerLite rejects any other timestamp format");
  restore();
});

test("a configured group is applied, and absent when unset", async () => {
  stubMailerLite();
  await worker.fetch(formPost({ email: "a@example.com" }),
    { ...ENV, MAILERLITE_GROUP_ID: "123456, 789012" });
  assert.deepEqual(lastCall.body.groups, ["123456", "789012"]);

  await worker.fetch(formPost({ email: "b@example.com" }), ENV);
  assert.equal(lastCall.body.groups, undefined);
  restore();
});

/* ============================================================
   Spam and validation
   ============================================================ */

test("a filled honeypot is dropped, not forwarded", async () => {
  stubMailerLite();
  const res = await worker.fetch(
    formPost({ email: "bot@example.com", _gotcha: "http://spam.example" }), ENV);
  assert.equal(res.status, 200, "a bot shouldn't learn it was caught");
  assert.equal((await res.json()).ok, true);
  assert.equal(lastCall, null, "nothing should reach MailerLite");
  restore();
});

test("rejects a malformed address without calling out", async () => {
  stubMailerLite();
  for (const email of ["", "nope", "no@domain", "two @spaces.com", "a@b.c ."]) {
    const res = await worker.fetch(formPost({ email }), ENV);
    assert.equal(res.status, 400, `"${email}" should be rejected`);
  }
  assert.equal(lastCall, null, "nothing malformed should reach MailerLite");
  restore();
});

test("rejects an absurdly long address", async () => {
  stubMailerLite();
  const res = await worker.fetch(
    formPost({ email: "a".repeat(250) + "@example.com" }), ENV);
  assert.equal(res.status, 400);
  assert.equal(lastCall, null);
  restore();
});

test("rejects a malformed body", async () => {
  stubMailerLite();
  const req = new Request("https://api.example/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: "{ not json"
  });
  assert.equal((await worker.fetch(req, ENV)).status, 400);
  restore();
});

/* ============================================================
   Who is allowed to write to the list
   ============================================================ */

test("turns away an unknown origin outright", async () => {
  stubMailerLite();
  const res = await worker.fetch(
    formPost({ email: "buyer@example.com" }, "https://evil.example"), ENV);
  assert.equal(res.status, 403, "this writes to a real list, unlike checkout");
  assert.equal(lastCall, null);
  restore();
});

test("turns away a request with no origin at all", async () => {
  stubMailerLite();
  const req = new Request("https://api.example/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "buyer@example.com" })
  });
  assert.equal((await worker.fetch(req, ENV)).status, 403);
  assert.equal(lastCall, null);
  restore();
});

test("allows the live site origin", async () => {
  stubMailerLite();
  const res = await worker.fetch(formPost({ email: "buyer@example.com" }), ENV);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  restore();
});

/* ============================================================
   Failure modes
   ============================================================ */

test("returns 503 when the newsletter isn't configured", async () => {
  stubMailerLite();
  const res = await worker.fetch(formPost({ email: "buyer@example.com" }),
    { SITE_URL: ENV.SITE_URL });
  assert.equal(res.status, 503);
  assert.equal(lastCall, null);
  restore();
});

test("a MailerLite outage surfaces as 502 without leaking details", async () => {
  stubMailerLite({ status: 500, body: { message: "internal boom", trace: "stack" } });
  const res = await worker.fetch(formPost({ email: "buyer@example.com" }), ENV);
  assert.equal(res.status, 502);
  const body = JSON.stringify(await res.json());
  assert.doesNotMatch(body, /boom|stack/, "internal errors must not leak");
  restore();
});

test("an unreachable MailerLite is a 502, not a crash", async () => {
  stubUnreachable();
  const res = await worker.fetch(formPost({ email: "buyer@example.com" }), ENV);
  assert.equal(res.status, 502);
  restore();
});

test("a rejected address comes back as a 400, not a server error", async () => {
  stubMailerLite({ status: 422, body: { message: "The email must be a valid email." } });
  const res = await worker.fetch(formPost({ email: "buyer@example.com" }), ENV);
  assert.equal(res.status, 400);
  restore();
});

test("being rate limited is reported as temporary", async () => {
  stubMailerLite({ status: 429, body: { message: "Too Many Attempts." } });
  const res = await worker.fetch(formPost({ email: "buyer@example.com" }), ENV);
  assert.equal(res.status, 503, "a 4xx would tell the shopper to fix their address");
  restore();
});

test("the API key never appears in any response", async () => {
  for (const stub of [
    () => stubMailerLite({ status: 201 }),
    () => stubMailerLite({ status: 422 }),
    () => stubMailerLite({ status: 500 }),
    () => stubMailerLite({ status: 429 })
  ]) {
    stub();
    const res = await worker.fetch(formPost({ email: "buyer@example.com" }), ENV);
    const dump = JSON.stringify(await res.json()) + [...res.headers].join();
    assert.doesNotMatch(dump, /ml_test_stub_key/);
    restore();
  }
});

/* ============================================================
   Routing
   ============================================================ */

test("health reports the newsletter without exposing the key", async () => {
  const res = await worker.fetch(new Request("https://api.example/api/health", {
    headers: { Origin: ORIGIN }
  }), ENV);
  const body = await res.json();
  assert.equal(body.newsletterConfigured, true);
  assert.doesNotMatch(JSON.stringify(body), /ml_test_stub_key/);

  const off = await worker.fetch(new Request("https://api.example/api/health", {
    headers: { Origin: ORIGIN }
  }), { SITE_URL: ENV.SITE_URL });
  assert.equal((await off.json()).newsletterConfigured, false);
});

test("GET /api/subscribe is not a route", async () => {
  const res = await worker.fetch(new Request("https://api.example/api/subscribe", {
    headers: { Origin: ORIGIN }
  }), ENV);
  assert.equal(res.status, 404);
});
