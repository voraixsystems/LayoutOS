// ============================================================
// shed/build-quote.js — Quote Orchestrator
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================
// PURPOSE: The conductor. Takes raw user inputs from the UI
//   and produces a full, priced, ready-to-render quote object
//   by calling the other shed/* modules in the right order.
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
//     Returns the complete quote object that shed-output.html
//     renders from.
//
// INTERNAL helpers (not exported):
//   generateAutoNotes(quoteData)  — auto customer-facing notes
//   selectPaymentTerms(total, tierOverride)  — payment string
//   applyOverride(overrides, id, defaultVal) — per-item price
//     override lookup
//
// Depends on:
//   shed/config.js   (CONFIG)
//   shed/anchor.js   (ANCHOR — for description label lookup)
//   shed/prices.js   (getPrices)
//   shed/pricing.js  (getBasePrice)
//   shed/materials.js (calculateMaterials)
//   shed/addons.js   (calculateVinylAddon, calculateDemoPrice,
//                     getConditioningPackage,
//                     calculateRoofSheathing,
//                     calculateWallSheathing,
//                     calculateShelving, getLoftAvailability)
//   ../layoutos-core.js (getNextEstimateNumber, formatDate)
//
// Consumed by: shed-logic.js (facade re-export).
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
import { getNextEstimateNumber, formatDate } from '../layoutos-core.js';

// ------------------------------------------------------------
// generateAutoNotes(quoteData)
// Returns array of automatic customer-facing notes.
// Extracted from buildQuote() to keep that function clean.
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

  // Loft — new system (loftRequested) or legacy flag
  const hasLoft = loftRequested || (addons && addons.loftFlag);
  if (hasLoft) notes.push('Loft included — final price confirmed at walkthrough.');

  // Shelving — new system (shelvingSpec) or legacy flag
  const hasShelving = (shelvingSpec && shelvingSpec.enabled) || (addons && addons.shelvingFlag);
  if (hasShelving && !(shelvingSpec && shelvingSpec.enabled)) {
    // legacy flag
    notes.push('Shelving quoted per linear foot — contact for details.');
  }

  if (garageDoorItems && garageDoorItems.length > 0) {
    if (gdResult && gdResult.lineItems.some(li => li.lbwNote)) {
      notes.push('Load-bearing wall considerations may require structural upgrade on wide openings — confirmed at walkthrough.');
    }
  } else if (addons && addons.garageDoors > 0) {
    notes.push('Garage door material price varies — verify current Home Depot price before finalizing.');
  }

  notes.push(`Roof pitch: ${CONFIG.ROOF_PITCH_LABEL} standard. Non-standard pitch is available by request — contact us for pricing and engineering review.`);
  notes.push(CONFIG.DISCLAIMER);
  notes.push(CONFIG.DELIVERY_NOTE);

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
// Returns the correct payment note string.
// Extracted from buildQuote() to keep that function clean.
// ------------------------------------------------------------
function selectPaymentTerms(total, tierOverride) {
  return (tierOverride === 'three_tier' || total >= CONFIG.PAYMENT_LARGE_THRESHOLD)
    ? CONFIG.PAYMENT_LARGE_NOTE
    : CONFIG.PAYMENT_STANDARD;
}

