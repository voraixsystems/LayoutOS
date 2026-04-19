// ============================================================
// shed/materials.js — Material Takeoffs & Sheet Counts
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================
// PURPOSE: Convert a shed's dimensions into counts of physical
//   materials — siding sheets, roof sheets, rafters, studs,
//   metal panels, fir strips, vapor barrier rolls, etc.
//   No money math here; pricing happens in pricing.js / addons.js
//   using these counts.
//
// API:
//   calculateMaterials(width, length, wallHeight, styleKey)
//     — Customer-visible counts (siding + roof + walls).
//       Returns { lpSheets, roofSheets, roofTapeRolls, ... }
//   calculateFraming(params)
//     — INTERNAL ONLY. Full framing takeoff — studs, rafters,
//       joists, sheathing. Never shown to customer.
//       See function header for full params shape.
//   calculateMetalPanels(materials, wallHeight)
//     — Corrected metal panel count. Panels are 3ft wide,
//       ordered to length — NOT 4x8 sheets.
//
// TEST CASES (do not break):
//   12x24 Deluxe, 8ft wall → lpSheets=19, roofSheets=13,
//     roofTapeRolls=2
//   12x24 Deluxe, Level 3  → furStripsLF=208
//
// Depends on: shed/config.js (CONFIG), shed/anchor.js (ANCHOR),
//   shed/prices.js (getPrices).
// Consumed by: shed/build-quote.js, shed-logic.js (facade).
// ============================================================

import { CONFIG } from './config.js';
import { ANCHOR } from './anchor.js';
import { getPrices } from './prices.js';

