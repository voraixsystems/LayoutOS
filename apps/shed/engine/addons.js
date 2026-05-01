// ============================================================
// shed/addons.js — Shed Add-On Pricing & Availability
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================
// PURPOSE: Price and describe everything that is NOT the base
//   shed shell — vinyl siding upgrade, conditioning packages,
//   sheathing upgrades (roof & walls), shelving, loft, demo.
//
// API (exported):
//   calculateVinylAddon(sqft)
//     Flat add-on $ by floor sqft. Tiers in CONFIG.VINYL_TIERS.
//   calculateDemoPrice(sqft)
//     Flat demo $ by shed sqft. Tiers in CONFIG.DEMO_TIERS.
//   getConditioningPackage(level, materials, styleKey)
//     level 0=none, 1=vapor barrier, 2=standard, 3=max.
//     Returns { label, lineItems, totalCost, notes }.
//   calculateRoofSheathing(option, materials)
//     For metal roofs. option: 'none'|'vb_only'|'osb'|'zip'.
//   calculateWallSheathing(option, materials)
//     For vinyl siding. option: 'none'|'house_wrap'|'zip'.
//   calculateShelving(linearFt, materialOption, longestWall)
//     36in AFF, 2ft deep, 2x4 framing. 'osb'|'plywood'.
//   getLoftAvailability(styleKey, width)
//     Loft is MANUAL QUOTE only — this just determines whether
//     it is OFFERED (gambrel always, gable requires ≥7/12 pitch).
//
// INTERNAL (not exported): calcConditioningCosts,
//   formatConditioningLineItems. Split so cost math has no
//   UI strings and description formatting has no math.
//
// Depends on: shed/config.js (CONFIG), shed/prices.js (getPrices).
// Consumed by: shed/build-quote.js, shed-logic.js (facade).
// ============================================================

import { CONFIG } from './config.js';
import { getPrices } from './prices.js';

// ------------------------------------------------------------
// calculateVinylAddon(sqft)
// Returns flat add-on dollar amount based on floor sqft.
// Tiers are defined in CONFIG.VINYL_TIERS — edit there, not here.
// ------------------------------------------------------------
export function calculateVinylAddon(sqft) {
  const { breakpoints, prices } = CONFIG.VINYL_TIERS;
  for (let i = 0; i < breakpoints.length; i++) {
    if (sqft <= breakpoints[i]) return prices[i];
  }
  return prices[prices.length - 1];
}

// ------------------------------------------------------------
// calculateDemoPrice(sqft)
// Flat rate demo pricing by shed size being demolished.
// Assumes standard wood-frame, no concrete, truck-accessible.
// Tiers are defined in CONFIG.DEMO_TIERS — edit there, not here.
// ------------------------------------------------------------
export function calculateDemoPrice(sqft) {
  const { breakpoints, prices } = CONFIG.DEMO_TIERS;
  for (let i = 0; i < breakpoints.length; i++) {
    if (sqft <= breakpoints[i]) return prices[i];
  }
  return prices[prices.length - 1];
}

