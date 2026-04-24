// ============================================================
// SHED-LOGIC.JS  —  LayoutOS 2 Facade
// apps/shed/ — Fudd Service, Le Roy NY
// ============================================================
// Thin facade re-exporting everything from engine/* so UI
// files import from one place.
//
// Modules (edit these, not this file):
//   engine/config.js      — business rules, thresholds, tiers
//   engine/anchor.js      — 7-style base price grid
//   engine/prices.js      — part prices (loader + fallback)
//   engine/pricing.js     — getBasePrice, validateSize, styles
//   engine/materials.js   — sheet counts, framing takeoff
//   engine/addons.js      — vinyl, conditioning, sheathing, etc.
//   engine/build-quote.js — orchestrator that assembles quote
//
// Core (shared across apps):
//   core/layoutos-core.js — estimate #s, logging, formatters
// ============================================================

import {
  getNextEstimateNumber,
  incrementEstimateCounter,
  logQuote,
  getQuotesLog,
  formatCurrency,
  formatDate,
} from '../../core/layoutos-core.js';

import { CONFIG } from './engine/config.js';
export { CONFIG };

import { ANCHOR } from './engine/anchor.js';

import { loadPrices, getPrices, PRICES_FALLBACK } from './engine/prices.js';
export { loadPrices, getPrices, PRICES_FALLBACK };

import {
  getBasePrice, validateSize,
  getStyleList, getValidWidths, getValidLengths,
} from './engine/pricing.js';
export {
  getBasePrice, validateSize,
  getStyleList, getValidWidths, getValidLengths,
};

import {
  calculateMaterials, calculateFraming, calculateMetalPanels,
} from './engine/materials.js';
export {
  calculateMaterials, calculateFraming, calculateMetalPanels,
};

import {
  calculateVinylAddon, calculateDemoPrice,
  getConditioningPackage,
  calculateRoofSheathing, calculateWallSheathing,
  calculateShelving, getLoftAvailability,
  calculateGarageDoors,
} from './engine/addons.js';
export {
  calculateVinylAddon, calculateDemoPrice,
  getConditioningPackage,
  calculateRoofSheathing, calculateWallSheathing,
  calculateShelving, getLoftAvailability,
  calculateGarageDoors,
};

import { buildQuote } from './engine/build-quote.js';
export { buildQuote };

export { getNextEstimateNumber, incrementEstimateCounter };
export { logQuote, getQuotesLog };
export { ANCHOR };
export { formatCurrency, formatDate };

export function formatMoney(n) {
  if (n === null || n === undefined) return 'TBD';
  return '$' + Math.round(n).toLocaleString('en-US');
}