// ------------------------------------------------------------
// calculateMaterials(width, length, wallHeight, styleKey)
// Returns counts of all sheet/material quantities.
// Test cases (verify here):
//   12x24 Deluxe, 8ft wall → lpSheets=19, roofSheets=13, roofTapeRolls=2
//   12x24 Deluxe, Level 3  → furStripsLF=208
// ------------------------------------------------------------
export function calculateMaterials(width, length, wallHeight, styleKey) {
  const style = ANCHOR[styleKey] || ANCHOR.economy;
  const overhang = CONFIG[style.overhangKey]; // ft per side

  // ── Walls ──────────────────────────────────────────────
  const perimeter   = 2 * (width + length);
  const wallSqft    = perimeter * wallHeight;

  // Gable ends (triangles) at standard 5/12 pitch
  const gableRise   = (width / 2) * CONFIG.ROOF_PITCH_RISE_OVER_RUN;
  const gableSqft   = 2 * ((width * gableRise) / 2);   // = width * gableRise

  const totalWallSqft = wallSqft + gableSqft;
  const lpSheets      = Math.ceil(totalWallSqft / CONFIG.LP_SQFT_PER_SHEET);
  const wallSheets    = lpSheets;                        // same count for Zip/OSB

  // ── Roof ───────────────────────────────────────────────
  const halfSpan    = width / 2;
  const rise        = halfSpan * CONFIG.ROOF_PITCH_RISE_OVER_RUN;
  const slopeLength = Math.sqrt(halfSpan ** 2 + rise ** 2) + overhang;
  const roofLength  = length + (overhang * 2);
  const roofSqft    = slopeLength * roofLength * 2;     // both sides

  const shingleSquares  = Math.ceil(roofSqft / CONFIG.SHINGLE_SQFT_PER_SQUARE);
  const metalRoofSqft   = Math.ceil(roofSqft * CONFIG.METAL_WASTE_FACTOR);

  // ── Roof sheathing (Zip/OSB) ───────────────────────────
  const roofSheets      = Math.ceil(roofSqft / CONFIG.LP_SQFT_PER_SHEET);
  const roofTapeRolls   = Math.ceil(roofSheets / CONFIG.ZIP_TAPE_SHEETS_PER_ROLL);

  // ── Wall sheathing tape ────────────────────────────────
  const wallTapeRolls   = Math.ceil(wallSheets / CONFIG.ZIP_TAPE_SHEETS_PER_ROLL);

  // ── Fir strips — conditioned metal roof only, 24in OC ──
  // stripsPerSide = number of strip rows across one roof slope
  const stripsPerSide   = Math.ceil(slopeLength / (CONFIG.FIR_STRIP_SPACING_INCHES / 12));
  const furStripsLF     = stripsPerSide * roofLength * 2; // both sides

  // ── Vapor barrier ──────────────────────────────────────
  const vaporBarrierRolls = Math.ceil(roofSqft / CONFIG.VAPOR_BARRIER_SQFT_PER_ROLL);

  return {
    // dimensions derived
    perimeter,
    wallSqft,
    gableSqft,
    totalWallSqft,
    roofSqft: Math.round(roofSqft),
    slopeLength: Math.round(slopeLength * 100) / 100,
    roofLength,

    // LP siding
    lpSheets,

    // roof finish
    shingleSquares,
    metalRoofSqft,

    // sheathing (Zip or OSB)
    roofSheets,
    roofTapeRolls,
    wallSheets,
    wallTapeRolls,

    // furring strips (Level 3 only)
    stripsPerSide,
    furStripsLF: Math.round(furStripsLF),

    // vapor barrier (Level 1+)
    vaporBarrierRolls,
  };
}
// ------------------------------------------------------------
// calculateFraming(params)
// Full framing material takeoff — internal mode only.
// Never shown to customer. All quantities priced from getPrices().
//
// params: {
//   width, length, wallHeight, style
//   roofType          = 'shingle'  ('shingle'|'metal')
//   sidingType        = 'lp'       ('lp'|'vinyl')
//   pitch             = 5          rise-per-12in-run (5 = 5/12)
//   rafterSpacing     = 24         spacing in inches (16 or 24)
//   wallStudSize      = '2x4x8'   key prefix for prices.json lookup
//   roofSheathingOption = 'none'   ('none'|'vb_only'|'osb'|'zip')
//   wallSheathingOption = 'none'   ('none'|'house_wrap'|'zip')
// }
// ------------------------------------------------------------
export function calculateFraming(params) {
  const {
    width, length, wallHeight, style,
    roofType           = 'shingle',
    sidingType         = 'lp',
    pitch              = 5,
    rafterSpacing      = 24,
    wallStudSize       = '2x4x8',
    roofSheathingOption = 'none',
    wallSheathingOption = 'none',
  } = params;

  const p = getPrices();

  // ── FLOOR ──────────────────────────────────────────────────
  // Runners: 4×4×16 PT skids, staggered seams
  const runnerCount     = width <= 10 ? 2 : width <= 14 ? 3 : width <= 16 ? 4 : 5;
  const sticksPerRunner = Math.ceil(length / 16);
  const seamsPerRunner  = sticksPerRunner - 1;
  const totalSeams      = seamsPerRunner * runnerCount;
  const nailerCount     = totalSeams * 2;          // 2×4 nailer each side of every seam
  const nailerLF        = nailerCount * 2;          // 2ft each
  const runnerSticks    = sticksPerRunner * runnerCount;
  const runnerCost      = runnerSticks * (p['4x4x16_pt'] || 38);
  const nailerCost      = nailerLF * ((p['2x4x8_spf'] || 3.85) / 8);

  // Floor joists — 12in OC, spanning the width
  const joistSize        = width >= 14 ? '2x6' : '2x4';
  const joistStockLength = [8, 10, 12, 14, 16].find(l => l >= width) || 16;
  const joistKey         = `${joistSize}x${joistStockLength}_spf`;
  const joistCount       = Math.ceil(length / 1.0) + 1;
  const rimJoistCount    = 2;
  const joistCost        = (joistCount + rimJoistCount) * (p[joistKey] || 0);

  // Subfloor — 3/4 T&G AdvanTech
  const floorSqft      = width * length;
  const subfloorSheets = Math.ceil(floorSqft / 32);
  const subfloorCost   = subfloorSheets * (p['subfloor_sheet'] || 59.75);

  const floorTotal = Math.round(runnerCost + nailerCost + joistCost + subfloorCost);

  // ── WALLS ──────────────────────────────────────────────────
  // Studs at 16in OC — use floor(dim*12/16)+1 to avoid floating-point overshoot
  const studsLongWall  = Math.floor(length * 12 / 16) + 1;
  const studsShortWall = Math.floor(width  * 12 / 16) + 1;
  const totalStuds     = (studsLongWall * 2) + (studsShortWall * 2);

  const studKey  = `${wallStudSize}_spf`;
  const studCost = totalStuds * (p[studKey] || 0);

  const perimeter       = 2 * (width + length);
  const plateLF         = perimeter * 3;                 // 1 bottom + 2 top
  const plateStockLen   = 16;
  const platePcs        = Math.ceil(plateLF / plateStockLen);
  // Extract dimension prefix: '2x4x8' → '2x4', '2x6x10' → '2x6'
  const studDim         = wallStudSize.split('x').slice(0, 2).join('x');
  const plateKey        = `${studDim}x${plateStockLen}_spf`;
  const plateCost       = platePcs * (p[plateKey] || 0);

  const wallTotal = Math.round(studCost + plateCost);

  // ── ROOF ───────────────────────────────────────────────────
  const isGambrel       = ['mini', 'low', 'maxi', 'double'].includes(style);
  const rafterSpacingFt = rafterSpacing === 16 ? (16 / 12) : (24 / 12);
  const rafterPairsCount = Math.ceil(length / rafterSpacingFt) + 1;
  const totalRafters    = rafterPairsCount * 2;

  const rafterSizeMap = {
    economy: '2x4', carriage: '2x4',
    deluxe:  '2x6',
    mini:    '2x4',
    low:     width >= 14 ? '2x6' : '2x4',
    maxi:    '2x6',
    double:  '2x6',
  };
  const rafterSize        = rafterSizeMap[style] || '2x4';
  const halfSpan          = width / 2;
  const rise              = halfSpan * (pitch / 12);
  const slopeLength       = Math.sqrt(halfSpan * halfSpan + rise * rise);
  const rafterStockLength = [8, 10, 12, 14, 16].find(l => l >= slopeLength) || 16;
  const rafterKey         = `${rafterSize}x${rafterStockLength}_spf`;
  const rafterCost        = totalRafters * (p[rafterKey] || 0);

  // Ridge board — gable styles only
  const ridgeSize        = style === 'deluxe' ? '2x8' : '2x6';
  const ridgeStockLength = [8, 10, 12, 14, 16].find(l => l >= length) || 16;
  const ridgePcs         = isGambrel ? 0 : Math.ceil(length / ridgeStockLength);
  const ridgeKey         = `${ridgeSize}x${ridgeStockLength}_spf`;
  const ridgeCost        = ridgePcs * (p[ridgeKey] || 0);

  // Rake overhang — economy uses minimal 1.5in, carriage 6in, all others 12in
  const overhangFt = style === 'economy' ? 0.125 : style === 'carriage' ? 0.5 : 1.0;

  // Fascia — runs full roof length (building + overhang each end), both eaves
  const fasciaLength      = length + (overhangFt * 2);
  const fasciaStockLength = [8, 10, 12, 14, 16].find(l => l >= fasciaLength) || 16;
  const fasciaSticks      = Math.ceil(fasciaLength / fasciaStockLength) * 2 * 2;
  const fasciaKey         = `2x6x${fasciaStockLength}_spf`;
  const fasciaCost        = fasciaSticks * (p[fasciaKey] || p['2x6x16_spf'] || 18.52);

  // Collar ties — gable only, every other rafter pair
  // Length ≈ width × 0.5 (1/3 from peak) — flag for field verification
  const collarTieCount  = isGambrel ? 0 : Math.ceil(rafterPairsCount / 2);
  const collarTieLength = Math.max(Math.round(width * 0.5), 3);
  const collarTieStock  = [8, 10, 12, 14, 16].find(l => l >= collarTieLength) || 8;
  const collarTieKey    = `${rafterSize}x${collarTieStock}_spf`;
  const collarTieCost   = collarTieCount * (p[collarTieKey] || 0);

  // Ceiling joists — 16ft+ wide only, same spacing as rafters
  const hasCeilingJoists  = width >= 16;
  const ceilingJoistCount = hasCeilingJoists ? Math.ceil(length / rafterSpacingFt) + 1 : 0;
  const cjStockLength     = [8, 10, 12, 14, 16, 20].find(l => l >= width) || 16;
  const ceilingJoistKey   = `2x4x${cjStockLength}_spf`;
  const ceilingJoistCost  = ceilingJoistCount * (p[ceilingJoistKey] || 0);

  // Drip edge — 10ft sticks, all edges including rake overhang
  const roofLength   = length + (overhangFt * 2);
  const eaveDripLF   = roofLength * 2;
  const rakeDripLF   = (slopeLength + overhangFt) * 4;
  const totalDripLF  = eaveDripLF + rakeDripLF;
  const dripSticks   = Math.ceil(totalDripLF / 10);
  const dripCost     = dripSticks * (p['drip_edge_10ft'] || 9.98);

  const roofTotal = Math.round(rafterCost + ridgeCost + fasciaCost + collarTieCost + ceilingJoistCost + dripCost);

  // ── SHEATHING (quantities by roof+siding combination) ──────
  const gableRise       = (width / 2) * (pitch / 12);
  const gableSqftTotal  = (width * gableRise) * 2;
  const overhangSqft    = roofLength * overhangFt * 2;
  const wallSqft        = perimeter * wallHeight;
  const roofSqft        = slopeLength * roofLength * 2;

  // LP siding: covers walls + gables + overhang area
  const lpSqft    = wallSqft + gableSqftTotal + overhangSqft;
  const lpSheets  = Math.ceil(lpSqft / 32);

  // OSB/Zip wall (vinyl siding): same surface area as LP
  const osbWallSqft   = lpSqft;
  const osbWallSheets = Math.ceil(osbWallSqft / 32);
  const zipWallSheets = osbWallSheets;
  const zipWallTape   = Math.ceil(zipWallSheets / 8);

  // Roof sheathing quantities — always computed; display filtered by roofType+option
  const osbRoofSheets = Math.ceil(roofSqft / 32);
  const zipRoofSheets = osbRoofSheets;
  const zipRoofTape   = Math.ceil(zipRoofSheets / 8);

  // Fir strips — 24in OC under metal over OSB or Zip
  const furStripsLF = Math.round(Math.ceil(slopeLength / 2) * roofLength * 2);

  // VB rolls — roof (1.15 overlap factor)
  const vbSqftPerRoll = p['vapor_barrier_sqft_per_roll'] || CONFIG.VAPOR_BARRIER_SQFT_PER_ROLL || 500;
  const vbRoofRolls   = Math.ceil((roofSqft * (CONFIG.VB_OVERLAP_FACTOR || 1.15)) / vbSqftPerRoll);

  // Effective display quantities based on roofType / options
  const effectiveOsbRoof = (roofType === 'shingle' || (roofType === 'metal' && roofSheathingOption === 'osb'))
    ? osbRoofSheets : 0;
  const effectiveZipRoof = (roofType === 'metal' && roofSheathingOption === 'zip') ? zipRoofSheets : 0;
  const effectiveVbRoof  = (roofType === 'metal' && roofSheathingOption === 'vb_only') ? vbRoofRolls : 0;

  const totalMaterialCost = floorTotal + wallTotal + roofTotal;

  return {
    floor: {
      runnerCount, runnerSticks, runnerCost,
      nailerCount, nailerLF, nailerCost,
      joistSize, joistKey, joistStockLength, joistCount, rimJoistCount, joistCost,
      subfloorSheets, subfloorCost,
      floorSqft, floorTotal,
    },
    walls: {
      totalStuds, studKey, studCost,
      plateLF, platePcs, plateKey, plateCost,
      perimeter, wallSqft, wallTotal,
    },
    roof: {
      isGambrel, totalRafters, rafterSize, rafterStockLength, rafterKey, rafterCost,
      ridgeSize, ridgeStockLength, ridgePcs, ridgeCost,
      overhangFt, roofLength, slopeLength,
      fasciaLength, fasciaStockLength, fasciaSticks, fasciaCost,
      collarTieCount, collarTieLength, collarTieStock, collarTieKey, collarTieCost,
      hasCeilingJoists, ceilingJoistCount, cjStockLength, ceilingJoistKey, ceilingJoistCost,
      dripSticks, dripCost,
      roofSqft, roofTotal,
    },
    sheathing: {
      sidingType, roofType, roofSheathingOption, wallSheathingOption,
      lpSheets, lpSqft,
      osbWallSheets, osbWallSqft,
      osbRoofSheets, effectiveOsbRoof,
      zipRoofSheets, zipRoofTape, effectiveZipRoof,
      zipWallSheets, zipWallTape,
      furStripsLF, vbRoofRolls, effectiveVbRoof,
    },
    totalMaterialCost,
  };
}
// ------------------------------------------------------------
// calculateMetalPanels(materials)
// Corrected metal panel count — panels are 3ft wide, ordered
// to slope/wall length, NOT 4x8 sheets.
//
// Roof: panelLength = slopeLength rounded up to next standard
// Wall: panelLength = wallHeight (8 or 10ft, already standard)
// Standard lengths: 8, 10, 12, 14, 16ft
// Count = ceil(span / 3) per side/face
// ------------------------------------------------------------
export function calculateMetalPanels(materials, wallHeight) {
  const slopeLen = materials.slopeLength;
  const roofLen  = materials.roofLength;
  const perim    = materials.perimeter;

  // Cut-to-length: round up to nearest 0.5ft for ordering
  // (panels ordered by length at $/LF — not pulled from 8ft rack stock)
  const roofPanelCutLen = Math.ceil(slopeLen * 2) / 2;

  // Keep stock-length reference for legacy callers (next standard ≥ cut len)
  const standards    = CONFIG.METAL_PANEL_STANDARD_LENGTHS;
  const roofPanelLen = standards.find(l => l >= roofPanelCutLen) || standards[standards.length - 1];

  // Wall panel length = wallHeight (8 or 10ft — both are standards)
  const wallPanelLen = wallHeight;

  // Panel counts — one panel covers 3 linear feet of ridge
  const roofPanelCount = Math.ceil(roofLen / CONFIG.METAL_PANEL_WIDTH_FT) * 2; // both slopes
  const wallPanelCount = Math.ceil(perim   / CONFIG.METAL_PANEL_WIDTH_FT);

  // Total LF to order (cut-to-length basis)
  const roofTotalLF = roofPanelCount * roofPanelCutLen;

  // Coverage check
  const roofCovSqft = roofTotalLF * CONFIG.METAL_PANEL_WIDTH_FT;
  const wallCovSqft = wallPanelCount * CONFIG.METAL_PANEL_WIDTH_FT * wallPanelLen * CONFIG.METAL_WASTE_FACTOR;

  return {
    roofPanelCutLen,   // actual order length (cut to slope) — use this for display + pricing
    roofPanelLen,      // nearest stock length ≥ cut len (legacy reference)
    roofPanelCount,    // number of panels (both slopes combined)
    roofTotalLF,       // total LF to order = count × cutLen
    wallPanelLen,
    wallPanelCount,
    roofCovSqft: Math.ceil(roofCovSqft),
    wallCovSqft: Math.ceil(wallCovSqft),
  };
}