// ------------------------------------------------------------
// getRoofConditioning(roofCond, materials, roofType)
// roofCond: 'none' | 'felt' | 'felt_icw' | 'zip'
// Returns { lineItems[], totalCost, notes[] }
// ------------------------------------------------------------
export function getRoofConditioning(roofCond, materials) {
  const p = getPrices();
  const lineItems = [];
  let totalCost = 0;
  const notes = [];

  if (!roofCond || roofCond === 'none') return { lineItems, totalCost, notes };

  if (roofCond === 'felt' || roofCond === 'felt_icw') {
    const feltRolls = Math.ceil(materials.roofSqft / CONFIG.FELT_COVERAGE_SQFT_PER_ROLL);
    const feltCost  = feltRolls * p.felt_roll;
    lineItems.push({
      description: `Felt underlayment — roof (${feltRolls} rolls)`,
      qty: feltRolls, unit: 'roll', unitPrice: p.felt_roll, total: feltCost,
      isRoofConditioning: true,
    });
    totalCost += feltCost;
    notes.push('Felt underlayment — moisture barrier under shingles or metal.');
  }

  if (roofCond === 'felt_icw') {
    const icwRolls = Math.ceil((materials.roofLength * 6) / 225);
    const icwCost  = icwRolls * (p.ice_water_shield_roll || 250);
    lineItems.push({
      description: `Ice & water shield — lower 6ft eaves (${icwRolls} rolls)`,
      qty: icwRolls, unit: 'roll', unitPrice: p.ice_water_shield_roll || 250, total: icwCost,
      isRoofConditioning: true,
    });
    totalCost += icwCost;
    notes.push('Ice & water shield on lower 6ft — recommended in freeze-thaw climates.');
  }

  if (roofCond === 'zip') {
    const roofZipCost  = materials.roofSheets    * p.zip_roof_sheet;
    const roofTapeCost = materials.roofTapeRolls * p.zip_tape_roll;
    lineItems.push({
      description: `Zip System 5/8" roof sheathing (${materials.roofSheets} sheets)`,
      qty: materials.roofSheets, unit: 'sheet', unitPrice: p.zip_roof_sheet, total: roofZipCost,
      isRoofConditioning: true,
    });
    lineItems.push({
      description: `Zip tape — roof (${materials.roofTapeRolls} rolls)`,
      qty: materials.roofTapeRolls, unit: 'roll', unitPrice: p.zip_tape_roll, total: roofTapeCost,
      isRoofConditioning: true,
    });
    totalCost += roofZipCost + roofTapeCost;
    notes.push('Zip System roof — airtight sealing for conditioned spaces.');
  }

  return { lineItems, totalCost: Math.round(totalCost), notes };
}

// ------------------------------------------------------------
// getWallConditioning(wallCond, materials, sidingType)
// wallCond: 'none' | 'vb' | 'tyvek' | 'zip'
// Returns { lineItems[], totalCost, notes[] }
// ------------------------------------------------------------
export function getWallConditioning(wallCond, materials) {
  const p = getPrices();
  const lineItems = [];
  let totalCost = 0;
  const notes = [];

  if (!wallCond || wallCond === 'none') return { lineItems, totalCost, notes };

  if (wallCond === 'vb') {
    const vbRolls = materials.vaporBarrierRolls;
    const vbCost  = vbRolls * p.vapor_barrier_roll;
    lineItems.push({
      description: `Vapor barrier — walls (${vbRolls} rolls)`,
      qty: vbRolls, unit: 'roll', unitPrice: p.vapor_barrier_roll, total: vbCost,
      isWallConditioning: true,
    });
    totalCost += vbCost;
    notes.push('Vapor barrier — recommended for heated buildings.');
  }

  if (wallCond === 'tyvek') {
    const wrapQty  = Math.max(1, Math.ceil(materials.totalWallSqft / CONFIG.HOUSEWRAP_COVERAGE_SQFT_PER_ROLL));
    const wrapCost = wrapQty * p.house_wrap_roll;
    lineItems.push({
      description: `House wrap — walls (${wrapQty} rolls)`,
      qty: wrapQty, unit: 'roll', unitPrice: p.house_wrap_roll, total: wrapCost,
      isWallConditioning: true,
    });
    totalCost += wrapCost;
    notes.push('House wrap (Tyvek) — air barrier, suitable for workshops.');
  }

  if (wallCond === 'zip') {
    const wallZipCost  = materials.wallSheets    * p.zip_wall_sheet;
    const wallTapeCost = materials.wallTapeRolls * p.zip_tape_roll;
    lineItems.push({
      description: `Zip System 7/16" wall sheathing (${materials.wallSheets} sheets)`,
      qty: materials.wallSheets, unit: 'sheet', unitPrice: p.zip_wall_sheet, total: wallZipCost,
      isWallConditioning: true,
    });
    lineItems.push({
      description: `Zip tape — walls (${materials.wallTapeRolls} rolls)`,
      qty: materials.wallTapeRolls, unit: 'roll', unitPrice: p.zip_tape_roll, total: wallTapeCost,
      isWallConditioning: true,
    });
    totalCost += wallZipCost + wallTapeCost;
    notes.push('Zip System walls — airtight sealing for conditioned spaces.');
  }

  return { lineItems, totalCost: Math.round(totalCost), notes };
}

