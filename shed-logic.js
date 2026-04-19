// ============================================================
// SHED-LOGIC.JS  —  LayoutOS 2 Facade
// Fudd Service, Le Roy NY
// ============================================================
// This file is now a thin facade. All shed logic lives in
// focused modules under ./shed/. Each module owns one concern.
// UI files import from here so nothing breaks, but new code
// should import directly from the specific module.
//
// Modules (edit these, not this file):
//   shed/config.js      — business rules, thresholds, tiers
//   shed/anchor.js      — 7-style base price grid
//   shed/prices.js      — part prices (loader + fallback)
//   shed/pricing.js     — getBasePrice, validateSize, styles
//   shed/materials.js   — sheet counts, framing takeoff
//   shed/addons.js      — vinyl, conditioning, sheathing, etc.
//   shed/build-quote.js — orchestrator that assembles quote
//
// Core (shared across calculators):
//   layoutos-core.js    — estimate #s, logging, formatters
// ============================================================

// Shared infrastructure — estimate numbering, logging, formatting
import {
  getNextEstimateNumber,
  incrementEstimateCounter,
  logQuote,
  getQuotesLog,
  formatCurrency,
  formatDate,
} from './layoutos-core.js';

// Shed business rules & constants — extracted to shed/config.js
import { CONFIG } from './shed/config.js';
export { CONFIG };

// Shed base price anchor data (7 styles) — extracted to shed/anchor.js
import { ANCHOR } from './shed/anchor.js';

// Parts pricing loader + fallback table — extracted to shed/prices.js
import { loadPrices, getPrices, PRICES_FALLBACK } from './shed/prices.js';
export { loadPrices, getPrices, PRICES_FALLBACK };

// Base price, size validation, style-list helpers — extracted to shed/pricing.js
import {
  getBasePrice, validateSize,
  getStyleList, getValidWidths, getValidLengths,
} from './shed/pricing.js';
export {
  getBasePrice, validateSize,
  getStyleList, getValidWidths, getValidLengths,
};

// Material takeoffs & sheet counts — extracted to shed/materials.js
import {
  calculateMaterials, calculateFraming, calculateMetalPanels,
} from './shed/materials.js';
export {
  calculateMaterials, calculateFraming, calculateMetalPanels,
};

// Add-ons: vinyl, demo, conditioning, sheathing, shelving, loft — extracted to shed/addons.js
import {
  calculateVinylAddon, calculateDemoPrice,
  getConditioningPackage,
  calculateRoofSheathing, calculateWallSheathing,
  calculateShelving, getLoftAvailability,
  calculateGarageDoors,
} from './shed/addons.js';
export {
  calculateVinylAddon, calculateDemoPrice,
  getConditioningPackage,
  calculateRoofSheathing, calculateWallSheathing,
  calculateShelving, getLoftAvailability,
  calculateGarageDoors,
};

// Quote orchestrator — extracted to shed/build-quote.js
import { buildQuote } from './shed/build-quote.js';
export { buildQuote };

// ------------------------------------------------------------
// Estimate Numbering — implemented in layoutos-core.js
// getNextEstimateNumber (peek — does not increment) and
// incrementEstimateCounter (call after quote is confirmed)
// are imported from core at the top of this file and re-exported
// here so module consumers can import from one place.
// ------------------------------------------------------------
export { getNextEstimateNumber, incrementEstimateCounter };

// ------------------------------------------------------------
// Quote log — implemented in layoutos-core.js
// logQuote(quoteObject, moduleName) and getQuotesLog() are
// imported from core and re-exported here.
// Pass 'shed' as moduleName when calling logQuote.
// ------------------------------------------------------------
export { logQuote, getQuotesLog };

// ------------------------------------------------------------
// Utility exports used by UI
// ------------------------------------------------------------
export { ANCHOR };

// Re-export core formatters so UI can import from one place if needed
export { formatCurrency, formatDate };

export function formatMoney(n) {
  if (n === null || n === undefined) return 'TBD';
  return '$' + Math.round(n).toLocaleString('en-US');
}
