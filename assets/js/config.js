/* ============================================================
   Robot Fragrances — front-end configuration
   ------------------------------------------------------------
   Everything here is PUBLIC. Only ever put public values in this
   file: the Stripe publishable key is designed to be exposed,
   the secret key (sk_...) must never appear anywhere in this repo.
   ============================================================ */
window.RF_CONFIG = {

  /* ----------------------------------------------------------
     1. Where the checkout worker lives.
     After `npm run deploy` in /worker, Cloudflare prints a URL
     like https://robot-fragrances-checkout.<you>.workers.dev —
     paste it here (no trailing slash).

     Leave as null and the checkout page will say it isn't
     connected yet rather than failing silently.
     ---------------------------------------------------------- */
  checkoutApi: null,

  /* ----------------------------------------------------------
     2. Checkout mode — the in-app switch.

     "hosted"    Redirect to Stripe's payment page. Nothing else
                 to configure. This is the default.

     "embedded"  Payment form renders inside checkout.html, so
                 the customer never leaves robotfragrances.com.
                 Requires publishableKey below to be set.

     The worker already supports both, so flipping this string
     is the whole migration.
     ---------------------------------------------------------- */
  checkoutMode: "hosted",

  /* ----------------------------------------------------------
     3. Stripe publishable key — only needed for "embedded".
     Starts pk_test_ / pk_live_. Safe to commit.
     ---------------------------------------------------------- */
  publishableKey: null
};