// ------------------------------------------------------------
// getIceWater(enabled, coverage, materials)
// Standalone ice & water shield — independent of roof conditioning.
// coverage: 'lower6' | 'full'
// Returns { lineItems[], totalCost, notes[] }
// ------------------------------------------------------------
export function getIceWater(enabled, coverage, materials) {
  if (!enabled) return { lineItems: [], totalCost: 0, notes: [] };
  const p = getPrices();
  const rolls = (coverage === 'full')
    ? Math.ceil(materials.roofSqft / CONFIG.ICW_SQFT_PER_ROLL)
    : Math.ceil((materials.roofLength * 6 * 2) / CONFIG.ICW_SQFT_PER_ROLL);
  const cost  = rolls * (p.ice_water_shield_roll || 250);
  const label = (coverage === 'full') ? 'full roof' : 'lower 6ft eaves';
  return {
    lineItems: [{
      description: `Ice & water shield — ${label} (${rolls} rolls)`,
      qty: rolls, unit: 'roll', unitPrice: p.ice_water_shield_roll || 250, total: cost,
      isIceWater: true,
    }],
    totalCost: Math.round(cost),
    notes: ['Ice & water shield — extra leak protection at eaves and valleys.'],
  };
}

// ------------------------------------------------------------
// getConditioningPackage() — LEGACY STUB
// Prior tier-based conditioning is replaced by getRoofConditioning +
// getWallConditioning. This stub prevents import errors in callers.
// ------------------------------------------------------------
export function getConditioningPackage() {
  return { label: 'None', lineItems: [], totalCost: 0, notes: [] };
}

