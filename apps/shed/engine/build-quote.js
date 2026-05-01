// ============================================================
// shed/build-quote.js — Quote Orchestrator
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================
// PURPOSE: The conductor. Takes raw user inputs from the UI
//   and produces a full, priced, ready-to-render quote object
//   by calling the other engine/* modules in the right order.
//
// API (exported):
//   buildQuote(inputs)  — main entry point
//     inputs = {
//       style, width, length, wallHeight, roof, siding,
//       conditioningLevel,
//       addons: { manDoors, windows, garageDoors, ramps,
//                 loftFlag, shelvingFlag },
//       demo:   { enabled, width, length },
//       customer: { name, address, email, phone },
//       internalNotes, paymentTier,
//       priceOverrides {},
//       manualItems []
//     }
//     Returns the complete quote object that core/proposal.html
//     renders from.
//
// Depends on:
//   engine/config.js   (CONFIG)
//   engine/anchor.js   (ANCHOR — for description label lookup)
//   engine/prices.js   (getPrices)
//   engine/pricing.js  (getBasePrice)
//   engine/materials.js (calculateMaterials)
//   engine/addons.js   (calculateVinylAddon, calculateDemoPrice,
//                       getConditioningPackage,
//                       calculateRoofSheathing,
//                       calculateWallSheathing,
//                       calculateShelving, getLoftAvailability)
//   core/layoutos-core.js (getNextEstimateNumber, formatDate)
//
// Consumed by: apps/shed/shed-logic.js (facade re-export).
// ============================================================

import { CONFIG } from './config.js';
import { ANCHOR } from './anchor.js';
import { getPrices } from './prices.js';
import { getBasePrice } from './pricing.js';
import { calculateMaterials } from './materials.js';
import {
  calculateVinylAddon, calculateDemoPrice,
  getConditioningPackage, getIceWater,
  calculateRoofSheathing, calculateWallSheathing,
  calculateShelving, getLoftAvailability,
  calculateGarageDoors,
} from './addons.js';
import { getNextEstimateNumber, formatDate } from '../../../core/layoutos-core.js';

// ------------------------------------------------------------
// generateAutoNotes(quoteData)
// Returns array of automatic customer-facing notes.
// ------------------------------------------------------------
function generateAutoNotes(quoteData) {
  const { roof, addons, conditioning, roofSheathing, wallSheathing, loftRequested, shelvingSpec, garageDoorItems, gdResult } = quoteData;
  const notes = [];

  if (roof === 'metal' && (!roofSheathing || roofSheathing.option === 'none')) {
    notes.push(
      'Steel roofs condensate in heated or regularly used buildings. ' +
      'A vapor barrier prevents drip and premature rot.'
    );
  }

  const hasLoft = loftRequested || (addons && addons.loftFlag);
  if (hasLoft) notes.push('Loft included — final price confirmed at walkthrough.');

  const hasShelving = (shelvingSpec && shelvingSpec.enabled) || (addons && addons.shelvingFlag);
  if (hasShelving && !(shelvingSpec && shelvingSpec.enabled)) {
    notes.push('Shelving quoted per linear foot — contact for details.');
  }

  if (garageDoorItems && garageDoorItems.length > 0) {
    if (gdResult && gdResult.lineItems.some(li => li.lbwNote)) {
      notes.push('Load-bearing wall considerations may require structural upgrade on wide openings — confirmed at walkthrough.');
    }
  } else if (addons && addons.garageDoors > 0) {
    notes.push('Garage door material price varies — verify current Home Depot price before finalizing.');
  }

  notes.push(...CONFIG.ESTIMATE_NOTES_BASE);

  if (roofSheathing && roofSheathing.notes && roofSheathing.notes.length) {
    notes.push(...roofSheathing.notes);
  }
  if (wallSheathing && wallSheathing.notes && wallSheathing.notes.length) {
    notes.push(...wallSheathing.notes);
  }
  if (conditioning && conditioning.notes && conditioning.notes.length) {
    notes.push(...conditioning.notes);
  }

  return notes;
}

