// ============================================================
// shed-quote/internal.js — Framing Panel & Dev Mode
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================

import { state } from './core.js';
import { calculateFraming, calculateMaterials, calculateMetalPanels, formatMoney, getPrices, ANCHOR, CONFIG } from '../shed-logic.js';

// ── Framing panel (internal mode only) ───────────────────
window.onFramingConfigChange = function() {
  state.wallStudSize  = document.getElementById('fp-stud-size')?.value    || '2x4x8';
  state.rafterSpacing = parseInt(document.getElementById('fp-rafter-spacing')?.value) || 24;
  window.renderFramingPanel();
};

function getGdOpeningsSqft() {
  const items = state.garageDoorItems || [];
  return items.reduce((sum, item) => {
    const qty  = item.qty || 1;
    const spec = item.category === 'framing'
      ? CONFIG.FRAMED_OPENING_SPECS?.[item.spec]
      : CONFIG.GARAGE_DOOR_SPECS?.[item.spec];
    return sum + (spec?.openingSqft || 56) * qty;
  }, 0);
}

window.renderFramingPanel = function() {
  const body = document.getElementById('framing-panel-body');
  if (!body) return;

  if (!state.style || !state.width || !state.length) {
    body.innerHTML = '<div style="color:var(--muted);font-style:italic;padding:12px 0;font-size:12px">Select a style and size to see framing takeoff.</div>';
    return;
  }

  let fr;
  try {
    fr = calculateFraming({
      width:               state.width,
      length:              state.length,
      wallHeight:          state.wallHeight,
      style:               state.style,
      roofType:            state.roof,
      sidingType:          state.siding,
      pitch:               5,
      rafterSpacing:       state.rafterSpacing,
      wallStudSize:        state.wallStudSize,
      roofSheathingOption: state.roofSheathingOption,
      wallSheathingOption: state.wallSheathingOption,
    });
  } catch(e) {
    body.innerHTML = `<div style="color:var(--red);font-size:12px">Calc error: ${e.message}</div>`;
    return;
  }

  const p  = getPrices();
  const m  = calculateMaterials(state.width, state.length, state.wallHeight, state.style);
  const fm = n => `$${Math.round(n).toLocaleString()}`;

  const noFloor = !!(state.slab?.enabled && state.slab?.noWoodFloor);

  const row = (item, size, qty, unitPrice, excluded = false) => {
    const total = qty * unitPrice;
    const cls   = excluded ? ' fp-excluded' : '';
    return `<div class="fp-row${cls}">
      <span class="fp-item">${item}</span>
      <span class="fp-size">${size}</span>
      <span class="fp-qty">${qty}</span>
      <span class="fp-unit">${unitPrice > 0 ? fm(unitPrice) : '—'}</span>
      <span class="fp-total">${total > 0 ? fm(total) : '—'}</span>
    </div>`;
  };
  const header = () =>
    `<div class="fp-row fp-header">
      <span class="fp-item">Item</span>
      <span class="fp-size">Size / Spec</span>
      <span class="fp-qty">Qty</span>
      <span class="fp-unit">Unit $</span>
      <span class="fp-total">Total</span>
    </div>`;
  const sub = (label, cost) =>
    `<div class="fp-subtotal"><span>${label}</span><span>${fm(cost)}</span></div>`;
  const fmtKey = k => k.replace(/_spf|_pt/g,'').replace(/x/g,'×');

  const { floor: fl, walls: wa, roof: ro, sheathing: sh } = fr;

  let html = `<div class="fp-building-header">
    <strong>${ANCHOR[state.style]?.label || state.style}</strong>
    &nbsp;${state.width}×${state.length}ft · ${state.wallHeight}ft walls
    · ${state.roof === 'metal' ? 'Metal R-Panel' : 'Arch. Shingle'}
    · ${state.siding === 'vinyl' ? 'Vinyl' : 'LP SmartSide'}
  </div>`;

  // ── FLOOR ────────────────────────────────────────────────
  const sectionTitleFloor = noFloor
    ? `Floor <span style="font-size:10px;color:var(--amber);font-weight:600;margin-left:6px">EXCLUDED — slab / no wood floor</span>`
    : 'Floor';
  html += `<div class="fp-section"><div class="fp-section-title">${sectionTitleFloor}</div>`;
  html += header();
  // Skids — 4×4 PT
  const sk = fl.skids;
  const skidSizeLabel = Object.entries(sk.piecesPerRow)
    .sort(([a], [b]) => b - a)
    .map(([size, qty]) => `${size}ft×${qty * sk.rowCount}`)
    .join('  ');
  const avgSkidUnit = sk.totalPieces > 0 ? Math.round(sk.skidCost / sk.totalPieces) : 0;
  html += row(
    `Skids <span style="font-size:10px;color:var(--muted)">${sk.rowCount} rows · ${sk.totalPieces} pcs · ${sk.totalLFT} LFT<br>${skidSizeLabel}<br>↳ stagger rows</span>`,
    '4×4 PT', sk.totalPieces, avgSkidUnit, noFloor
  );
  if (fl.nailerCount > 0) {
    html += row('Nailers', '2×4 cutoffs', fl.nailerCount,
      Math.round(fl.nailerCost / fl.nailerCount), noFloor);
  }
  const joistTotal = fl.joistCount + fl.rimJoistCount;
  html += row('Joists', fmtKey(fl.joistKey), joistTotal,
    p[fl.joistKey] || Math.round(fl.joistCost / joistTotal), noFloor);
  html += row('Subfloor', '¾" T&G 4×8', fl.subfloorSheets, p.subfloor_sheet || 59.75, noFloor);
  if (noFloor) {
    html += `<div class="fp-subtotal fp-excluded"><span>Floor Total — excluded from cost</span><span>$0</span></div>`;
  } else {
    html += sub('Floor Total', fl.floorTotal);
  }
  html += `</div>`;

  // ── WALLS ────────────────────────────────────────────────
  let wallCladdingCost = 0;
  html += `<div class="fp-section"><div class="fp-section-title">Walls</div>`;
  html += header();
  html += row('Studs', fmtKey(wa.studKey), wa.totalStuds,
    p[wa.studKey] || Math.round(wa.studCost / wa.totalStuds));
  html += row('Plates', `${fmtKey(wa.plateKey)} 3× perim`, wa.platePcs,
    p[wa.plateKey] || Math.round(wa.plateCost / wa.platePcs));
  const gdOpenSqft = getGdOpeningsSqft();
  const gdDeducted = gdOpenSqft > 0 ? Math.floor(gdOpenSqft / (CONFIG.SHEET_SQFT || 32)) : 0;
  if (sh.sidingType === 'lp') {
    const lpUnit = p.lp_smartside_sheet || 50;
    html += row('LP SmartSide', '8in OC 4×8', sh.lpSheets, lpUnit);
    wallCladdingCost += sh.lpSheets * lpUnit;
    if (gdDeducted > 0) {
      const netLP   = sh.lpSheets - gdDeducted;
      const savedLP = gdDeducted * lpUnit;
      wallCladdingCost -= savedLP;
      html += `<div class="fp-flag" style="color:#16a34a">Garage openings: −${gdDeducted} sheet${gdDeducted !== 1 ? 's' : ''} (${gdOpenSqft} sqft) → order ${netLP} LP sheets · save ~${fm(savedLP)}</div>`;
    }
  } else {
    const osbUnit = p.osb_sheet || 13;
    html += row('OSB walls+gable', '7/16" 4×8', sh.osbWallSheets, osbUnit);
    wallCladdingCost += sh.osbWallSheets * osbUnit;
    if (gdDeducted > 0) {
      const netOSB   = sh.osbWallSheets - gdDeducted;
      const savedOSB = gdDeducted * osbUnit;
      wallCladdingCost -= savedOSB;
      html += `<div class="fp-flag" style="color:#16a34a">Garage openings: −${gdDeducted} sheet${gdDeducted !== 1 ? 's' : ''} → order ${netOSB} OSB sheets · save ~${fm(savedOSB)}</div>`;
    }
    if (sh.wallSheathingOption === 'zip') {
      const cz = sh.osbWallSheets * (p.zip_wall_sheet || 50);
      const ct = sh.zipWallTape   * (p.zip_tape_roll  || 39);
      html += row('Zip wall sheets', '7/16" 4×8', sh.osbWallSheets, p.zip_wall_sheet || 50);
      html += row('Zip wall tape',   '3¾" roll',  sh.zipWallTape,   p.zip_tape_roll  || 39);
      wallCladdingCost += cz + ct;
    }
    if (state.siding === 'vinyl') {
      const vinylSq = Math.ceil((m.wallSqft || m.totalWallSqft || 0) / 100);
      html += row('Vinyl siding', `${vinylSq} sq`, 1, 0);
      html += `<div class="fp-flag">Vinyl priced as flat add-on in quote — not in material cost here</div>`;
    }
  }
  html += sub('Walls Total', wa.wallTotal + wallCladdingCost);
  html += `</div>`;

  // ── ROOF ─────────────────────────────────────────────────
  let roofSheathCost  = 0;
  let roofFinishCost  = 0;
  html += `<div class="fp-section"><div class="fp-section-title">Roof</div>`;
  html += header();

  html += row('Rafters', fmtKey(ro.rafterKey), ro.totalRafters,
    p[ro.rafterKey] || Math.round(ro.rafterCost / ro.totalRafters));
  if (ro.ridgePcs > 0) {
    html += row('Ridge', `${ro.ridgeSize}×${ro.ridgeStockLength}`, ro.ridgePcs,
      Math.round(ro.ridgeCost / ro.ridgePcs));
  }
  html += row('Fascia', `2×6×${ro.fasciaStockLength}`, ro.fasciaSticks,
    Math.round(ro.fasciaCost / ro.fasciaSticks));
  if (ro.collarTieCount > 0) {
    html += row('Collar ties', `${fmtKey(ro.collarTieKey)} ~${ro.collarTieLength}ft`, ro.collarTieCount,
      Math.round(ro.collarTieCost / ro.collarTieCount));
    html += `<div class="fp-flag">⚠ Collar tie length approximate — verify on first build of each size</div>`;
  }
  if (ro.hasCeilingJoists) {
    html += row('Ceiling joists', fmtKey(ro.ceilingJoistKey), ro.ceilingJoistCount,
      Math.round(ro.ceilingJoistCost / ro.ceilingJoistCount));
  }
  html += row('Drip edge', '10ft sticks', ro.dripSticks, p.drip_edge_10ft || 9.98);

  if (sh.effectiveOsbRoof > 0) {
    const c = sh.effectiveOsbRoof * (p.osb_sheet || 13);
    html += row('OSB roof', '7/16" 4×8', sh.effectiveOsbRoof, p.osb_sheet || 13);
    roofSheathCost += c;
  }
  if (sh.effectiveZipRoof > 0) {
    const c1 = sh.effectiveZipRoof * (p.zip_roof_sheet || 60);
    const c2 = sh.zipRoofTape     * (p.zip_tape_roll   || 39);
    html += row('Zip roof', '5/8" 4×8', sh.effectiveZipRoof, p.zip_roof_sheet || 60);
    html += row('Zip roof tape', '3¾" roll', sh.zipRoofTape, p.zip_tape_roll || 39);
    roofSheathCost += c1 + c2;
  }
  if (state.roof === 'metal' && (sh.effectiveOsbRoof > 0 || sh.effectiveZipRoof > 0)) {
    const firBoards = Math.ceil(sh.furStripsLF / 8);
    const c = firBoards * (p.fir_strip_8ft || 4);
    html += row('Fir strips 1×4×8', `${sh.furStripsLF} LF`, firBoards, p.fir_strip_8ft || 4);
    roofSheathCost += c;
  }
  if (sh.effectiveVbRoof > 0) {
    const c = sh.effectiveVbRoof * (p.vapor_barrier_roll || 150);
    html += row('Vapor barrier', '500 sqft roll', sh.effectiveVbRoof, p.vapor_barrier_roll || 150);
    roofSheathCost += c;
  }

  if (state.roof === 'shingle') {
    const NAILS_PER_BOX    = 7200;
    const NAILS_PER_SQUARE = 320;
    const nailBoxes    = Math.ceil(m.shingleSquares * NAILS_PER_SQUARE / NAILS_PER_BOX);
    const shingleCost  = m.shingleSquares * (p.shingle_square   || 43.47);
    const nailCost     = nailBoxes        * (p.roofing_nail_box || 59);
    html += row('Shingles',      'GAF Arch.',        m.shingleSquares, p.shingle_square   || 43.47);
    html += row('Roofing nails', '30# box ~7200 ct', nailBoxes,        p.roofing_nail_box || 59);
    roofFinishCost += shingleCost + nailCost;
  }
  if (state.roof === 'metal') {
    const mp     = calculateMetalPanels(m, state.wallHeight);
    const perLf  = p.metal_panel_per_lf || 3.29;
    const cutLen = mp.roofPanelCutLen;
    const perPanel  = Math.round(cutLen * perLf * 10) / 10;
    const totalCost = Math.round(mp.roofPanelCount * perPanel);
    html += row('Metal panels — roof', `${cutLen}ft cut × 3ft`, mp.roofPanelCount, perPanel);
    html += `<div class="fp-flag">Order: ${mp.roofPanelCount} panels cut to ${cutLen}ft = ${mp.roofTotalLF.toFixed(1)} LF total (both slopes)</div>`;
    if (state.style === 'carriage') {
      html += `<div class="fp-flag">⚠ Carriage: front &amp; rear panel lengths likely differ — verify ridge offset before ordering</div>`;
    }
    roofFinishCost += totalCost;
  }
  if (state.iceWater && state.iceWater.enabled) {
    const icwSqft  = state.iceWater.coverage === 'full' ? m.roofSqft : (m.roofLength * 6);
    const icwRolls = Math.ceil(icwSqft / 225);
    const icwUnit  = p.ice_water_shield_roll || 250;
    html += row('Ice & water shield', '36in × 75ft roll', icwRolls, icwUnit);
    roofFinishCost += icwRolls * icwUnit;
  }

  const roofSectionTotal = ro.roofTotal + roofSheathCost + roofFinishCost;
  html += sub('Roof Total', roofSectionTotal);
  html += `</div>`;

  // ── OPENINGS ─────────────────────────────────────────────
  const doorCount = state.manDoorItems?.length || state.addons?.manDoors || 0;
  const winCount  = state.windowItems?.length  || state.addons?.windows  || 0;
  const gdItems   = state.garageDoorItems || [];
  const legacyGar = (!gdItems.length) ? (state.addons?.garageDoors || 0) : 0;
  if (doorCount > 0 || winCount > 0 || gdItems.length > 0 || legacyGar > 0) {
    html += `<div class="fp-section"><div class="fp-section-title">Openings</div>`;
    if (doorCount > 0)
      html += `<div class="fp-flag">Man door(s): ${doorCount} — RO: 38×82in each</div>`;
    if (winCount > 0)
      html += `<div class="fp-flag">Window(s): ${winCount} — verify RO per window spec</div>`;
    if (gdItems.length > 0) {
      gdItems.forEach(item => {
        const qty = item.qty || 1;
        if (item.category === 'framing') {
          const spec = CONFIG.FRAMED_OPENING_SPECS?.[item.spec];
          const lbl  = spec ? spec.label : item.spec;
          const sqft = (spec?.openingSqft || 56) * qty;
          html += `<div class="fp-flag">Framed opening ${lbl} × ${qty} — ${sqft} sqft, rough framing + header, no door${spec?.lbwNote ? ' ⚑ load-bearing upgrade may be required' : ''}</div>`;
        } else {
          const spec = CONFIG.GARAGE_DOOR_SPECS?.[item.spec];
          const lbl  = spec ? spec.label : item.spec;
          const sqft = (spec?.openingSqft || 56) * qty;
          html += `<div class="fp-flag">Garage door ${lbl} × ${qty} — ${sqft} sqft opening, header required</div>`;
        }
      });
      if (gdDeducted > 0)
        html += `<div class="fp-flag" style="color:#16a34a">Total opening deduction: ${gdOpenSqft} sqft → −${gdDeducted} wall sheet${gdDeducted !== 1 ? 's' : ''}</div>`;
    } else if (legacyGar > 0) {
      html += `<div class="fp-flag">Garage door(s): ${legacyGar} — load bearing header required.</div>`;
    }
    html += `</div>`;
  }

  // ── TOTALS ───────────────────────────────────────────────
  const floorCostContrib = noFloor ? 0 : fl.floorTotal;
  const wallSectionTotal = wa.wallTotal + wallCladdingCost;
  const lastTotal = (typeof state._lastQuoteTotal === 'number') ? state._lastQuoteTotal : null;
  const totalMat  = floorCostContrib + wallSectionTotal + roofSectionTotal;
  const margin    = lastTotal != null ? lastTotal - totalMat : null;
  const pct       = (lastTotal != null && lastTotal > 0) ? Math.round((margin / lastTotal) * 100) : null;
  const pctCls    = pct != null ? (pct >= 40 ? 'good' : pct >= 25 ? 'warn' : 'bad') : '';

  html += `<div class="fp-totals">
    <div class="fp-totals-row"><span>Materials (framing)</span><span>${fm(fr.totalMaterialCost)}</span></div>
    <div class="fp-totals-row${noFloor ? ' fp-totals-excluded' : ''}"><span>Floor${noFloor ? ' (excluded)' : ''}</span><span>${noFloor ? '$0' : fm(fl.floorTotal)}</span></div>
    <div class="fp-totals-row"><span>Walls</span><span>${fm(wallSectionTotal)}</span></div>
    <div class="fp-totals-row"><span>Roof</span><span>${fm(roofSectionTotal)}</span></div>
    <div class="fp-totals-row"><span>Materials (total)</span><span>${fm(totalMat)}</span></div>
    <div class="fp-totals-row"><span>Sell price</span><span>${lastTotal != null ? fm(lastTotal) : '—'}</span></div>
    <div class="fp-totals-row total-line"><span>Margin $</span><span>${margin != null ? fm(margin) : '—'}</span></div>
    <div class="fp-totals-row"><span>Margin %</span><span class="fp-margin ${pctCls}">${pct != null ? pct + '%' : '—'}</span></div>
  </div>`;

  body.innerHTML = html;
};