// ------------------------------------------------------------
// calculateRoofSheathing(option, materials)
// Independent roof sheathing calc for metal roofs.
// option: 'none' | 'vb_only' | 'osb' | 'zip'
// Returns { lineItems[], totalCost, notes[] }
//
// Metal roof sheathing options:
//   none    — no additional sheathing (not recommended)
//   vb_only — vapor barrier rolls only
//   osb     — OSB sheets + fir strips (required over OSB)
//   zip     — Zip System roof panels + tape + fir strips
//
// Fir strips REQUIRED for both osb and zip — metal cannot
// screw to OSB or Zip directly. Strips at 24in OC.
// ------------------------------------------------------------
export function calculateRoofSheathing(option, materials) {
  if (!option || option === 'none') {
    return { lineItems: [], totalCost: 0, notes: [] };
  }
  const p = getPrices();
  const lineItems = [];
  let totalCost = 0;
  const notes = [];

  if (option === 'vb_only') {
    // Vapor barrier only — 500 sqft per roll, 15% overlap
    const rolls = Math.ceil((materials.roofSqft * CONFIG.VB_OVERLAP_FACTOR) / CONFIG.VAPOR_BARRIER_SQFT_PER_ROLL);
    const cost  = rolls * p.vapor_barrier_roll;
    lineItems.push({
      key: 'vb_roof', qty: rolls, unit: 'roll',
      unitPrice: p.vapor_barrier_roll, total: cost,
      description: `Vapor barrier — roof (${rolls} rolls)`,
    });
    totalCost += cost;
    notes.push('Vapor barrier prevents condensation drip on heated or regularly used buildings.');
  }

  if (option === 'osb') {
    // OSB sheets + fir strips (REQUIRED over OSB)
    const sheets = Math.ceil(materials.roofSqft / CONFIG.SHEET_SQFT);
    const sheetCost = sheets * (p.osb_sheet || p.osb_7_16_sheet);
    lineItems.push({
      key: 'osb_roof', qty: sheets, unit: 'sheet',
      unitPrice: p.osb_sheet || p.osb_7_16_sheet, total: sheetCost,
      description: `OSB 7/16" roof sheathing (${sheets} sheets)`,
    });
    totalCost += sheetCost;

    const strips = Math.round(materials.furStripsLF);
    const stripCost = strips * p.fir_strip_per_lf;
    lineItems.push({
      key: 'fir_strips_roof', qty: strips, unit: 'LF',
      unitPrice: p.fir_strip_per_lf, total: stripCost,
      description: `Fir furring strips 24in OC — roof (${strips} LF)`,
    });
    totalCost += stripCost;
    notes.push('OSB sheathing with fir strips. Metal panels screw to strips — not directly to OSB.');
  }

  if (option === 'zip') {
    // Zip System roof (brown 5/8) + tape + fir strips
    const sheets   = Math.ceil(materials.roofSqft / CONFIG.SHEET_SQFT);
    const tape     = Math.ceil(sheets / CONFIG.ZIP_TAPE_SHEETS_PER_ROLL);
    const sheetCost = sheets * p.zip_roof_sheet;
    const tapeCost  = tape   * p.zip_tape_roll;
    lineItems.push({
      key: 'zip_roof', qty: sheets, unit: 'sheet',
      unitPrice: p.zip_roof_sheet, total: sheetCost,
      description: `Zip System 5/8" roof sheathing (${sheets} sheets)`,
    });
    lineItems.push({
      key: 'zip_roof_tape', qty: tape, unit: 'roll',
      unitPrice: p.zip_tape_roll, total: tapeCost,
      description: `Zip tape — roof (${tape} rolls)`,
    });
    totalCost += sheetCost + tapeCost;

    const strips = Math.round(materials.furStripsLF);
    const stripCost = strips * p.fir_strip_per_lf;
    lineItems.push({
      key: 'fir_strips_roof', qty: strips, unit: 'LF',
      unitPrice: p.fir_strip_per_lf, total: stripCost,
      description: `Fir furring strips 24in OC — roof (${strips} LF)`,
    });
    totalCost += stripCost;
    notes.push('Zip System roof sheathing — most airtight assembly. Fir strips required over Zip for metal attachment.');
  }

  return { lineItems, totalCost: Math.round(totalCost), notes };
}

// ------------------------------------------------------------
// calculateWallSheathing(option, materials)
// Independent wall sheathing calc for vinyl siding only.
// option: 'none' | 'house_wrap' | 'zip'
// LP siding: no wall sheathing options (wood over wood not applicable)
//
// Wall sheathing options (vinyl only):
//   none       — OSB standard (included in vinyl add-on price)
//   house_wrap — add house wrap over OSB (upgrade)
//   zip        — Zip System wall panels + tape (replaces OSB + house wrap)
// ------------------------------------------------------------
export function calculateWallSheathing(option, materials) {
  if (!option || option === 'none') {
    return { lineItems: [], totalCost: 0, notes: [] };
  }
  const p = getPrices();
  const lineItems = [];
  let totalCost = 0;
  const notes = [];

  if (option === 'house_wrap') {
    const rolls = Math.max(1, Math.ceil(materials.totalWallSqft / CONFIG.HOUSEWRAP_COVERAGE_SQFT_PER_ROLL));
    const cost  = rolls * p.house_wrap_roll;
    lineItems.push({
      key: 'house_wrap', qty: rolls, unit: 'roll',
      unitPrice: p.house_wrap_roll, total: cost,
      description: `House wrap — walls (${rolls} rolls)`,
    });
    totalCost += cost;
    notes.push('House wrap over OSB. OSB is standard with vinyl siding.');
  }

  if (option === 'zip') {
    // Zip wall (green 7/16) + tape — replaces OSB + house wrap
    const sheets   = Math.ceil(materials.totalWallSqft / CONFIG.SHEET_SQFT);
    const tape     = Math.ceil(sheets / CONFIG.ZIP_TAPE_SHEETS_PER_ROLL);
    const sheetCost = sheets * p.zip_wall_sheet;
    const tapeCost  = tape   * p.zip_tape_roll;
    lineItems.push({
      key: 'zip_wall', qty: sheets, unit: 'sheet',
      unitPrice: p.zip_wall_sheet, total: sheetCost,
      description: `Zip System 7/16" wall sheathing (${sheets} sheets)`,
    });
    lineItems.push({
      key: 'zip_wall_tape', qty: tape, unit: 'roll',
      unitPrice: p.zip_tape_roll, total: tapeCost,
      description: `Zip tape — walls (${tape} rolls)`,
    });
    totalCost += sheetCost + tapeCost;
    notes.push('Zip System wall sheathing replaces OSB + house wrap. Most airtight wall assembly.');
  }

  return { lineItems, totalCost: Math.round(totalCost), notes };
}


