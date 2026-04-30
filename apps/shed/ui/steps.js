// ============================================================
// shed-quote/steps.js — Per-Step Handlers & Size Dropdowns
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================

import { state } from './core.js';
import {
  CONFIG, ANCHOR, getBasePrice, calculateVinylAddon, calculateDemoPrice,
  calculateShelving, getLoftAvailability, formatMoney,
  getValidWidths, getValidLengths, calculateMaterials, getPrices,
} from '../shed-logic.js';
import { getNextEstimateNumber } from '../../../core/layoutos-core.js';

// ── Step 2: Size dropdowns ───────────────────────────────
function populateSizeDropdowns() {
  if (!state.style) return;
  const widths = getValidWidths(state.style);
  const wSel   = document.getElementById('sel-width');
  wSel.innerHTML = widths.map(w => `<option value="${w}">${w} ft</option>`).join('');
  state.width = widths.includes(state.width) ? state.width : widths[0];
  wSel.value = state.width;
  onWidthChange();
  updateSizeInfo();
}

window.onWidthChange = function() {
  state.width = parseInt(document.getElementById('sel-width').value);
  state.priceOverrides = {};
  const overrideList = document.getElementById('override-list');
  if (overrideList) overrideList.innerHTML = '';
  const lengths = getValidLengths(state.style, state.width);
  const lSel = document.getElementById('sel-length');
  lSel.innerHTML = lengths.map(l => `<option value="${l}">${l} ft</option>`).join('');
  state.length = lengths.includes(state.length) ? state.length : lengths[0];
  lSel.value = state.length;
  lSel.addEventListener('change', () => {
    state.length = parseInt(lSel.value);
    state.priceOverrides = {};
    if (overrideList) overrideList.innerHTML = '';
    updateSizeInfo();
  });
  updateSizeInfo();
};

function updateSizeInfo() {
  if (!state.width || !state.length || !state.style) return;
  state.length = parseInt(document.getElementById('sel-length').value);
  const sqft  = state.width * state.length;
  const price = getBasePrice(state.style, state.width, state.length);
  const info  = document.getElementById('size-info');
  info.style.display = 'block';
  info.textContent   = `${state.width}×${state.length}ft — ${sqft} sqft — Base price: ${formatMoney(price)}`;

  const va = calculateVinylAddon(sqft);
  document.getElementById('vinyl-price-preview').textContent = `+${formatMoney(va)}`;

  if (state.wallHeight === 10) {
    state.wallStudSize = resolveStudSize(10, state.width);
  }

  updateLoftAvailability();
  updatePriceWidget(price, sqft);

  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();

  updateWallHeightPreview();
  window.renderStepNav?.();
}

// ── Floating price widget ────────────────────────────────
function renderWidget(headerHtml, rowsHtml, total) {
  const widget = document.getElementById('price-widget');
  if (!widget) return;
  document.getElementById('pw-body').innerHTML = `
    <div class="pw-header">${headerHtml}</div>
    <div class="pw-items">${rowsHtml}</div>
  `;
  let totEl = document.getElementById('pw-total-pinned');
  if (!totEl) {
    totEl = document.createElement('div');
    totEl.id = 'pw-total-pinned';
    totEl.className = 'pw-total';
    widget.appendChild(totEl);
  }
  totEl.innerHTML = `<span>Total</span><span>${formatMoney(total)}</span>`;
  widget.style.display = 'flex';
}

function updatePriceWidget(basePrice, sqft) {
  if (!state.style || !state.width || !state.length) return;
  const label = ANCHOR[state.style]?.label || state.style;
  renderWidget(
    `${label} · ${state.width}×${state.length}ft · ${sqft} sqft`,
    `<div class="pw-row"><span>Base price</span><span>${formatMoney(basePrice)}</span></div>`,
    basePrice
  );
}
window.updatePriceWidget = updatePriceWidget;

window.updatePriceWidgetFull = function(quote) {
  if (!quote?.building) return;
  const b         = quote.building;
  const label     = ANCHOR[b.style]?.label || b.style;
  const baseTotal = quote.lineItems.find(i => i.id === 'base')?.total ?? 0;
  const rows = quote.lineItems
    .filter(i => !i.isTBD && i.total !== null && i.total > 0 && i.id !== 'base')
    .map(i => {
      const desc = i.description.length > 28 ? i.description.slice(0, 26) + '…' : i.description;
      const qty  = i.qty > 1 ? ` ×${i.qty}` : '';
      return `<div class="pw-row"><span>${desc}${qty}</span><span>${formatMoney(i.total)}</span></div>`;
    }).join('') || `<div class="pw-row" style="opacity:.45"><span>No add-ons</span><span>—</span></div>`;
  renderWidget(
    `${label} · ${b.width}×${b.length}ft · ${b.sqft} sqft<br><span style="font-size:17px;font-weight:800;opacity:1">${formatMoney(baseTotal)}</span><span style="font-size:10px;opacity:.6"> base</span>`,
    rows,
    quote.pricing.total
  );
};

