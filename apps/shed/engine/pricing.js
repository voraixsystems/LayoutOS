// ============================================================
// shed/pricing.js — Shed Base Price Logic + Size Validation
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================
// PURPOSE: Convert (style, width, length) into a base price,
//   validate that a requested size is offered for the chosen
//   style, and enumerate valid style/width/length options for
//   dropdowns.
//
// API:
//   getBasePrice(styleKey, width, length)  — ALL-IN base price
//     (LP SmartSide + shingle + labor), before add-ons. Handles
//     gambrel→double-decker escalation at 16ft+ and width
//     premiums at 18ft (+13%) and 20ft (+18%).
//   validateSize(styleKey, width, length)  — { valid, reason }
//   getStyleList()       — array of styles for UI select
//   getValidWidths(key)  — widths offered for a style
//   getValidLengths(key) — lengths offered for a style
//
// Internals (not exported):
//   buildSqftTable()  — "WxL":price map → sqft:price map
//   interpolateSqft() — linear interpolation between tiers
//
// Depends on: shed/config.js (CONFIG), shed/anchor.js (ANCHOR).
// Consumed by: shed/build-quote.js, shed-logic.js (facade).
// ============================================================

import { CONFIG } from './config.js';
import { ANCHOR } from './anchor.js';

// ------------------------------------------------------------
// HELPERS — price table building + interpolation
// ------------------------------------------------------------

// Convert "WxL": price map to sqft: price map for interpolation
function buildSqftTable(basePrices) {
  const table = {};
  for (const [key, price] of Object.entries(basePrices)) {
    const [w, l] = key.split('x').map(Number);
    table[w * l] = price;
  }
  return table;
}

// Linear interpolation between two points in a sqft price table
function interpolateSqft(table, sqft) {
  const tiers = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (!tiers.length) return 0;
  if (sqft <= tiers[0]) return table[tiers[0]];
  if (sqft >= tiers[tiers.length - 1]) return table[tiers[tiers.length - 1]];
  for (let i = 0; i < tiers.length - 1; i++) {
    if (sqft > tiers[i] && sqft <= tiers[i + 1]) {
      const p1 = table[tiers[i]];
      const p2 = table[tiers[i + 1]];
      return p1 + (p2 - p1) * (sqft - tiers[i]) / (tiers[i + 1] - tiers[i]);
    }
  }
  return table[tiers[tiers.length - 1]];
}

// ------------------------------------------------------------
// getBasePrice(styleKey, width, length)
// Returns raw base price before any add-ons.
// Handles: gambrel escalation, 18/20ft width premiums
// ------------------------------------------------------------
export function getBasePrice(styleKey, width, length) {
  // Gambrel styles 16ft+ must use Double Decker
  let effectiveStyle = styleKey;
  if (width >= CONFIG.GAMBREL_UPGRADE_WIDTH && CONFIG.GAMBREL_STYLES.includes(styleKey)) {
    effectiveStyle = 'double';
  }

  const styleData = ANCHOR[effectiveStyle];
  if (!styleData) return 0;

  // Resolve price alias (e.g. hip → deluxe) + optional style premium
  const pricingKey = styleData.priceAlias || effectiveStyle;
  const style = ANCHOR[pricingKey];
  if (!style) return 0;
  const stylePremium = styleData.hipPremium || 1;

  const sqft = width * length;
  const table = buildSqftTable(style.base_prices);

  // Standard widths (8–16ft): direct interpolation
  if (width <= 16) {
    return Math.round(interpolateSqft(table, sqft) * stylePremium);
  }

  // 18ft and 20ft widths: scale from 16ft base, then apply premium
  // Per ShedPriceAnchor.json rules:
  //   1. Find 16ft-wide equivalent price for same length
  //   2. Scale by (width / 16) for extra footprint
  //   3. Apply width premium (1.13 for 18ft, 1.18 for 20ft)
  const sixteenSqft = 16 * length;
  const sixteenPrice = interpolateSqft(table, sixteenSqft);
  const widthFactor = width / 16;
  const premium = CONFIG.WIDTH_PREMIUMS[width] || 1;
  return Math.round(sixteenPrice * widthFactor * premium * stylePremium);
}

// ------------------------------------------------------------
// validateSize(styleKey, width, length)
// Returns { valid: bool, reason: string }
// ------------------------------------------------------------
export function validateSize(styleKey, width, length) {
  // After gambrel escalation
  let effectiveStyle = styleKey;
  if (width >= CONFIG.GAMBREL_UPGRADE_WIDTH && CONFIG.GAMBREL_STYLES.includes(styleKey)) {
    effectiveStyle = 'double';
  }

  const style = ANCHOR[effectiveStyle];
  if (!style) return { valid: false, reason: 'Unknown style.' };

  const [minW, maxW] = style.widthRange;
  const [minL, maxL] = style.lengthRange;

  if (width < minW || width > maxW)
    return { valid: false, reason: `${style.label} available ${minW}–${maxW}ft wide.` };
  if (length < minL || length > maxL)
    return { valid: false, reason: `${style.label} available ${minL}–${maxL}ft long.` };

  return { valid: true, reason: '' };
}

// ------------------------------------------------------------
// STYLE LIST HELPERS — for UI dropdowns
// ------------------------------------------------------------
export function getStyleList() {
  return Object.entries(ANCHOR).map(([key, val]) => ({
    key,
    label: val.label,
    description: val.description,
    widthRange: val.widthRange,
    lengthRange: val.lengthRange,
  }));
}

// Valid widths/lengths for a given style (for dropdowns)
export function getValidWidths(styleKey) {
  const s = ANCHOR[styleKey];
  if (!s) return [];
  const all = [8, 10, 12, 14, 16, 18, 20];
  return all.filter(w => w >= s.widthRange[0] && w <= s.widthRange[1]);
}

export function getValidLengths(styleKey, width) {
  const s = ANCHOR[styleKey];
  if (!s) return [];
  const all = [8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40];
  return all.filter(l => l >= s.lengthRange[0] && l <= s.lengthRange[1]);
}
