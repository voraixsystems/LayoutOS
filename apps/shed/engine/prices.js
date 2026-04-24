// ============================================================
// shed/prices.js — Parts Pricing Loader + Fallback Table
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================
// PURPOSE: Load part-level prices (lumber, sheets, fasteners,
//   doors, windows) from prices.json at app init, with an inline
//   fallback table for file:// or offline use.
//
// KEEP PRICES_FALLBACK IN SYNC with /data/shared/prices.json —
//   it is the safety net when fetch fails. Both should match exactly.
//
// API:
//   loadPrices()  — async. Call once on app init. Populates
//                   PRICES state AND back-fills CONFIG.ADDON_* so
//                   shed modules have a single source of truth.
//   getPrices()   — sync. Returns the active price table.
//                   Safe to call before loadPrices() resolves
//                   (falls back to PRICES_FALLBACK).
//
// Depends on: engine/config.js (mutates CONFIG.ADDON_* on load).
// Consumed by: engine/materials.js, engine/addons.js,
//   engine/build-quote.js, apps/shed/shed-logic.js (facade).
// ============================================================

import { CONFIG } from './config.js';

// ------------------------------------------------------------
// PRICES — loaded async from prices.json, fallback inline
// ------------------------------------------------------------
let PRICES = null;

// Inline fallback prices (mirrors data/shared/prices.json exactly — keep in sync)
// UPDATE 2026-04-16: osb price, zip prices, added metal_panel_per_lf, premium_plywood,
//   man door variants, window variants. Old keys kept for backward compat.
export const PRICES_FALLBACK = {
  lp_smartside_sheet:    48.82,

  osb_7_16_sheet:        13.00,  // UPDATE 2026-04-16: 14.55→13 (volatile — verify before quoting)
  osb_sheet:             13.00,  // canonical name going forward

  zip_wall_sheet:        40.20,  // MaterialPrices: 7/16 Zip System wall panel
  zip_roof_sheet:        60.00,  // VERIFY — not in MaterialPrices separately; confirm before quoting
  zip_tape_roll:         34.95,  // MaterialPrices: Zip Tape 90ft roll

  vapor_barrier_roll:   150.00,  // UPDATE 2026-04-18: 35→150
  felt_roll:             25.00,
  house_wrap_roll:       80.00,

  fir_strip_per_lf:       0.75,  // required under metal panels over any sheathing — 24in OC
  fir_strip_8ft:          4.00,  // 1×4×8ft furring board (framing panel uses board count, not LF)

  shingle_square:        43.47,

  metal_panel_sqft:       3.29,  // legacy key — 29ga standard
  metal_panel_per_lf:     3.29,  // 29ga standard — 3ft wide panels, ordered to length
  metal_panel_29ga_per_lf: 3.29,
  metal_panel_26ga_per_lf: 3.75,

  premium_plywood_sheet: 50.00,  // UPDATE 2026-04-16: added — 3/4in BC plywood for shelving

  man_door_complete:    520.00,  // legacy key
  man_door_solid:       520.00,  // UPDATE 2026-04-16: 36x80 Primed Steel JELD-WEN — HD
  man_door_9lite:       560.00,  // UPDATE 2026-04-16: 36x80 9-Lite Steel JELD-WEN — SKU VERIFY
  man_door_fanlite:     545.00,  // UPDATE 2026-04-16: 36x80 Fan-Lite Steel JELD-WEN — SKU VERIFY

  window_24x27_complete: 200.00, // legacy key
  window_single_hung:    200.00, // UPDATE 2026-04-16: 24x30 Single Hung — Project Source Lowes
  window_sliding:        260.00, // UPDATE 2026-04-16: 36x36 Sliding — Project Source Lowes

  garage_door_install:   350.00,
  garage_door_8x7_std:   450.00,
  garage_door_8x7_r6:    600.00,
  garage_door_8x8_std:  2150.00,
  garage_door_9x7_std:   700.00,
  garage_door_9x7_r6:   1150.00,
  garage_door_seal_9ft:   14.00,
  garage_door_keyed_handle: 50.00,

  framed_opening_8x7:    225.00,
  framed_opening_8x8:    250.00,
  framed_opening_9x7:    275.00,
  framed_opening_9x8:    300.00,
  framed_opening_10x7:   350.00,
  framed_opening_12x7:   425.00,
  framed_opening_16x7:   500.00,

  ramp_per_opening:      120.00,

  ice_water_shield_roll: 250.00,  // self-adhering 36in × 75ft roll (~225 sqft coverage)
  roofing_nail_box:       59.00,  // 30# coil/box roofing nails ~7200 count — 320 nails/square

  // Framing lumber — SPF (2x4, 2x6) + Fir (2x8, 2x10) + PT skids
  // SOURCE: MaterialPrices.json. Keys consumed by materials.js takeoff.
  '4x4x16_pt':    27.98,
  '2x4x8_spf':     3.85,
  '2x4x10_spf':    5.74,
  '2x4x12_spf':    7.07,
  '2x4x16_spf':   10.83,
  '2x6x8_spf':     8.15,
  '2x6x10_spf':   11.62,
  '2x6x12_spf':   12.34,
  '2x6x16_spf':   18.52,
  '2x8x8_spf':     9.63,
  '2x8x10_spf':   12.17,
  '2x8x12_spf':   14.42,
  '2x8x16_spf':   19.28,
  '2x10x8_spf':   14.55,
  '2x10x10_spf':  18.33,
  '2x10x12_spf':  21.96,
  '2x10x16_spf':  32.63,
  subfloor_sheet: 59.75,
  drip_edge_10ft:  9.98,
};