// ------------------------------------------------------------
// selectPaymentTerms(total, tierOverride)
// ------------------------------------------------------------
function selectPaymentTerms(total, tierOverride) {
  return (tierOverride === 'three_tier' || total >= CONFIG.PAYMENT_LARGE_THRESHOLD)
    ? CONFIG.PAYMENT_LARGE_NOTE
    : CONFIG.PAYMENT_STANDARD;
}

// ------------------------------------------------------------
// buildQuote(inputs)
// ------------------------------------------------------------
export function buildQuote(inputs) {
  const {
    style, width, length, wallHeight, roof, siding,
    conditioningLevel, addons, demo, customer,
    internalNotes, paymentTier, priceOverrides, manualItems,
    estimateNumber,
    roofSheathingOption,
    wallSheathingOption,
    manDoorItems,
    windowItems,
    shelvingSpec,
    loftRequested,
    slab,
    iceWater,
    garageDoorItems,
    shopDoors,
    rampSelections,
  } = inputs;

  const sqft      = width * length;
  const materials = calculateMaterials(width, length, wallHeight, style);
  const p         = getPrices();

  // ── Base price ─────────────────────────────────────────
  let basePrice = getBasePrice(style, width, length);

  // ── Vinyl add-on ───────────────────────────────────────
  let vinylAddon = 0;
  if (siding === 'vinyl') {
    vinylAddon = calculateVinylAddon(sqft);
  }

  // ── Metal roof add-on ──────────────────────────────────
  let metalRoofAddon = 0;
  if (roof === 'metal') {
    metalRoofAddon = Math.round((basePrice + vinylAddon) * CONFIG.METAL_ROOF_MULTIPLIER);
  }

  // Panel linear footage — shared by gauge + premium color calcs
  const pitch    = inputs.pitch || 5;
  const halfSpan = width / 2;
  const slopeLen = Math.sqrt(halfSpan * halfSpan + (halfSpan * pitch / 12) ** 2);
  const panelLF  = roof === 'metal' ? Math.ceil(length / 3) * 2 * Math.ceil(slopeLen) : 0;

  // 26ga gauge upcharge — difference vs 29ga standard, per panel LF
  const roofGauge     = inputs.roofGauge || '29';
  const gaugeCost     = (roof === 'metal' && roofGauge === '26')
    ? Math.round(panelLF * ((p['metal_panel_26ga_per_lf'] || 3.75) - (p['metal_panel_29ga_per_lf'] || 3.29)))
    : 0;

  // Premium color upcharge — per panel LF (crinkle/matte finish)
  const roofColorPremium = inputs.roofColorPremium || false;
  const isAutoColor      = !inputs.roofColor;
  const roofColorLabel   = inputs.roofColorLabel   || (roof === 'metal' ? 'Stealth Black' : 'Charcoal');
  const roofColorTier    = inputs.roofColorTier    || 'base';
  const premiumColorCost = (roof === 'metal' && roofColorPremium)
    ? Math.round(panelLF * (roofColorTier === 'crinkle'
        ? CONFIG.METAL_PREMIUM_CRINKLE_PER_LF
        : CONFIG.METAL_PREMIUM_BASE_PER_LF))
    : 0;

  // ── Conditioning package (legacy tier system — Step 6) ─
  const conditioning = getConditioningPackage(conditioningLevel, materials, style, roof);

  // ── Ice & water shield ─────────────────────────────────
  const iceWaterResult = getIceWater(iceWater?.enabled || false, iceWater?.coverage || 'lower6', materials);

  // ── Roof sheathing (UPDATE 2026-04-16) ─────────────────
  const roofSheathing = (roof === 'metal' && roofSheathingOption && roofSheathingOption !== 'none')
    ? calculateRoofSheathing(roofSheathingOption, materials)
    : null;

  // ── Wall sheathing (UPDATE 2026-04-16) ─────────────────
  const wallSheathing = (siding === 'vinyl' && wallSheathingOption && wallSheathingOption !== 'none')
    ? calculateWallSheathing(wallSheathingOption, materials)
    : null;

  // ── Line items ─────────────────────────────────────────
  const lineItems = [];

  // Base shed shell
  let baseStyleLabel = ANCHOR[style]?.label || style;
  if (style === 'carriage' && inputs.carriageVariant) {
    baseStyleLabel = inputs.carriageVariant === 'classic' ? 'Classic' : 'Carriage';
  }
  const BARN_STYLES = ['mini', 'low', 'maxi', 'double'];
  const shingleType = BARN_STYLES.includes(style) ? '3-Tab Shingle' : 'Architectural Shingle';
  const shingleColorNote = roof !== 'metal'
    ? ` — ${shingleType}, ${roofColorLabel}${isAutoColor ? ' (default)' : ''}`
    : '';
  lineItems.push({
    id: 'base',
    qty: 1,
    description: (style && width && length)
      ? `${baseStyleLabel} — ${width}×${length}ft, ${wallHeight}ft walls${shingleColorNote}`
      : 'Base price — complete configuration to calculate',
    unitPrice: applyOverride(priceOverrides, 'base', basePrice),
    total: applyOverride(priceOverrides, 'base', basePrice),
    isBase: true,
  });

  // 10ft wall upgrade
  if (wallHeight === 10) {
    const mat8        = calculateMaterials(width, length, 8, style);
    const extraSheets = Math.max(0, materials.lpSheets - mat8.lpSheets);
    if (extraSheets > 0) {
      const matCost = extraSheets * CONFIG.LP_SMARTSIDE_PRICE_PER_SHEET;
      lineItems.push({
        id: 'wall_10ft_materials',
        qty: extraSheets,
        description: `10ft wall upgrade — extra LP siding (${extraSheets} sheets)`,
        unitPrice: CONFIG.LP_SMARTSIDE_PRICE_PER_SHEET,
        total: applyOverride(priceOverrides, 'wall_10ft_materials', matCost),
      });
    }
    const perimeter   = 2 * (width + length);
    const laborCost   = Math.round(perimeter * CONFIG.WALL_10FT_UPCHARGE_PER_LF);
    lineItems.push({
      id: 'wall_10ft_labor',
      qty: perimeter,
      description: `10ft wall upgrade — labor & stud upgrade (${perimeter} LF)`,
      unitPrice: CONFIG.WALL_10FT_UPCHARGE_PER_LF,
      total: applyOverride(priceOverrides, 'wall_10ft_labor', laborCost),
    });
  }

  // Vinyl upgrade
  if (vinylAddon > 0) {
    lineItems.push({
      id: 'vinyl',
      qty: 1,
      description: 'Vinyl siding upgrade',
      unitPrice: applyOverride(priceOverrides, 'vinyl', vinylAddon),
      total: applyOverride(priceOverrides, 'vinyl', vinylAddon),
    });
  }

  // Metal roof
  if (metalRoofAddon > 0) {
    const colorNote = ` — ${roofColorLabel}${isAutoColor ? ' (default)' : ''}`;
    lineItems.push({
      id: 'metal_roof',
      qty: 1,
      description: `Metal R-Panel roof upgrade (+12%)${colorNote}`,
      unitPrice: applyOverride(priceOverrides, 'metal_roof', metalRoofAddon),
      total: applyOverride(priceOverrides, 'metal_roof', metalRoofAddon),
    });
  }

  // 26ga gauge upcharge
  if (gaugeCost > 0) {
    lineItems.push({
      id: 'roof_gauge_26',
      qty: panelLF,
      description: '26ga panel upgrade (vs 29ga standard)',
      unitPrice: Math.round(((p['metal_panel_26ga_per_lf'] || 3.75) - (p['metal_panel_29ga_per_lf'] || 3.29)) * 100) / 100,
      total: gaugeCost,
    });
  }

  // Premium color upcharge
  if (premiumColorCost > 0) {
    lineItems.push({
      id: 'roof_color_premium',
      qty: 1,
      description: `Premium panel finish — ${roofColorLabel}`,
      unitPrice: premiumColorCost,
      total: premiumColorCost,
    });
  }

  // Roof sheathing line items
  if (roofSheathing && roofSheathing.lineItems.length > 0) {
    roofSheathing.lineItems.forEach((item, i) => {
      lineItems.push({
        id: `roof_sheathing_${i}`,
        qty: item.qty,
        description: item.description,
        unitPrice: item.unitPrice,
        total: item.total,
        isRoofSheathing: true,
      });
    });
  }

  // Wall sheathing line items
  if (wallSheathing && wallSheathing.lineItems.length > 0) {
    wallSheathing.lineItems.forEach((item, i) => {
      lineItems.push({
        id: `wall_sheathing_${i}`,
        qty: item.qty,
        description: item.description,
        unitPrice: item.unitPrice,
        total: item.total,
        isWallSheathing: true,
      });
    });
  }

  // Conditioning package line items (legacy)
  if (conditioning.lineItems.length > 0) {
    conditioning.lineItems.forEach((item, i) => {
      lineItems.push({
        id: `conditioning_${i}`,
        qty: item.qty,
        description: `[${conditioning.label}] ${item.description}`,
        unitPrice: item.unitPrice,
        total: item.total,
        isConditioning: true,
      });
    });
  }

  // Ice & water shield line items
  iceWaterResult.lineItems.forEach((item, i) => {
    lineItems.push({ id: `ice_water_${i}`, qty: item.qty, description: item.description, unitPrice: item.unitPrice, total: item.total, isIceWater: true });
  });

  // ── Add-ons: Man doors ─────────────────────────────────
  if (manDoorItems && manDoorItems.length > 0) {
    manDoorItems.forEach((door, i) => {
      const spec  = CONFIG.MAN_DOOR_SPECS[door.type] || CONFIG.MAN_DOOR_SPECS.solid;
      const price = applyOverride(priceOverrides, `man_door_${i}`,
        door.type === '9lite'   ? CONFIG.ADDON_MAN_DOOR_9LITE   :
        door.type === 'fanlite' ? CONFIG.ADDON_MAN_DOOR_FANLITE :
        CONFIG.ADDON_MAN_DOOR_SOLID);
      const swingLabel = door.swing === 'right' ? 'RH inswing' : 'LH inswing';
      const sku = door.swing === 'right' ? spec.sku_right : spec.sku_left;
      lineItems.push({
        id: `man_door_${i}`,
        qty: door.qty || 1,
        description: `${spec.label} — ${swingLabel}`,
        sku,
        skuVerified: spec.verified,
        unitPrice: price,
        total: price * (door.qty || 1),
      });
    });
  }

  // ── Add-ons: Windows ───────────────────────────────────
  if (windowItems && windowItems.length > 0) {
    windowItems.forEach((win, i) => {
      const spec  = CONFIG.WINDOW_SPECS[win.type] || CONFIG.WINDOW_SPECS.single_hung;
      const price = applyOverride(priceOverrides, `window_${i}`,
        win.type === 'sliding' ? CONFIG.ADDON_WINDOW_SLIDING : CONFIG.ADDON_WINDOW_SINGLE_HUNG);
      const opLabel = spec.operation && win.operation ? ` — ${win.operation} operable` : '';
      lineItems.push({
        id: `window_${i}`,
        qty: win.qty || 1,
        description: `${spec.label}${opLabel}`,
        sku: spec.sku,
        unitPrice: price,
        total: price * (win.qty || 1),
      });
    });
  }

  // ── Garage doors ──────────────────────────────────────
  const gdResult = calculateGarageDoors(garageDoorItems || []);
  gdResult.lineItems.forEach((item, i) => {
    lineItems.push({
      id: `garage_door_${i}`,
      qty: item.qty,
      description: item.description,
      unitPrice: item.unitPrice,
      total: item.total,
      isTBD: item.isTBD || false,
      flag: item.flag || null,
      isGarageDoor: true,
    });
  });

  // ── Add-ons: Wood Build Shop Doors ────────────────────
  const shopDoorPrices = siding === 'vinyl'
    ? CONFIG.SHOP_DOOR_PRICES_VINYL
    : CONFIG.SHOP_DOOR_PRICES_LP;
  const shopDoorLabels = { 32: '32in Single', 36: '36in Single', 64: '64in Double', 72: '72in Double' };
  if (shopDoors) {
    [32, 36, 64, 72].forEach(w => {
      const qty = shopDoors[w] || 0;
      if (qty < 1) return;
      const unitPrice = applyOverride(priceOverrides, `shop_door_${w}`, shopDoorPrices[w] || 0);
      lineItems.push({
        id: `shop_door_${w}`,
        qty,
        description: `${shopDoorLabels[w]} Wood Build Shop Door — ${siding === 'vinyl' ? 'vinyl' : 'LP'} inlay`,
        unitPrice,
        total: unitPrice * qty,
      });
    });
  }

  // ── Add-ons: Ramps ────────────────────────────────────
  if (rampSelections) {
    Object.entries(rampSelections).forEach(([key, sel]) => {
      if (!sel || (sel.qty || 0) < 1) return;
      const isGD    = key.startsWith('gd_');
      const width   = parseInt(key.split('_')[1]);
      const length  = sel.length || 4;
      const pTable  = isGD ? CONFIG.RAMP_PRICES_GD : CONFIG.RAMP_PRICES_SHOP;
      const unitPrice = applyOverride(priceOverrides, `ramp_${key}_${length}`,
        pTable?.[width]?.[length] || 0);
      const framing = isGD ? '2×6 PT' : '2×4 PT';
      const srcLabel = isGD
        ? `${width}ft Garage Door`
        : `${shopDoorLabels[width] || width + 'in'} Shop Door`;
      lineItems.push({
        id: `ramp_${key}_${length}`,
        qty: sel.qty,
        description: `${length}ft Ramp — ${srcLabel} · ${framing} framing · PT decking`,
        unitPrice,
        total: unitPrice * sel.qty,
      });
    });
  }

  // ── Loft ──────────────────────────────────────────────
  const useLoftNew = loftRequested !== undefined;
  const showLoft   = useLoftNew ? loftRequested : (addons && addons.loftFlag);
  if (showLoft) {
    const loftAvail = useLoftNew ? getLoftAvailability(style, width) : null;
    const loftDesc  = loftAvail
      ? `Loft — included, final price at walkthrough${loftAvail.headroomNote ? ' (' + loftAvail.headroomNote.split('.')[0] + ')' : ''}`
      : 'Loft — size and height dependent';
    lineItems.push({
      id: 'loft',
      qty: 1,
      description: loftDesc,
      unitPrice: null,
      total: null,
      flag: 'TBD — confirmed at walkthrough before finalizing quote.',
      isTBD: true,
    });
  }

  // ── Shelving ──────────────────────────────────────────
  const useShelvingNew = shelvingSpec && shelvingSpec.enabled && shelvingSpec.linearFt > 0;
  if (useShelvingNew) {
    const longestWall = Math.max(width, length);
    const shelf = calculateShelving(shelvingSpec.linearFt, shelvingSpec.material || 'osb', longestWall);
    lineItems.push({
      id: 'shelving',
      qty: 1,
      description: shelf.description,
      unitPrice: shelf.materialCost,
      total: shelf.materialCost,
      shelvingData: shelf,
      flag: shelf.fitsWarning || undefined,
    });
  } else if (addons && addons.shelvingFlag) {
    lineItems.push({
      id: 'shelving',
      qty: 1,
      description: 'Shelving — 2x framing + OSB',
      unitPrice: null,
      total: null,
      flag: 'TBD — quote per linear foot.',
      isTBD: true,
    });
  }

  // Demo
  let demoPrice = 0, concreteCost = 0;
  if (demo && demo.enabled && demo.width && demo.length) {
    const demoSqft = demo.width * demo.length;
    demoPrice = applyOverride(priceOverrides, 'demo', calculateDemoPrice(demoSqft));
    lineItems.push({
      id: 'demo',
      qty: 1,
      description: `Demo — existing ${demo.width}×${demo.length}ft shed (${demoSqft} sqft)`,
      unitPrice: demoPrice,
      total: demoPrice,
      flag: 'Demo pricing assumes standard wood-frame shed, no concrete, accessible by truck.',
    });
    if (demo.concrete) {
      const rate = demo.concreteRateSqft || CONFIG.CONCRETE_REMOVAL_RATE_PER_SQFT;
      concreteCost = applyOverride(priceOverrides, 'demo_concrete', Math.round(demoSqft * rate));
      lineItems.push({
        id: 'demo_concrete',
        qty: 1,
        description: `Concrete slab removal — ${demoSqft} sqft @ $${rate.toFixed(2)}/sqft`,
        unitPrice: concreteCost,
        total: concreteCost,
        flag: 'Concrete removal varies by thickness, reinforcement, and haul distance. Verify on-site.',
      });
    }
  }

  // Slab & no-floor (UPDATE 2026-04-17)
  let slabCost = 0, noFloorCredit = 0;
  if (slab && slab.enabled) {
    const rate = Number(slab.ratePerSqft) || CONFIG.SLAB_DEFAULT_RATE_PER_SQFT;
    slabCost = applyOverride(priceOverrides, 'slab', Math.round(sqft * rate));
    lineItems.push({
      id: 'slab',
      qty: sqft,
      description: `Concrete slab — ${sqft} sqft @ $${rate}/sqft`,
      unitPrice: rate,
      total: slabCost,
      isInternalOnly: true,
      rollIntoBase: true,
    });
    if (slab.noWoodFloor) {
      const deductRate = CONFIG.NO_FLOOR_DEDUCT_RATE_PER_SQFT;
      noFloorCredit = applyOverride(priceOverrides, 'no_floor', -Math.round(sqft * deductRate));
      lineItems.push({
        id: 'no_floor',
        qty: sqft,
        description: `No wood floor — credit ${sqft} sqft @ $${deductRate}/sqft (interim rate)`,
        unitPrice: -deductRate,
        total: noFloorCredit,
        isInternalOnly: true,
        rollIntoBase: true,
      });
    }
  }

  // Manual line items (internal mode)
  (manualItems || []).forEach((item, i) => {
    lineItems.push({
      id: `manual_${i}`,
      qty: item.qty || 1,
      description: item.description,
      unitPrice: item.price,
      total: (item.qty || 1) * item.price,
      isManual: true,
    });
  });

  // ── Grand total ────────────────────────────────────────
  const total = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);

  // ── Auto-generated notes ────────────────────────────────
  const autoNotes = generateAutoNotes({ roof, addons, conditioning, roofSheathing, wallSheathing, loftRequested, shelvingSpec, garageDoorItems, gdResult });

  // ── Payment terms ──────────────────────────────────────
  const paymentNote = selectPaymentTerms(total, paymentTier);

  return {
    estimateNumber: estimateNumber || getNextEstimateNumber(customer.name?.[0]),
    date: formatDate(),
    customer: { ...customer },
    company: {
      name:    CONFIG.COMPANY_NAME,
      tagline: CONFIG.COMPANY_TAGLINE,
      address: CONFIG.COMPANY_ADDRESS,
      city:    CONFIG.COMPANY_CITY,
      email:   CONFIG.COMPANY_EMAIL,
      phone:   CONFIG.COMPANY_PHONE,
      website: CONFIG.COMPANY_WEBSITE,
    },
    building: { style, styleLabel: ANCHOR[style]?.label || style, width, length, sqft, wallHeight, roof, siding, conditioningLevel, roofPitch: CONFIG.ROOF_PITCH_LABEL,
      roofColor: inputs.roofColor || null, roofColorLabel, isAutoColor },
    materials,
    conditioning,
    roofSheathing: roofSheathing || null,
    wallSheathing: wallSheathing || null,
    lineItems,
    pricing: {
      basePrice, vinylAddon, metalRoofAddon,
      conditioningCost: conditioning.totalCost,
      roofSheathingCost: roofSheathing?.totalCost || 0,
      wallSheathingCost: wallSheathing?.totalCost || 0,
      iceWaterCost: iceWaterResult.totalCost,
      demoPrice, concreteCost, slabCost, noFloorCredit, total,
    },
    autoNotes,
    internalNotes: internalNotes || '',
    slabSpec: (slab && slab.enabled) ? CONFIG.SLAB_SPEC_TEXT  : null,
    slabNote: (slab && slab.enabled) ? CONFIG.SLAB_CAVEAT_NOTE : null,
    paymentNote,
    paymentTier: paymentTier || 'standard',
    condensationWarning: roof === 'metal' && conditioningLevel === 0 && (!roofSheathingOption || roofSheathingOption === 'none'),
  };
}

function applyOverride(overrides, id, defaultVal) {
  if (overrides && overrides[id] !== undefined) return Number(overrides[id]);
  return defaultVal;
}
