// ============================================================
// shed/anchor.js — Shed Base Price Anchor Data
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================
// PURPOSE: Base prices for all 7 shed styles, keyed "WxL".
//   Prices are ALL-IN: LP SmartSide siding + shingle roof + labor.
//   Used by pricing.js (getBasePrice) for interpolation.
//
// TO EDIT PRICES: edit ShedPriceAnchor.json (source of truth)
//   and re-sync to this file. Do not hand-edit.
//
// Styles: economy, deluxe, carriage, mini, low, maxi, double
//
// Depends on: nothing. Pure data.
// Consumed by: shed/pricing.js, shed/build-quote.js,
//   shed-logic.js (facade re-export).
// ============================================================

export const ANCHOR = {
  economy: {
    label: 'Economy Gable',
    description: 'Traditional A-frame, single-story. Most affordable option.',
    overhangKey: 'OVERHANG_ECONOMY',
    widthRange: [8, 20],
    lengthRange: [8, 40],
    // base_prices keyed as "WxL": price
    base_prices: {
      '8x8':2600,'8x10':3000,'8x12':3500,'8x14':3850,'8x16':4100,
      '8x20':4800,'8x24':6150,
      '10x10':3400,'10x12':3950,'10x14':4450,'10x16':4950,
      '10x20':6000,'10x24':6500,'10x40':11200,
      '12x12':4750,'12x14':5400,'12x16':5700,'12x20':6950,
      '12x24':8350,'12x28':9750,'12x32':10150,'12x36':12450,
      '16x16':7650,'16x20':8950,'16x24':9950,'16x28':10850,
      '16x32':11850,'16x36':13150,'16x40':14900,
    },
  },
  deluxe: {
    label: 'Deluxe Gable',
    description: 'Enhanced A-frame with 12in overhang on all sides. Single-story.',
    overhangKey: 'OVERHANG_DELUXE',
    widthRange: [8, 20],
    lengthRange: [8, 40],
    base_prices: {
      '8x8':3200,'8x10':3850,'8x12':4450,'8x14':4950,'8x16':5400,
      '8x20':6400,'8x24':7650,
      '10x10':4400,'10x12':5150,'10x14':5850,'10x16':6550,
      '10x20':8000,'10x24':9350,'10x40':14900,
      '12x12':6050,'12x14':6900,'12x16':8350,'12x20':9350,
      '12x24':10200,'12x28':11450,'12x32':12250,'12x36':16450,
      '16x16':10250,'16x20':12200,'16x24':13850,'16x28':15450,
      '16x32':16400,'16x36':17950,'16x40':19900,
    },
  },
  carriage: {
    label: 'Carriage / Eco',
    description: 'Hybrid A-frame with long-wall dominant overhangs. Single-story.',
    overhangKey: 'OVERHANG_ECONOMY',
    widthRange: [8, 20],
    lengthRange: [8, 40],
    base_prices: {
      '8x8':2850,'8x10':3450,'8x12':3950,'8x14':4400,'8x16':4750,
      '8x20':5600,'8x24':6750,
      '10x10':4000,'10x12':4550,'10x14':5200,'10x16':5800,
      '10x20':6800,'10x24':7650,'10x40':12900,
      '12x12':5500,'12x14':6350,'12x16':6650,'12x20':7950,
      '12x24':8750,'12x28':9950,'12x32':10900,'12x36':14050,
      '16x16':8950,'16x20':10550,'16x24':12000,'16x28':13550,
      '16x32':14225,'16x36':15375,'16x40':17550,
    },
  },
  mini: {
    label: 'Mini Barn',
    description: 'Small gambrel barn. Single-story. Max 12ft wide.',
    overhangKey: 'OVERHANG_GAMBREL',
    widthRange: [8, 12],
    lengthRange: [8, 40],
    base_prices: {
      '8x8':2300,'8x10':2750,'8x12':3200,'8x14':3450,'8x16':3700,
      '8x20':4350,'8x24':5550,
      '10x10':4400,'10x12':5200,'10x14':5900,'10x16':6550,
      '10x20':8000,'10x24':9400,'10x40':13300,
    },
  },
  low: {
    label: 'Low Barn',
    description: 'Low-profile gambrel barn. Single-story. Max 12ft wide.',
    overhangKey: 'OVERHANG_GAMBREL',
    widthRange: [8, 12],
    lengthRange: [8, 40],
    base_prices: {
      '8x8':2750,'8x10':3300,'8x12':3750,'8x14':4150,'8x16':4450,
      '8x20':5200,'8x24':6650,
      '10x10':5150,'10x12':5650,'10x14':6750,'10x16':7650,
      '10x20':8850,'10x24':10250,
      '12x12':6050,'12x14':6900,'12x16':7400,'12x20':9350,
      '12x24':10200,'12x28':11250,'12x32':12250,'12x36':14100,'12x40':15400,
    },
  },
  maxi: {
    label: 'Maxi Barn',
    description: 'Larger gambrel barn. Single-story. 10–12ft wide only.',
    overhangKey: 'OVERHANG_GAMBREL',
    widthRange: [10, 12],
    lengthRange: [10, 40],
    base_prices: {
      '10x10':5600,'10x12':6350,'10x14':7450,'10x16':8650,
      '10x20':9550,'10x24':10800,
      '12x12':6650,'12x14':7650,'12x16':8250,'12x20':10350,
      '12x24':13500,'12x28':14450,'12x32':15750,'12x36':17050,'12x40':18350,
    },
  },
  double: {
    label: 'Double Decker',
    description: 'Two-story gambrel. Required for 16ft+ gambrel styles. Most space per footprint.',
    overhangKey: 'OVERHANG_GAMBREL',
    widthRange: [10, 20],
    lengthRange: [10, 40],
    base_prices: {
      '10x10':5950,'10x12':6750,'10x14':7800,'10x16':9000,
      '10x20':10150,'10x24':11250,'10x40':16900,
      '12x12':7250,'12x14':9550,'12x16':10250,'12x20':12350,
      '12x24':15600,'12x28':16650,'12x32':17750,'12x36':19950,
      '16x16':12800,'16x20':16000,'16x24':19200,'16x28':22550,
      '16x32':25600,'16x36':27850,'16x40':30825,
    },
  },
  hip: {
    label: 'Deluxe Hip Roof',
    description: 'Four-slope hip roof with 12in overhang on all sides. Clean, finished look — ideal for open lots and visibility from multiple angles.',
    overhangKey: 'OVERHANG_DELUXE',
    widthRange: [8, 20],
    lengthRange: [8, 40],
    priceAlias: 'deluxe',
    hipPremium: 1.023,
    base_prices: {},
  },
};
