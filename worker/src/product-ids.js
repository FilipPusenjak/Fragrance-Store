/* ============================================================
   Robot Fragrances — Stripe Product ID map
   ------------------------------------------------------------
   HAND-MAINTAINED. Unlike catalogue.js, this file is not
   generated — these IDs come from your Stripe account, not from
   assets/js/main.js.

   Maps a catalogue slug to the Stripe Product it should be
   reported under. When a slug has an ID here, checkout line
   items reference that Product directly, so orders group under
   the products you created in the dashboard instead of Stripe
   minting a throwaway product per session.

   PRICES ARE STILL SET BY THE WORKER, from catalogue.js. Linking
   a Product does not hand pricing over to Stripe — it only
   changes what the charge is filed under. That keeps
   assets/js/main.js the single source of truth for money.

   Any slug left null falls back to an inline product_data
   description, which still charges correctly. So a partial map
   is fine — fill these in as you go.

   Find an ID: Stripe Dashboard -> Products -> click a product ->
   the prod_... shown at the top (also in the page URL).
   ============================================================ */

export const PRODUCT_IDS = {
  "swy-powerfully": null,
  "hermes-h24": null,
  "prada-l-homme": null,
  "jpg-le-male-le-parfum": null,
  "bleu-de-chanel": null,
  "dior-sauvage-edp": null,
  "by-the-fireplace": null,
  "wood-neroli": null,
  "erba-pura": null,
  "pdm-greenley": null,
  "tom-ford-ombre-leather": null,
  "wild-vetiver": null,
  "ombra-lirica": null,
  "le-labo-osmanthus-19": null,
  "le-labo-the-noir-29": null,
  "byredo-animalique": null,
  "super-cedar": null,
  "myrrh-tonka": null
};
