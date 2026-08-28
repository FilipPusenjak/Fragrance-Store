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
  checkoutApi: "https://robot-fragrances-checkout.robotfragrances.workers.dev",

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
  publishableKey: null,

  /* ----------------------------------------------------------
     4. Form endpoint.

     Where the contact form and every newsletter box post to. The
     hand-written forms in index.html and contact.html carry it in
     their own action attribute; this is the copy the injected
     footer and post-order boxes use.

     It used to be read off whichever form happened to be on the
     page, which meant the footer newsletter silently appeared on
     exactly the two pages that already had a form. Configuration
     belongs in configuration.

     Change the endpoint and you must change it in those two HTML
     files too — a box that posts nowhere eats addresses in silence.
     ---------------------------------------------------------- */
  formEndpoint: "https://formspree.io/f/xpqvvqgb",

  /* ----------------------------------------------------------
     5. The newsletter.

     Sign-ups go to MailerLite, through the checkout worker.

     They have to go through the worker. MailerLite's embedded
     forms are a JavaScript widget, and its classic form URL sends
     no CORS headers the inline submit can use — the same wall that
     ruled out Mailchimp. Posting to our own worker instead keeps
     the API key server-side, where a static site cannot leak it.

     A value starting with "/" is a path on checkoutApi above, so
     the worker's URL is written once. An absolute URL is used as
     given, for a platform that can take the form directly:

       Buttondown   https://buttondown.com/api/emails/embed-subscribe/YOUR-USERNAME
                    newsletterField -> "email"
       Kit          https://app.kit.com/forms/YOUR-FORM-ID/subscriptions
                    newsletterField -> "email_address"

     Set this to null and sign-ups fall back to formEndpoint above
     — an inbox, with no automatic unsubscribe link. It is also the
     automatic fallback if checkoutApi is null, so a half-configured
     site still collects addresses rather than dropping them.

     EVERY sign-up box follows this: index.html, every footer, and
     the one after an order. main.js rewrites the markup from these
     values, so this is the only place to change.

     THE WORKER NEEDS ITS KEY. Sign-ups 503 until it is set:
         npx wrangler secret put MAILERLITE_API_KEY
     Optional: MAILERLITE_GROUP_ID to file sign-ups into a group.

     DOUBLE OPT-IN MUST BE ON in the MailerLite dashboard. The
     worker adds people as "unconfirmed" on purpose — anyone can
     type anyone's address into a public box — and MailerLite is
     what emails them to confirm. With double opt-in off, they sit
     unconfirmed forever and no one is ever emailed.

     STILL OUTSTANDING: the postal address CAN-SPAM requires in
     every marketing email. Collecting sign-ups is fine without it;
     sending the first campaign is not. See privacy.html.
     ---------------------------------------------------------- */
  newsletterEndpoint: "/api/subscribe",
  newsletterField: "email",

  /* ----------------------------------------------------------
     6. Pre-launch mode.

     The shop is finished but the business isn't open: there is no
     stock on the bench and nobody to pour an order. Stripe is also
     still in test mode, so a real card would be declined — but a
     declined card is a confusing way to learn a shop isn't trading.

     While this is true the site says so plainly in three places: a
     banner above every page, a line in the cart, and a box the
     shopper has to tick before the payment button will do anything.
     Between them nothing can be bought by accident, and the tick is
     one click when you want to test the checkout yourself.

     Set it to false on launch day. That removes all three; there is
     nothing else to undo.
     ---------------------------------------------------------- */
  preLaunch: true,

  /* ----------------------------------------------------------
     7. Feature flags.

     Everything here is additive — set any one to false and that
     piece reverts to how the site behaved before it existed. They
     are independent, so a change that doesn't suit you can be
     switched off without giving up the others.

     Set the whole object to {} to revert all of them at once.
     ---------------------------------------------------------- */
  features: {
    /* --- Discovery set & newsletter promotion --------------- */

    /* Cart drawer: when a shopper has some testers but not a full
       set, show how many more earn the discount. Contextual, at the
       moment they're deciding. Off -> drawer as before. */
    cartSetNudge: true,

    /* Homepage: a band between the featured scents and the
       newsletter pointing at the set builder. Off -> section absent. */
    homeDiscoveryBand: true,

    /* A compact newsletter form in the footer of every page. The
       homepage keeps its larger one either way.
       Off -> footers as before. */
    footerNewsletter: true,

    /* Order confirmation: offer the newsletter once an order is
       done — the warmest moment there is. Off -> plain confirmation. */
    confirmNewsletter: true,

    /* Product pages: a line under the buy box pointing at the set
       builder for anyone still deciding. Off -> no line. */
    productSetLink: true,

    /* --- Quiz ---------------------------------------------- */

    /* Add the winning decant straight to the cart from the result,
       with a size selector, instead of only linking to its page.
       Off -> link only, as before. */
    quizQuickAdd: true,

    /* Explain the match ("you chose woody & earthy, autumn…") so the
       result reads as reasoned rather than random. Off -> no note. */
    quizExplainMatch: true,

    /* Put the answers in the URL so a result can be shared or
       reloaded, plus a copy-link button. Off -> no URL sync. */
    quizShareResult: true,

    /* Arrow keys and number keys to answer, and a visible back link
       from the result. Off -> click only. */
    quizKeyboard: true
  }
};