// ------------------------------------------------------------
// calculateShelving(linearFt, materialOption, longestWall)
// Shelving formula: 36in AFF, 2ft deep, 2x4 framing.
// materialOption: 'osb' | 'plywood'
// longestWall: used for fit check
// Returns { sheets, framingLF, materialCost, fitsWarning, shelfSqft }
// Internal: $15/LF installed estimate (not shown to customer)
// Loft: manual quote only — separate line item with $0 / TBD
// ------------------------------------------------------------
export function calculateShelving(linearFt, materialOption, longestWall) {
  const p        = getPrices();
  const depth    = CONFIG.SHELVING_DEPTH_FT;
  const shelfSqft = linearFt * depth;
  const sheets   = Math.ceil(shelfSqft / CONFIG.SHEET_SQFT);
  const framingLF = linearFt * CONFIG.SHELVING_FRAMING_RUNS;

  const sheetPrice = materialOption === 'plywood'
    ? (p.premium_plywood_sheet || 50)
    : (p.osb_sheet || p.osb_7_16_sheet || 13);

  const materialCost = Math.round(
    sheets * sheetPrice + framingLF * CONFIG.FRAMING_2X4_COST_PER_LF
  );

  // Fit check — warn if shelf footage exceeds longest wall
  const fitsWarning = longestWall > 0 && linearFt > longestWall
    ? `Check wall fits this footage — longest wall is ${longestWall}ft`
    : null;

  const matLabel = materialOption === 'plywood' ? '3/4" plywood' : 'OSB';

  return {
    linearFt,
    depth,
    shelfSqft,
    sheets,
    framingLF,
    materialCost,
    fitsWarning,
    matLabel,
    description: `Shelving ${linearFt}ft — ${matLabel}`,
    sellPrice: null,  // labor-dominant — no formula; quote at walkthrough
  };
}