// ------------------------------------------------------------
// buildQuote(inputs)
// inputs = {
//   style, width, length, wallHeight, roof, siding,
//   conditioningLevel, addons{ manDoors, windows,
//   garageDoors, ramps, loftFlag, shelvingFlag },
//   demo{ enabled, width, length },
//   customer{ name, address, email, phone },
//   internalNotes, paymentTier, priceOverrides{}, manualItems[]
// }
// Returns full quote object ready for shed-output.html
// ------------------------------------------------------------
export function buildQuote(inputs) {
  const {
    style, width, length, wallHeight, roof, siding,
    conditioningLevel, addons, demo, customer,
    internalNotes, paymentTier, priceOverrides, manualItems,
    estimateNumber,
    // New optional fields (UPDATE 2026-04-16)
    roofSheathingOption,  // 'none'|'vb_only'|'osb'|'zip' — for metal roofs
    wallSheathingOption,  // 'none'|'house_wrap'|'zip' — for vinyl siding only
    manDoorItems,         // [{type:'solid'|'9lite'|'fanlite', swing:'left'|'right', qty:n}]
    windowItems,          // [{type:'single_hung'|'sliding', operation:'left'|'right'|null, qty:n}]
    shelvingSpec,         // {enabled:bool, linearFt:n, material:'osb'|'plywood'}
    loftRequested,        // bool — replaces addons.loftFlag when present
    slab,                 // {enabled:bool, ratePerSqft:n, noWoodFloor:bool} — UPDATE 2026-04-17
    iceWater,             // {enabled:bool, coverage:'lower6'|'full'}
    garageDoorItems,      // [{category:'door'|'framing', spec, sealColor, keyedHandle, qty}]
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
  // +12% applied on (base + vinyl)
  let metalRoofAddon = 0;
  if (roof === 'metal') {
    metalRoofAddon = Math.round((basePrice + vinylAddon) * CONFIG.METAL_ROOF_MULTIPLIER);
  }

  // ── Conditioning package (legacy tier system — Step 6) ─
  const conditioning = getConditioningPackage(conditioningLevel, materials, style, roof);

  // ── Ice & water shield ─────────────────────────────────
  const iceWaterResult = getIceWater(iceWater?.enabled || false, iceWater?.coverage || 'lower6', materials);

  // ── New: independent roof sheathing (UPDATE 2026-04-16) ─
  // Only applies when metal roof selected. Supersedes conditioning
  // if roofSheathingOption is supplied by caller.
  const roofSheathing = (roof === 'metal' && roofSheathingOption && roofSheathingOption !== 'none')
    ? calculateRoofSheathing(roofSheathingOption, materials)
    : null;

  // ── New: independent wall sheathing (UPDATE 2026-04-16) ─
  // Only applies to vinyl siding and only when the new wallConditioning
  // selector is not active — wallConditioning owns wall assembly decisions.
  const wallSheathing = (siding === 'vinyl' && wallSheathingOption && wallSheathingOption !== 'none' && (!wallConditioning || wallConditioning === 'none'))
    ? calculateWallSheathing(wallSheathingOption, materials)
    : null;

  // ── Line items ─────────────────────────────────────────
  const lineItems = [];

  // Base shed shell
  lineItems.push({
    id: 'base',
    qty: 1,
    description: `${ANCHOR[style]?.label || style} — ${width}×${length}ft, ${wallHeight}ft walls`,
    unitPrice: applyOverride(priceOverrides, 'base', basePrice),
    total: applyOverride(priceOverrides, 'base', basePrice),
    isBase: true,
  });

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
    lineItems.push({
      id: 'metal_roof',
      qty: 1,
      description: 'Metal R-Panel roof upgrade (+12%)',
      unitPrice: applyOverride(priceOverrides, 'metal_roof', metalRoofAddon),
      total: applyOverride(priceOverrides, 'metal_roof', metalRoofAddon),
    });
  }

  // ── New: roof sheathing line items (if new system used) ─
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

  // ── New: wall sheathing line items (if new system used) ─
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

  // Conditioning package line items (legacy — stub returns empty; kept for safety)
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
    // New typed door system (UPDATE 2026-04-16)
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
  } else if (addons && addons.manDoors > 0) {
    // Legacy: single door type, no swing
    const price = applyOverride(priceOverrides, 'man_door', CONFIG.ADDON_MAN_DOOR);
    lineItems.push({
      id: 'man_door',
      qty: addons.manDoors,
      description: '36" insulated steel man door — installed',
      unitPrice: price,
      total: price * addons.manDoors,
    });
  }

  // ── Add-ons: Windows ───────────────────────────────────
  if (windowItems && windowItems.length > 0) {
    // New typed window system (UPDATE 2026-04-16)
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
  } else if (addons && addons.windows > 0) {
    // Legacy: single window type
    const price = applyOverride(priceOverrides, 'window', CONFIG.ADDON_WINDOW_24x27);
    lineItems.push({
      id: 'window',
      qty: addons.windows,
      description: '24×27 window — installed',
      unitPrice: price,
      total: price * addons.windows,
    });
  }

  // ── Garage doors (new typed system) ──────────────────────
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
  // Legacy fallback — qty-only system (no garageDoorItems supplied)
  if ((!garageDoorItems || garageDoorItems.length === 0) && addons && addons.garageDoors > 0) {
    const price = applyOverride(priceOverrides, 'garage_door', CONFIG.ADDON_GARAGE_DOOR_INSTALL);
    lineItems.push({
      id: 'garage_door',
      qty: addons.garageDoors,
      description: 'Garage door — install (verify current HD material price)',
      unitPrice: price,
      total: price * addons.garageDoors,
      flag: 'Verify current Home Depot material price before finalizing.',
    });
  }

  if (addons && addons.ramps > 0) {
    const price = applyOverride(priceOverrides, 'ramp', CONFIG.ADDON_RAMP_PER_OPENING);
    lineItems.push({
      id: 'ramp',
      qty: addons.ramps,
      description: 'Ramp — PT lumber, per 60in opening',
      unitPrice: price,
      total: price * addons.ramps,
    });
  }

  // ── Loft (new system or legacy flag) ──────────────────
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

  // ── Shelving (new formula or legacy flag) ─────────────
  const useShelvingNew = shelvingSpec && shelvingSpec.enabled && shelvingSpec.linearFt > 0;
  if (useShelvingNew) {
    const longestWall = Math.max(width, length);
    const shelf = calculateShelving(shelvingSpec.linearFt, shelvingSpec.material || 'osb', longestWall);
    lineItems.push({
      id: 'shelving',
      qty: 1,
      description: shelf.description,
      unitPrice: shelf.materialCost,   // material cost only — sell price TBD at walkthrough
      total: shelf.materialCost,
      shelvingData: shelf,
      flag: shelf.fitsWarning || undefined,
    });
  } else if (addons && addons.shelvingFlag) {
    // Legacy TBD flag
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

  // Slab & no-floor (UPDATE 2026-04-17) — shown as separate line items in
  // internal mode; rolled into base in client mode (see shed-output.html).
  // isInternalOnly flag lets the renderer decide display. Total always includes.
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
    date: formatDate(),    // "April 16, 2026" — long form via layoutos-core
    customer: { ...customer },
    // Company info embedded so shed-output.html is self-contained
    company: {
      name:    CONFIG.COMPANY_NAME,
      tagline: CONFIG.COMPANY_TAGLINE,
      address: CONFIG.COMPANY_ADDRESS,
      city:    CONFIG.COMPANY_CITY,
      email:   CONFIG.COMPANY_EMAIL,
      phone:   CONFIG.COMPANY_PHONE,
      website: CONFIG.COMPANY_WEBSITE,
    },
    building: { style, width, length, sqft, wallHeight, roof, siding, conditioningLevel, roofPitch: CONFIG.ROOF_PITCH_LABEL },
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

// Helper: apply a price override if one exists for this id
function applyOverride(overrides, id, defaultVal) {
  if (overrides && overrides[id] !== undefined) return Number(overrides[id]);
  return defaultVal;
}