// Call once on app init — tries fetch, falls back to inline.
// Also sources add-on prices into CONFIG from the loaded price table.
export async function loadPrices() {
  try {
    const res = await fetch('../../data/shared/prices.json');
    if (!res.ok) throw new Error('fetch failed');
    PRICES = await res.json();
  } catch (_) {
    // file:// protocol or missing file — use inline fallback
    PRICES = { ...PRICES_FALLBACK };
  }
  // Populate CONFIG add-on prices from loaded prices — single source of truth
  // Legacy keys (backward compat)
  CONFIG.ADDON_MAN_DOOR            = PRICES.man_door_complete;
  CONFIG.ADDON_WINDOW_24x27        = PRICES.window_24x27_complete;
  CONFIG.ADDON_GARAGE_DOOR_INSTALL = PRICES.garage_door_install;
  CONFIG.ADDON_RAMP_PER_OPENING    = PRICES.ramp_per_opening;
  // Door type prices (UPDATE 2026-04-16)
  CONFIG.ADDON_MAN_DOOR_SOLID      = PRICES.man_door_solid;
  CONFIG.ADDON_MAN_DOOR_9LITE      = PRICES.man_door_9lite;
  CONFIG.ADDON_MAN_DOOR_FANLITE    = PRICES.man_door_fanlite;
  // Window type prices (UPDATE 2026-04-16)
  CONFIG.ADDON_WINDOW_SINGLE_HUNG  = PRICES.window_single_hung;
  CONFIG.ADDON_WINDOW_SLIDING      = PRICES.window_sliding;
  // Material prices for internal calcs
  CONFIG.ADDON_PREMIUM_PLYWOOD     = PRICES.premium_plywood_sheet;
  CONFIG.ADDON_OSB_SHEET           = PRICES.osb_sheet;
  // Garage door prices (UPDATE 2026-04-18)
  CONFIG.ADDON_GARAGE_DOOR_8X7_STD      = PRICES.garage_door_8x7_std;
  CONFIG.ADDON_GARAGE_DOOR_8X7_R6       = PRICES.garage_door_8x7_r6;
  CONFIG.ADDON_GARAGE_DOOR_8X8_STD      = PRICES.garage_door_8x8_std;
  CONFIG.ADDON_GARAGE_DOOR_9X7_STD      = PRICES.garage_door_9x7_std;
  CONFIG.ADDON_GARAGE_DOOR_9X7_R6       = PRICES.garage_door_9x7_r6;
  CONFIG.ADDON_GARAGE_DOOR_SEAL_9FT     = PRICES.garage_door_seal_9ft;
  CONFIG.ADDON_GARAGE_DOOR_KEYED_HANDLE = PRICES.garage_door_keyed_handle;
  CONFIG.ADDON_FRAMED_OPENING_8X7       = PRICES.framed_opening_8x7;
  CONFIG.ADDON_FRAMED_OPENING_8X8       = PRICES.framed_opening_8x8;
  CONFIG.ADDON_FRAMED_OPENING_9X7       = PRICES.framed_opening_9x7;
  CONFIG.ADDON_FRAMED_OPENING_9X8       = PRICES.framed_opening_9x8;
  CONFIG.ADDON_FRAMED_OPENING_10X7      = PRICES.framed_opening_10x7;
  CONFIG.ADDON_FRAMED_OPENING_12X7      = PRICES.framed_opening_12x7;
  CONFIG.ADDON_FRAMED_OPENING_16X7      = PRICES.framed_opening_16x7;
  return PRICES;
}

export function getPrices() {
  return PRICES || PRICES_FALLBACK;
}