// drag
(function() {
  const el = document.getElementById('price-widget');
  const handle = document.getElementById('price-widget-drag');
  if (!el || !handle) return;
  let ox = 0, oy = 0, sx = 0, sy = 0;
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    sx = e.clientX; sy = e.clientY;
    const r = el.getBoundingClientRect();
    ox = window.innerWidth  - r.right;
    oy = window.innerHeight - r.bottom;
    function onMove(e) {
      const dx = sx - e.clientX, dy = sy - e.clientY;
      el.style.right  = Math.max(0, ox + dx) + 'px';
      el.style.bottom = Math.max(0, oy + dy) + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

// ── Loft availability note (Step 7) ──────────────────────
function updateLoftAvailability() {
  const noteEl = document.getElementById('loft-avail-note');
  if (!noteEl) return;
  if (!state.style || !state.width) {
    noteEl.textContent = 'Select a style and size first to check availability.';
    noteEl.style.color = '';
    return;
  }
  const avail = getLoftAvailability(state.style, state.width);
  if (avail.available) {
    noteEl.textContent = avail.headroomNote || 'Available on this style and size.';
    noteEl.style.color = '';
    document.getElementById('chk-loft-row')?.classList.remove('loft-unavailable');
  } else {
    noteEl.textContent = avail.overheadStorageNote || 'Not available on this style — consider overhead storage instead.';
    noteEl.style.color = 'var(--amber)';
    if (state.loftRequested) {
      state.loftRequested = false;
      const chk = document.getElementById('chk-loft');
      if (chk) chk.checked = false;
      document.getElementById('chk-loft-row')?.classList.remove('selected');
    }
  }
}

// ── Stud size resolver ───────────────────────────────────
function resolveStudSize(wallHeight, width) {
  if (wallHeight !== 10) return '2x4x8';
  return (width >= 12) ? '2x6x10' : '2x4x10';
}

// ── Step 3: Wall height ──────────────────────────────────
window.selectWallHeight = function(h) {
  state.wallHeight = h;
  state.wallStudSize = resolveStudSize(h, state.width || 0);
  document.querySelectorAll('#s3 .opt-row').forEach(r => r.classList.remove('selected'));
  document.getElementById('wh-' + h).classList.add('selected');
  document.getElementById('wh-' + h).querySelector('input').checked = true;
  updateWallHeightPreview();
  window.renderGarageDoorBuilder();
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

function updateWallHeightPreview() {
  const el = document.getElementById('wh-10-price');
  if (!el) return;
  if (!state.style || !state.width || !state.length) {
    el.textContent = '+Tall wall upgrade';
    return;
  }
  const m8  = calculateMaterials(state.width, state.length, 8,  state.style);
  const m10 = calculateMaterials(state.width, state.length, 10, state.style);
  const extraLP    = m10.lpSheets    - m8.lpSheets;
  const extraRoof  = m10.roofSheets  - m8.roofSheets;
  const p = getPrices();
  const lpPrice    = p.lp_smartside_sheet    || 50;
  const roofPrice  = p.shingle_square        || 43.47;
  const approxCost = Math.round((extraLP * lpPrice) + (extraRoof * (roofPrice / 100) * 32));

  el.textContent = `+${extraLP} LP sheets · 2×6 studs`;

  if (state.internalMode) {
    el.innerHTML = `
      <div style="font-size:12px;line-height:1.7;text-align:left;padding:4px 0">
        <strong>10ft vs 8ft delta:</strong><br>
        LP sheets: +${extraLP} × $${lpPrice} = $${extraLP * lpPrice}<br>
        Roof sheets: +${extraRoof}<br>
        Studs: 2×4×8 → 2×6×10 (stud count same, size/cost upgrades)<br>
        Wall sqft: ${m10.wallSqft || (state.width && state.length ? (2*(state.width+state.length)*10) : '?')} sqft<br>
        <strong>Approx material delta: ~$${approxCost}+</strong><br>
        <span style="color:var(--muted);font-size:11px">Full cost in quote preview</span>
      </div>`;
  }
}

// ── Step 1: Carriage variant sub-selector ────────────────
window.selectCarriageVariant = function(v) {
  state.carriageVariant = v;
  document.querySelectorAll('.cv-btn').forEach(el => {
    el.classList.toggle('selected', el.dataset.variant === v);
  });
  if (state.internalMode) window.rebuildPreview?.();
};

// ── Step 4: Roof ─────────────────────────────────────────
window.selectRoof = function(r) {
  state.roof = r;
  ['shingle', 'metal'].forEach(id => {
    const el = document.getElementById('roof-' + id);
    if (!el) return;
    el.classList.toggle('selected', id === r);
    el.querySelector('input').checked = (id === r);
  });

  if (r === 'metal' && state.width && state.length) {
    const base  = getBasePrice(state.style, state.width, state.length);
    const addon = Math.round(base * CONFIG.METAL_ROOF_MULTIPLIER);
    document.getElementById('metal-price-preview').textContent = `+${formatMoney(addon)}`;
  } else {
    document.getElementById('metal-price-preview').textContent = '+12% on base';
  }

  const mro = document.getElementById('metal-roof-options');
  if (mro) mro.style.display = r === 'metal' ? 'block' : 'none';

  const mco = document.getElementById('metal-color-options');
  if (mco) mco.style.display = r === 'metal' ? 'block' : 'none';

  const sco = document.getElementById('shingle-color-options');
  if (sco) sco.style.display = r === 'shingle' ? 'block' : 'none';

  if (r !== 'metal') {
    state.roofSheathingOption = 'none';
  } else {
    window.selectRoofSheathing(state.roofSheathingOption || 'none');
  }

  const cn = document.getElementById('metal-conditioning-notice');
  if (cn) cn.style.display = r === 'metal' ? 'block' : 'none';
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

// ── Step 4: Roof sheathing sub-option ────────────────────
window.selectRoofSheathing = function(option) {
  state.roofSheathingOption = option;
  const idMap = { none: 'none', vb_only: 'vb', osb: 'osb', zip: 'zip' };
  Object.entries(idMap).forEach(([val, id]) => {
    const el = document.getElementById('rso-' + id);
    if (!el) return;
    el.classList.toggle('selected', val === option);
    el.querySelector('input').checked = (val === option);
  });
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

// ── Step 4: Gauge selection ───────────────────────────────
window.selectGauge = function(gauge) {
  state.roofGauge = gauge;
  ['29', '26'].forEach(g => {
    const btn = document.getElementById('gauge-' + g);
    if (!btn) return;
    const active = g === gauge;
    btn.classList.toggle('selected', active);
    btn.style.background    = active ? 'var(--blue)' : 'var(--surface)';
    btn.style.borderColor   = active ? 'var(--blue)' : 'var(--border)';
    btn.style.color         = active ? 'white'        : 'var(--text)';
  });
  if (state.internalMode) window.rebuildPreview?.();
};

// ── Step 4: Roof color selection ─────────────────────────
window.selectRoofColor = function(key, label, premium, tier) {
  state.roofColor        = key;
  state.roofColorLabel   = label;
  state.roofColorPremium = !!premium;
  state.roofColorTier    = tier || 'base';
  document.querySelectorAll('.color-chip').forEach(el => {
    el.classList.toggle('selected', el.dataset.colorKey === key);
  });
  if (state.internalMode) window.rebuildPreview?.();
};

// ── Step 5: Siding ───────────────────────────────────────
window.selectSiding = function(s) {
  state.siding = s;
  ['lp', 'vinyl'].forEach(id => {
    const el = document.getElementById('siding-' + id);
    if (!el) return;
    el.classList.toggle('selected', id === s);
    el.querySelector('input').checked = (id === s);
  });

  const wvo = document.getElementById('vinyl-wall-options');
  if (wvo) wvo.style.display = s === 'vinyl' ? 'block' : 'none';

  if (s !== 'vinyl') {
    state.wallSheathingOption = 'none';
  } else {
    window.selectWallSheathing(state.wallSheathingOption || 'none');
  }
  window.renderShopDoorSection?.();
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

// ── Step 5: Wall sheathing sub-option ────────────────────
window.selectWallSheathing = function(option) {
  state.wallSheathingOption = option;
  const idMap = { none: 'none', house_wrap: 'hw', zip: 'zip' };
  Object.entries(idMap).forEach(([val, id]) => {
    const el = document.getElementById('wso-' + id);
    if (!el) return;
    el.classList.toggle('selected', val === option);
    el.querySelector('input').checked = (val === option);
  });
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

// ── Step 4: Ice & Water Shield ───────────────────────────
function updateIcwPreview() {
  const prev = document.getElementById('icw-preview');
  if (!prev) return;
  if (!state.iceWater.enabled || !state.width || !state.length || !state.style) {
    prev.textContent = '';
    return;
  }
  const m     = calculateMaterials(state.width, state.length, state.wallHeight, state.style);
  const p     = getPrices();
  const sqft  = state.iceWater.coverage === 'full' ? m.roofSqft : (m.roofLength * 6);
  const rolls = Math.ceil(sqft / 225);
  const cost  = rolls * (p.ice_water_shield_roll || 250);
  const label = state.iceWater.coverage === 'full' ? 'full roof' : 'lower 6ft eaves';
  prev.textContent = `${rolls} roll${rolls !== 1 ? 's' : ''} (${label}) — ${formatMoney(cost)}`;
  prev.style.color = 'var(--green)';
}

window.toggleIceWater = function() {
  const chk = document.getElementById('chk-icw');
  chk.checked = !chk.checked;
  state.iceWater.enabled = chk.checked;
  document.getElementById('chk-icw-row').classList.toggle('selected', chk.checked);
  const cfg = document.getElementById('icw-config');
  if (cfg) cfg.style.display = chk.checked ? 'block' : 'none';
  updateIcwPreview();
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

window.selectIceWaterCoverage = function(cov) {
  state.iceWater.coverage = cov;
  ['lower6', 'full'].forEach(id => {
    const el = document.getElementById('icw-' + id);
    if (el) el.querySelector('input').checked = (id === cov);
  });
  updateIcwPreview();
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

// ── Step 7: Windows & Doors / Step 8: Add-Ons ───────────

// Shelving
window.toggleShelving = function() {
  const chk = document.getElementById('chk-shelving');
  chk.checked = !chk.checked;
  state.shelvingSpec.enabled = chk.checked;
  document.getElementById('chk-shelf-row').classList.toggle('selected', chk.checked);
  const cfg = document.getElementById('shelving-config');
  if (cfg) cfg.style.display = chk.checked ? 'block' : 'none';
  window.onShelvingChange();
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

window.onShelvingChange = function() {
  state.shelvingSpec.linearFt = parseInt(document.getElementById('shelving-lf')?.value) || 0;
  state.shelvingSpec.material = document.getElementById('shelving-material')?.value || 'osb';
  const prev = document.getElementById('shelving-price-preview');
  if (!prev) return;
  if (state.shelvingSpec.enabled && state.shelvingSpec.linearFt > 0 && state.width && state.length) {
    const longestWall = Math.max(state.width || 0, state.length || 0);
    const shelf = calculateShelving(state.shelvingSpec.linearFt, state.shelvingSpec.material, longestWall);
    prev.textContent = `${shelf.description} — est. material ${formatMoney(shelf.materialCost)}`;
    prev.style.color = shelf.fitsWarning ? 'var(--amber)' : 'var(--green)';
  } else {
    prev.textContent = '';
  }
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

// Slab / Foundation
window.toggleSlab = function() {
  const chk = document.getElementById('chk-slab');
  chk.checked = !chk.checked;
  state.slab.enabled = chk.checked;
  document.getElementById('chk-slab-row').classList.toggle('selected', chk.checked);
  const cfg = document.getElementById('slab-config');
  if (cfg) cfg.style.display = chk.checked ? 'block' : 'none';
  if (!chk.checked) {
    state.slab.noWoodFloor = false;
    const nf = document.getElementById('chk-nofloor');
    if (nf) nf.checked = false;
    document.getElementById('chk-nofloor-row')?.classList.remove('selected');
  }
  window.onSlabChange();
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

window.toggleNoFloor = function() {
  const chk = document.getElementById('chk-nofloor');
  chk.checked = !chk.checked;
  state.slab.noWoodFloor = chk.checked;
  document.getElementById('chk-nofloor-row').classList.toggle('selected', chk.checked);
  window.onSlabChange();
  if (state.internalMode) window.rebuildPreview?.();
};

window.onSlabChange = function() {
  const rate = parseFloat(document.getElementById('slab-rate')?.value) || 13;
  state.slab.ratePerSqft = rate;
  const prev = document.getElementById('slab-price-preview');
  if (!prev) return;
  if (state.slab.enabled && state.width && state.length) {
    const sqft = state.width * state.length;
    const slab = Math.round(sqft * rate);
    const credit = state.slab.noWoodFloor ? Math.round(sqft * 3) : 0;
    const net = slab - credit;
    prev.innerHTML = state.slab.noWoodFloor
      ? `Slab: ${formatMoney(slab)} − floor credit ${formatMoney(credit)} = <strong>${formatMoney(net)}</strong> (${sqft} sqft)`
      : `Slab: <strong>${formatMoney(slab)}</strong> (${sqft} sqft @ $${rate}/sqft)`;
  } else {
    prev.textContent = '';
  }
  if (state.internalMode) window.renderFramingPanel();
};

// Loft
window.toggleLoft = function() {
  const chk   = document.getElementById('chk-loft');
  const avail = (state.style && state.width) ? getLoftAvailability(state.style, state.width) : { available: true };
  if (!avail.available) return;
  chk.checked = !chk.checked;
  state.loftRequested = chk.checked;
  document.getElementById('chk-loft-row').classList.toggle('selected', chk.checked);
  if (state.internalMode) window.rebuildPreview?.();
};

// ── Step 8: Demo ─────────────────────────────────────────
window.selectDemo = function(enabled) {
  state.demo.enabled = enabled;
  document.getElementById('demo-yes-row').classList.toggle('selected', enabled);
  document.getElementById('demo-no-row').classList.toggle('selected', !enabled);
  document.getElementById('demo-yes-row').querySelector('input').checked = enabled;
  document.getElementById('demo-no-row').querySelector('input').checked = !enabled;
  document.getElementById('demo-size-fields').style.display = enabled ? 'block' : 'none';
  if (enabled) updateDemoPreview();
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

function updateDemoPreview() {
  state.demo.width  = parseInt(document.getElementById('demo-width').value)  || 8;
  state.demo.length = parseInt(document.getElementById('demo-length').value) || 8;
  const demoSqft  = state.demo.width * state.demo.length;
  const demoPrice = calculateDemoPrice(demoSqft);
  const prev      = document.getElementById('demo-price-preview');

  const concreteRow = document.getElementById('demo-concrete-config');
  if (concreteRow) concreteRow.style.display = state.demo.concrete ? 'block' : 'none';

  if (state.demo.concrete) {
    const rate         = state.demo.concreteRateSqft || 1.15;
    const concreteCost = Math.round(demoSqft * rate);
    prev.innerHTML =
      `Demo ${state.demo.width}×${state.demo.length}ft (${demoSqft} sqft) — ${formatMoney(demoPrice)}<br>` +
      `<span style="color:var(--text)">+ Concrete removal ${demoSqft} sqft @ $${rate.toFixed(2)}/sqft — ${formatMoney(concreteCost)}</span><br>` +
      `<strong>Total demo: ${formatMoney(demoPrice + concreteCost)}</strong>`;
  } else {
    prev.textContent = `Demo of ${state.demo.width}×${state.demo.length}ft (${demoSqft} sqft) — ${formatMoney(demoPrice)}`;
  }
}

window.toggleDemoConcrete = function() {
  const chk = document.getElementById('chk-demo-concrete');
  state.demo.concrete = chk?.checked ?? false;
  updateDemoPreview();
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

window.onDemoConcreteRateChange = function() {
  const val = parseFloat(document.getElementById('demo-concrete-rate')?.value);
  state.demo.concreteRateSqft = isNaN(val) || val <= 0 ? 1.15 : val;
  updateDemoPreview();
  if (state.internalMode) window.rebuildPreview?.();
};

document.getElementById('demo-width').addEventListener('change', updateDemoPreview);
document.getElementById('demo-length').addEventListener('change', updateDemoPreview);

// ── Step 9: Customer ─────────────────────────────────────
window.onNameChange = function() {
  const name = document.getElementById('cust-name').value.trim();
  state.customer.name = name;
  const num = getNextEstimateNumber(CONFIG.PREPARER_LETTER || 'F');
  document.getElementById('est-number-preview').textContent =
    `Estimate number will be: ${num}`;
};

// ── Color grid builder ────────────────────────────────────
function buildColorGrid(containerId, colors, isPremium) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = colors.map(c => `
    <div class="color-chip" data-color-key="${c.key}"
         onclick="selectRoofColor('${c.key}', '${c.label}', ${!!isPremium}, '${c.premiumTier || 'base'}')">
      <div class="chip-swatch" style="background:${c.hex}"></div>
      ${c.gauge26 ? '<span class="chip-badge-26">26ga</span>' : ''}
      <div class="chip-label">${c.label}</div>
    </div>
  `).join('');
}

// Build all grids once on load
buildColorGrid('metal-color-grid',         CONFIG.METAL_COLORS_STANDARD, false);
buildColorGrid('metal-color-grid-premium', CONFIG.METAL_COLORS_PREMIUM,  true);
buildColorGrid('shingle-color-grid',       CONFIG.SHINGLE_COLORS,        false);

// ── Expose for cross-module calls ─────────────────────────
window.populateSizeDropdowns = populateSizeDropdowns;