// ------------------------------------------------------------
// calculateGarageDoors(garageDoorItems)
// Computes line items for all garage door / framed opening entries.
// Each item: { category:'door'|'framing', spec, sealColor, keyedHandle, qty }
//
// Door total = material + install + (3 seals × $57) + optional keyed handle
// Framed opening = labor + header — no seals, no install charge
//
// Returns { lineItems[], totalCost, openingsSqft }
//   openingsSqft: total wall sqft removed by openings (for sheet deduction)
// ------------------------------------------------------------
export function calculateGarageDoors(garageDoorItems) {
  if (!garageDoorItems || garageDoorItems.length === 0) {
    return { lineItems: [], totalCost: 0, openingsSqft: 0 };
  }
  const p = getPrices();
  const lineItems = [];
  let openingsSqft = 0;

  garageDoorItems.forEach((item) => {
    const qty = item.qty || 1;

    if (item.category === 'framing') {
      const spec = CONFIG.FRAMED_OPENING_SPECS[item.spec];
      if (!spec) return;
      openingsSqft += (spec.openingSqft || 56) * qty;

      if (!spec.priceKey) {
        lineItems.push({
          category: 'framing', spec: item.spec, qty,
          description: 'Framed garage opening — custom size (framing only, client supplies door)',
          unitPrice: null, total: null, isTBD: true,
          flag: 'Custom size — dimensions confirmed at walkthrough. Client supplies door and installer.',
          lbwNote: false,
        });
        return;
      }

      const price = p[spec.priceKey] || 0;
      lineItems.push({
        category: 'framing', spec: item.spec, qty,
        description: `Framed Opening ${spec.label} — framing only, client-supplied door`,
        unitPrice: price,
        total: price * qty,
        flag: spec.lbwNote
          ? 'Load-bearing wall considerations may require structural upgrade — confirmed at walkthrough.'
          : null,
        lbwNote: spec.lbwNote,
      });
      return;
    }

    // Door
    const spec = CONFIG.GARAGE_DOOR_SPECS[item.spec];
    if (!spec) return;
    openingsSqft += (spec.openingSqft || 56) * qty;

    const doorMat   = p[spec.priceKey] || 0;
    const install   = p.garage_door_install || 350;
    const sealCount = CONFIG.GARAGE_DOOR_SEALS_PER_DOOR || 3;
    const sealPrice = p.garage_door_seal_9ft || 57;
    const sealTotal = sealCount * sealPrice;
    const handleAmt = item.keyedHandle ? (p.garage_door_keyed_handle || 50) : 0;
    const unitTotal = doorMat + install + sealTotal + handleAmt;

    const sealColor = item.sealColor === 'brown' ? 'brown' : 'white';
    let desc = `${spec.label} — complete install (${sealCount} ${sealColor} seals`;
    if (item.keyedHandle) desc += ', keyed entry handle';
    desc += ')';

    lineItems.push({
      category: 'door', spec: item.spec, qty,
      description: desc,
      unitPrice: unitTotal,
      total: unitTotal * qty,
      _breakdown: { doorMat, install, sealCount, sealTotal, sealColor, handleAmt },
    });
  });

  const totalCost = lineItems.reduce((sum, li) => sum + (li.total || 0), 0);
  return { lineItems, totalCost, openingsSqft };
}

// ------------------------------------------------------------
// getLoftAvailability(styleKey, width)
// Determines whether a loft is available on a given building.
// Loft: manual quote only — too variable for formula
// Attic trusses: separate structural quote, not in calculator
//
// Available when: gambrel style OR roof pitch >= 7/12
// Standard gable pitch is 5/12 — NOT available for loft
//
// Returns { available, headroomNote, atticTrussNote, overheadStorageNote }
// ------------------------------------------------------------
export function getLoftAvailability(styleKey, width) {
  const isGambrel = CONFIG.GAMBREL_ROOF_STYLES.includes(styleKey);
  // Standard gable pitch (5/12) < minimum for loft (7/12) — not available on gable styles
  const available = isGambrel;

  let headroomNote = null;
  let atticTrussNote = null;
  let overheadStorageNote = null;

  if (available) {
    if (width < CONFIG.LOFT_HEADROOM_MIN_WIDTH) {
      headroomNote = `Limited headroom at ${width}ft wide. Walkable loft recommended on 16ft+ widths.`;
    } else {
      headroomNote = `Full loft headroom available at ${width}ft wide.`;
    }
    if (width >= 20) {
      atticTrussNote = '20ft+ buildings may require attic trusses — separate structural quote.';
    }
  } else {
    overheadStorageNote = 'Loft not available on standard gable styles (5/12 pitch). Overhead storage shelving available — priced per linear foot.';
  }

  return { available, headroomNote, atticTrussNote, overheadStorageNote };
}
