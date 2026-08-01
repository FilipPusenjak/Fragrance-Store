/* ============================================================
   Robot Fragrances — worker-side catalogue (GENERATED)
   ------------------------------------------------------------
   DO NOT EDIT BY HAND. Regenerate with:
       node scripts/gen-worker-catalogue.js

   Source of truth: assets/js/main.js (window.RF_CATALOGUE).
   Prices are in CENTS. The worker prices every order from
   this table and ignores anything the browser claims a decant
   costs — that check is the whole point of having a server.
   ============================================================ */

export const CATALOGUE = {
  "swy-powerfully": {
    "name": "SWY Powerfully",
    "label": "Designer",
    "image": "assets/img/swy-powerfully.webp",
    "sizes": {
      "2": 400,
      "5": 900,
      "10": 1700,
      "30": 4500
    }
  },
  "hermes-h24": {
    "name": "Hermès H24",
    "label": "Designer",
    "image": "assets/img/hermes-h24.webp",
    "sizes": {
      "2": 400,
      "5": 900,
      "10": 1700,
      "30": 4500
    }
  },
  "prada-l-homme": {
    "name": "Prada L'Homme",
    "label": "Designer",
    "image": "assets/img/prada-l-homme.webp",
    "sizes": {
      "2": 400,
      "5": 900,
      "10": 1700,
      "30": 4500
    }
  },
  "jpg-le-male-le-parfum": {
    "name": "JPG Le Male Le Parfum",
    "label": "Designer",
    "image": "assets/img/jpg-le-male-le-parfum.webp",
    "sizes": {
      "2": 600,
      "5": 1300,
      "10": 2500,
      "30": 6500
    }
  },
  "bleu-de-chanel": {
    "name": "Bleu de Chanel",
    "label": "Designer",
    "image": "assets/img/bleu-de-chanel.webp",
    "sizes": {
      "2": 600,
      "5": 1300,
      "10": 2500,
      "30": 6500
    }
  },
  "dior-sauvage-edp": {
    "name": "Dior Sauvage EDP",
    "label": "Designer",
    "image": "assets/img/dior-sauvage-edp.webp",
    "sizes": {
      "2": 600,
      "5": 1300,
      "10": 2500,
      "30": 6500
    }
  },
  "by-the-fireplace": {
    "name": "By the Fireplace",
    "label": "Designer",
    "image": "assets/img/by-the-fireplace.webp",
    "sizes": {
      "2": 600,
      "5": 1300,
      "10": 2500,
      "30": 6500
    }
  },
  "wood-neroli": {
    "name": "Wood Neroli",
    "label": "Designer",
    "image": "assets/img/wood-neroli.webp",
    "sizes": {
      "2": 600,
      "5": 1300,
      "10": 2500,
      "30": 6500
    }
  },
  "erba-pura": {
    "name": "Erba Pura",
    "label": "Niche",
    "image": "assets/img/erba-pura.webp",
    "sizes": {
      "2": 800,
      "5": 1700,
      "10": 3000,
      "30": 8500
    }
  },
  "pdm-greenley": {
    "name": "PDM Greenley",
    "label": "Niche",
    "image": "assets/img/pdm-greenley.webp",
    "sizes": {
      "2": 800,
      "5": 1700,
      "10": 3000,
      "30": 8500
    }
  },
  "tom-ford-ombre-leather": {
    "name": "Tom Ford Ombré Leather",
    "label": "Niche",
    "image": "assets/img/tom-ford-ombre-leather.webp",
    "sizes": {
      "2": 800,
      "5": 1700,
      "10": 3000,
      "30": 8500
    }
  },
  "wild-vetiver": {
    "name": "Wild Vetiver",
    "label": "Niche · Rare",
    "image": "assets/img/wild-vetiver.webp",
    "sizes": {
      "2": 1500,
      "5": 3200,
      "10": 6000,
      "30": 16000
    }
  },
  "ombra-lirica": {
    "name": "Ombra Lirica",
    "label": "Niche · Rare",
    "image": "assets/img/ombra-lirica.webp",
    "sizes": {
      "2": 1500,
      "5": 3200,
      "10": 6000,
      "30": 16000
    }
  },
  "le-labo-osmanthus-19": {
    "name": "Le Labo Osmanthus 19",
    "label": "Niche",
    "image": "assets/img/le-labo-osmanthus-19.webp",
    "sizes": {
      "2": 2000,
      "5": 4500,
      "10": 8000
    }
  },
  "le-labo-the-noir-29": {
    "name": "Le Labo Thé Noir 29",
    "label": "Niche",
    "image": "assets/img/le-labo-the-noir-29.webp",
    "sizes": {
      "2": 1200,
      "5": 3000,
      "10": 5500,
      "30": 15000
    }
  },
  "byredo-animalique": {
    "name": "Byredo Animalique",
    "label": "Niche",
    "image": "assets/img/byredo-animalique.webp",
    "sizes": {
      "2": 1200,
      "5": 3000,
      "10": 5500,
      "30": 15000
    }
  }
};

/* Free shipping at or above this subtotal (cents). */
export const FREE_SHIPPING_THRESHOLD = 5000;

/* Flat rate charged below the threshold (cents). */
export const SHIPPING_FLAT_RATE = 500;

export const CURRENCY = "usd";