// ── Print framing panel ───────────────────────────────────
window.printFramingPanel = function() {
  const body = document.getElementById('framing-panel-body');
  if (!body) return;
  const w = window.open('', '_blank', 'width=820,height=960');
  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Framing Takeoff</title>
<style>
  body { font-family: system-ui, sans-serif; font-size: 12px; margin: 24px 28px; color: #111; }
  .fp-building-header { font-size:13px; font-weight:600; padding:8px 0 12px; border-bottom:2px solid #ccc; margin-bottom:10px; }
  .fp-section { margin-bottom: 14px; }
  .fp-section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:#777; border-bottom:1px solid #ddd; padding-bottom:3px; margin-bottom:5px; }
  .fp-row { display:grid; grid-template-columns:2fr 1.2fr 0.6fr 0.8fr 0.8fr; gap:4px 8px; padding:4px 0; border-bottom:1px solid #f0f0f0; align-items:center; }
  .fp-header { font-weight:700; color:#888; font-size:11px; }
  .fp-item  { color:#111; font-size:12px; }
  .fp-size  { color:#666; font-family:monospace; font-size:11px; }
  .fp-qty   { text-align:center; font-weight:600; }
  .fp-unit  { text-align:right; color:#888; font-size:11px; }
  .fp-total { text-align:right; font-weight:600; font-family:monospace; }
  .fp-subtotal { display:flex; justify-content:space-between; padding:4px 0 2px; font-weight:700; font-size:11px; color:#4338ca; border-top:1px solid #ddd; margin-top:3px; }
  .fp-flag { font-size:10px; color:#b45309; margin:2px 0 4px; }
  .fp-totals { background:#f9fafb; border:1px solid #ddd; border-radius:4px; padding:10px 12px; margin-top:10px; }
  .fp-totals-row { display:flex; justify-content:space-between; font-size:12px; padding:2px 0; }
  .fp-totals-row.total-line { font-weight:700; font-size:13px; border-top:2px solid #111; margin-top:5px; padding-top:5px; }
  .fp-margin.good { color:#16a34a; } .fp-margin.warn { color:#d97706; } .fp-margin.bad { color:#dc2626; }
  @media print { body { margin:12px; } }
</style>
</head><body>
${body.innerHTML}
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
};

// ── Dev mode ─────────────────────────────────────────────
const DEV_NOTES_KEY = 'layoutos_dev_notes';

const DEV_FLAGS = [
  { id: 'garage_material', label: 'Garage Door: Verify HD material price before generating',
    auto: () => state.addons.garageDoors > 0 && (!state.garageDoorItems || state.garageDoorItems.length === 0) },
  { id: 'loft',            label: 'Loft: TBD — not priced in system',
    auto: () => state.addons.loftFlag },
  { id: 'shelving',        label: 'Shelving: TBD — not priced in system',
    auto: () => state.addons.shelvingFlag },
  { id: 'electrical',      label: 'Electrical rough-in: Module not built yet',
    auto: () => false },
  { id: 'concrete',        label: 'Slab/Foundation: Module not built — need haunch vs basic pier logic; materials include anchor bolts, gravel base, forming, rebar. When no-wood-floor: quote should deduct floor framing from sell price, not just takeoff.',
    auto: () => !!(state.slab?.enabled) },
  { id: 'paint_stain',     label: 'Paint/Stain: Not in system — quote separately',
    auto: () => false },
  { id: 'custom_size',     label: 'Custom Size: Only standard sizes supported',
    auto: () => false },
  { id: 'collar_tie',     label: 'Collar tie length formula — needs field verification on first build of each size',
    auto: () => !!(state.style && !['mini','low','maxi','double'].includes(state.style)) },
];

function activateDevMode() {
  if (state.devMode) return;
  state.devMode = true;
  document.body.classList.add('dev-mode');
  document.getElementById('dev-badge').style.display = 'inline-block';
  const panel = document.getElementById('dev-flag-panel');
  panel.style.display = 'block';
  document.getElementById('dev-flag-panel-header').addEventListener('click', () => {
    panel.classList.toggle('expanded');
    document.getElementById('dev-flag-toggle').textContent =
      panel.classList.contains('expanded') ? '▲ collapse' : '▼ expand';
  });
  panel.classList.add('expanded');
  document.getElementById('dev-flag-toggle').textContent = '▲ collapse';
  buildDevFlags();
  if (state.step === 10) window.rebuildPreview();
  window.scrollTo({ top: 0 });
}

function buildDevFlags() {
  const notes = JSON.parse(localStorage.getItem(DEV_NOTES_KEY) || '{}');
  const body = document.getElementById('dev-flag-body');
  body.innerHTML = DEV_FLAGS.map(f => {
    const isActive = f.auto();
    const saved = notes[f.id] || '';
    return `<div class="dev-flag-item${isActive ? ' active' : ''}" id="devf-${f.id}">
      <div class="dev-flag-header" onclick="toggleDevFlagNote('${f.id}')">
        <div class="dev-flag-dot"></div>
        <div class="dev-flag-label">${f.label}</div>
      </div>
      <div class="dev-note-wrap">
        <textarea class="dev-note-field" id="devnote-${f.id}"
                  onblur="saveDevNote('${f.id}', this.value)"
                  placeholder="Notes...">${saved}</textarea>
        <div class="dev-note-saved" id="devnote-saved-${f.id}">saved ✓</div>
      </div>
    </div>`;
  }).join('');
  updateDevFlagCount();
}

function refreshDevFlags() {
  DEV_FLAGS.forEach(f => {
    const el = document.getElementById('devf-' + f.id);
    if (el) el.classList.toggle('active', f.auto());
  });
  updateDevFlagCount();
}

function updateDevFlagCount() {
  const n = document.querySelectorAll('.dev-flag-item.active').length;
  document.getElementById('dev-flag-count').textContent = n + ' active';
}

window.toggleDevFlagNote = function(id) {
  document.getElementById('devf-' + id)?.classList.toggle('note-open');
};

window.saveDevNote = function(id, text) {
  const notes = JSON.parse(localStorage.getItem(DEV_NOTES_KEY) || '{}');
  notes[id] = text;
  localStorage.setItem(DEV_NOTES_KEY, JSON.stringify(notes));
  const s = document.getElementById('devnote-saved-' + id);
  if (s) { s.style.display = 'block'; setTimeout(() => s.style.display = 'none', 1400); }
};

function renderDevMarginView(quote) {
  const el = document.getElementById('dev-margin-content');
  if (!el) return;
  const p = getPrices();
  const m = quote.materials || {};

  const baseMat = Math.round(
    (m.lpSheets        || 0) * (p.lp_smartside_sheet  || 0) +
    (m.shingleSquares  || 0) * (p.shingle_square       || 0) +
    (m.roofSheets      || 0) * (p.zip_roof_sheet       || 0) +
    (m.wallSheets      || 0) * (p.zip_wall_sheet       || 0) +
    (m.furStripsLF     || 0) * (p.fir_strip_per_lf    || 0)
  );
  const condMat = quote.conditioning?.totalCost || 0;

  const matLookup = { base: baseMat, conditioning: condMat };

  let html = `<table class="dev-margin-table">
    <thead><tr>
      <th>Item</th><th>Sell</th><th>~Mat Cost</th><th>Margin $</th><th>Margin %</th>
    </tr></thead><tbody>`;

  let totalSell = 0, totalKnownMat = 0;

  quote.lineItems.forEach(item => {
    if (item.isTBD || item.total === null) {
      html += `<tr>
        <td>${item.description}</td>
        <td colspan="4" style="color:var(--muted);font-style:italic">TBD — no margin data</td>
      </tr>`;
      return;
    }
    const sell = item.total || 0;
    totalSell += sell;
    const mat = (item.id in matLookup) ? matLookup[item.id] : null;
    if (mat === null) {
      html += `<tr>
        <td>${item.description}</td>
        <td>${formatMoney(sell)}</td>
        <td style="color:var(--muted)">—</td>
        <td style="color:var(--muted)">—</td>
        <td style="color:var(--muted)">—</td>
      </tr>`;
    } else {
      totalKnownMat += mat;
      const margin = sell - mat;
      const pct    = sell > 0 ? Math.round((margin / sell) * 100) : 0;
      const cls    = pct >= 40 ? 'good' : pct >= 25 ? 'warn' : 'bad';
      html += `<tr>
        <td>${item.description}</td>
        <td>${formatMoney(sell)}</td>
        <td>${formatMoney(mat)}</td>
        <td>${formatMoney(margin)}</td>
        <td><span class="margin-pct ${cls}">${pct}%</span></td>
      </tr>`;
    }
  });

  const totalMargin = totalSell - totalKnownMat;
  const totalPct = totalSell > 0 ? Math.round((totalMargin / totalSell) * 100) : 0;
  const totalCls = totalPct >= 40 ? 'good' : totalPct >= 25 ? 'warn' : 'bad';

  html += `</tbody><tfoot><tr>
    <td>TOTAL</td>
    <td>${formatMoney(totalSell)}</td>
    <td>${formatMoney(totalKnownMat)}<br><span style="font-size:10px;color:var(--muted)">(base+cond only)</span></td>
    <td>${formatMoney(totalMargin)}</td>
    <td><span class="margin-pct ${totalCls}">${totalPct}%</span></td>
  </tr></tfoot></table>
  <div style="font-size:10px;color:var(--muted);margin-top:7px;line-height:1.6">
    Mat tracked: base structural materials + conditioning materials (felt, housewrap) only.<br>
    — = install-dominant, no cost tracking, or not applicable. All margins are approximations.
  </div>`;

  el.innerHTML = html;
}

// ── Expose for cross-module calls ─────────────────────────
window.renderDevMarginView = renderDevMarginView;
window.refreshDevFlags     = refreshDevFlags;
window.activateDevMode     = activateDevMode;
