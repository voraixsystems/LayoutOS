// ============================================================
// shed-quote/builders.js — Door & Window Row Builders
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================

import { state } from './core.js';
import { CONFIG, formatMoney, getPrices } from '../shed-logic.js';

// Man door typed builder
function renderManDoorBuilder() {
  const container = document.getElementById('man-door-builder');
  if (!container) return;
  if (state.manDoorItems.length === 0) {
    container.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0">No man doors added. Click below to add one.</div>';
    return;
  }
  container.innerHTML = state.manDoorItems.map((door, i) => {
    const price = door.type === '9lite'   ? (CONFIG.ADDON_MAN_DOOR_9LITE   || 0) :
                  door.type === 'fanlite' ? (CONFIG.ADDON_MAN_DOOR_FANLITE || 0) :
                                            (CONFIG.ADDON_MAN_DOOR_SOLID   || 0);
    const lineTotal = price * (door.qty || 1);
    return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;background:#f9fafb;border:1px solid var(--border);border-radius:5px;padding:10px;flex-wrap:wrap">
      <select id="mdr-type-${i}" onchange="updateManDoorRow(${i})"
              style="flex:1;min-width:140px;padding:7px 8px;border:1px solid var(--border);border-radius:4px;font-family:inherit;font-size:13px">
        <option value="solid"   ${door.type==='solid'   ? 'selected' : ''}>Solid Steel — $${CONFIG.ADDON_MAN_DOOR_SOLID}</option>
        <option value="9lite"   ${door.type==='9lite'   ? 'selected' : ''}>9-Lite Steel — $${CONFIG.ADDON_MAN_DOOR_9LITE}</option>
        <option value="fanlite" ${door.type==='fanlite' ? 'selected' : ''}>Fan-Lite Steel — $${CONFIG.ADDON_MAN_DOOR_FANLITE}</option>
      </select>
      <select id="mdr-swing-${i}" onchange="updateManDoorRow(${i})"
              style="width:130px;padding:7px 8px;border:1px solid var(--border);border-radius:4px;font-family:inherit;font-size:13px">
        <option value="left"  ${door.swing==='left'  ? 'selected' : ''}>LH (Left Hand)</option>
        <option value="right" ${door.swing==='right' ? 'selected' : ''}>RH (Right Hand)</option>
      </select>
      <input type="number" id="mdr-qty-${i}" value="${door.qty || 1}" min="1" max="10"
             onchange="updateManDoorRow(${i})"
             style="width:60px;padding:7px 8px;border:1px solid var(--border);border-radius:4px;font-size:13px">
      <span style="font-size:12px;color:var(--green);min-width:70px;font-weight:700;text-align:right">${formatMoney(lineTotal)}</span>
      <button type="button" data-remove-type="man-door" data-remove-idx="${i}"
              style="background:var(--red-lt);border:1px solid #fca5a5;border-radius:3px;cursor:pointer;padding:5px 9px;font-size:12px;flex-shrink:0">✕</button>
    </div>`;
  }).join('');
}

window.addManDoorRow = function() {
  state.manDoorItems.push({ type: 'solid', swing: 'left', qty: 1 });
  renderManDoorBuilder();
  if (state.internalMode) window.rebuildPreview?.();
};

window.removeManDoorRow = function(idx) {
  state.manDoorItems.splice(idx, 1);
  renderManDoorBuilder();
  if (state.internalMode) window.rebuildPreview?.();
};

window.updateManDoorRow = function(idx) {
  state.manDoorItems[idx] = {
    type:  document.getElementById(`mdr-type-${idx}`)?.value  || 'solid',
    swing: document.getElementById(`mdr-swing-${idx}`)?.value || 'left',
    qty:   parseInt(document.getElementById(`mdr-qty-${idx}`)?.value) || 1,
  };
  renderManDoorBuilder();
  if (state.internalMode) window.rebuildPreview?.();
};

// Window typed builder
function renderWindowBuilder() {
  const container = document.getElementById('window-builder');
  if (!container) return;
  if (state.windowItems.length === 0) {
    container.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0">No windows added. Click below to add one.</div>';
    return;
  }
  container.innerHTML = state.windowItems.map((win, i) => {
    const price = win.type === 'sliding' ? (CONFIG.ADDON_WINDOW_SLIDING || 0) : (CONFIG.ADDON_WINDOW_SINGLE_HUNG || 0);
    const lineTotal = price * (win.qty || 1);
    const isSliding = win.type === 'sliding';
    return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;background:#f9fafb;border:1px solid var(--border);border-radius:5px;padding:10px;flex-wrap:wrap">
      <select id="wr-type-${i}" onchange="updateWindowRow(${i})"
              style="flex:1;min-width:150px;padding:7px 8px;border:1px solid var(--border);border-radius:4px;font-family:inherit;font-size:13px">
        <option value="single_hung" ${win.type==='single_hung' ? 'selected' : ''}>Single Hung 24×30 — $${CONFIG.ADDON_WINDOW_SINGLE_HUNG}</option>
        <option value="sliding"     ${win.type==='sliding'     ? 'selected' : ''}>Sliding 36×36 — $${CONFIG.ADDON_WINDOW_SLIDING}</option>
      </select>
      <select id="wr-op-${i}" onchange="updateWindowRow(${i})"
              style="width:140px;padding:7px 8px;border:1px solid var(--border);border-radius:4px;font-family:inherit;font-size:13px;${!isSliding ? 'display:none' : ''}"
              ${!isSliding ? 'disabled' : ''}>
        <option value="left"  ${win.operation==='left'  ? 'selected' : ''}>Left Operable</option>
        <option value="right" ${win.operation==='right' ? 'selected' : ''}>Right Operable</option>
      </select>
      <input type="number" id="wr-qty-${i}" value="${win.qty || 1}" min="1" max="20"
             onchange="updateWindowRow(${i})"
             style="width:60px;padding:7px 8px;border:1px solid var(--border);border-radius:4px;font-size:13px">
      <span style="font-size:12px;color:var(--green);min-width:70px;font-weight:700;text-align:right">${formatMoney(lineTotal)}</span>
      <button type="button" data-remove-type="window" data-remove-idx="${i}"
              style="background:var(--red-lt);border:1px solid #fca5a5;border-radius:3px;cursor:pointer;padding:5px 9px;font-size:12px;flex-shrink:0">✕</button>
    </div>`;
  }).join('');
}

window.addWindowRow = function() {
  state.windowItems.push({ type: 'single_hung', operation: null, qty: 1 });
  renderWindowBuilder();
  if (state.internalMode) window.rebuildPreview?.();
};

window.removeWindowRow = function(idx) {
  state.windowItems.splice(idx, 1);
  renderWindowBuilder();
  if (state.internalMode) window.rebuildPreview?.();
};

window.updateWindowRow = function(idx) {
  const type = document.getElementById(`wr-type-${idx}`)?.value || 'single_hung';
  const op   = document.getElementById(`wr-op-${idx}`)?.value   || null;
  state.windowItems[idx] = {
    type,
    operation: type === 'sliding' ? op : null,
    qty: parseInt(document.getElementById(`wr-qty-${idx}`)?.value) || 1,
  };
  renderWindowBuilder();
  if (state.internalMode) window.rebuildPreview?.();
};

// ── Garage door typed builder ─────────────────────────────

function getGdItemTotal(item) {
  const p = getPrices();
  if (item.category === 'framing') {
    const spec = CONFIG.FRAMED_OPENING_SPECS?.[item.spec];
    if (!spec || !spec.priceKey) return null;
    return (p[spec.priceKey] || 0) * (item.qty || 1);
  }
  const spec = CONFIG.GARAGE_DOOR_SPECS?.[item.spec];
  if (!spec) return null;
  const sealCount = CONFIG.GARAGE_DOOR_SEALS_PER_DOOR || 3;
  const unit = (p[spec.priceKey] || 0) +
               (p.garage_door_install || 350) +
               sealCount * (p.garage_door_seal_9ft || 57) +
               (item.keyedHandle ? (p.garage_door_keyed_handle || 50) : 0);
  return unit * (item.qty || 1);
}

function renderGarageDoorBuilder() {
  const container = document.getElementById('garage-door-builder');
  if (!container) return;
  if (state.garageDoorItems.length === 0) {
    container.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0">No garage doors added. Click below to add one.</div>';
    return;
  }

  const wallHeight = state.wallHeight || 8;
  const p = getPrices();

  container.innerHTML = state.garageDoorItems.map((item, i) => {
    const isDoor   = item.category !== 'framing';
    const total    = getGdItemTotal(item);
    const tenOnly  = wallHeight < 10 ? ' (10ft wall only)' : '';

    const doorOpts = [
      { v: '8x7_std', l: `8×7 Non-Insulated — $${p.garage_door_8x7_std || 450}` },
      { v: '8x7_r6',  l: `8×7 R-6.5 Insulated — $${p.garage_door_8x7_r6 || 600}` },
      { v: '8x8_std', l: `8×8 Non-Insulated — $${p.garage_door_8x8_std || 2150}${tenOnly}`, dis: wallHeight < 10 },
      { v: '9x7_std', l: `9×7 Non-Insulated — $${p.garage_door_9x7_std || 700}` },
      { v: '9x7_r6',  l: `9×7 R-6.5 Insulated — $${p.garage_door_9x7_r6 || 1150}` },
    ];
    const foOpts = [
      { v: '8x7',    l: `8×7 — $${p.framed_opening_8x7 || 225}` },
      { v: '8x8',    l: `8×8 — $${p.framed_opening_8x8 || 250}${tenOnly}`, dis: wallHeight < 10 },
      { v: '9x7',    l: `9×7 — $${p.framed_opening_9x7 || 275}` },
      { v: '9x8',    l: `9×8 — $${p.framed_opening_9x8 || 300}${tenOnly}`, dis: wallHeight < 10 },
      { v: '10x7',   l: `10×7 — $${p.framed_opening_10x7 || 350}` },
      { v: '12x7',   l: `12×7 ⚑ — $${p.framed_opening_12x7 || 425}` },
      { v: '16x7',   l: `16×7 ⚑ — $${p.framed_opening_16x7 || 500}` },
      { v: 'custom', l: 'Custom — TBD' },
    ];

    const specOpts = isDoor ? doorOpts : foOpts;
    const sel = s => `style="padding:7px 8px;border:1px solid var(--border);border-radius:4px;font-family:inherit;font-size:13px;${s}"`;

    return `<div style="background:#f9fafb;border:1px solid var(--border);border-radius:5px;padding:10px;margin-bottom:8px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="gdr-cat-${i}" onchange="updateGarageDoorRow(${i})" ${sel('width:145px')}>
          <option value="door"    ${isDoor  ? 'selected' : ''}>Garage Door</option>
          <option value="framing" ${!isDoor ? 'selected' : ''}>Framed Opening</option>
        </select>
        <select id="gdr-spec-${i}" onchange="updateGarageDoorRow(${i})" ${sel('flex:1;min-width:160px')}>
          ${specOpts.map(o => `<option value="${o.v}" ${item.spec === o.v ? 'selected' : ''} ${o.dis ? 'disabled' : ''}>${o.l}</option>`).join('')}
        </select>
        <input type="number" id="gdr-qty-${i}" value="${item.qty || 1}" min="1" max="10"
               onchange="updateGarageDoorRow(${i})"
               style="width:60px;padding:7px 8px;border:1px solid var(--border);border-radius:4px;font-size:13px">
        <span style="font-size:12px;color:var(--green);min-width:72px;font-weight:700;text-align:right">${total !== null ? formatMoney(total) : 'TBD'}</span>
        <button type="button" data-remove-type="garage-door" data-remove-idx="${i}"
                style="background:var(--red-lt);border:1px solid #fca5a5;border-radius:3px;cursor:pointer;padding:5px 9px;font-size:12px;flex-shrink:0">✕</button>
      </div>
      ${isDoor ? `
      <div style="display:flex;gap:16px;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);flex-wrap:wrap;font-size:13px">
        <div style="display:flex;align-items:center;gap:6px">
          <label style="color:var(--muted);font-size:12px">Seal color:</label>
          <select id="gdr-seal-${i}" onchange="updateGarageDoorRow(${i})"
                  style="padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-family:inherit;font-size:12px">
            <option value="white" ${item.sealColor !== 'brown' ? 'selected' : ''}>White — 3 × $${p.garage_door_seal_9ft || 57} incl.</option>
            <option value="brown" ${item.sealColor === 'brown'  ? 'selected' : ''}>Brown — 3 × $${p.garage_door_seal_9ft || 57} incl.</option>
          </select>
        </div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="gdr-handle-${i}" ${item.keyedHandle ? 'checked' : ''} onchange="updateGarageDoorRow(${i})">
          <span>Exterior keyed entry handle +$${p.garage_door_keyed_handle || 50}
            <span style="color:var(--muted);font-size:11px">(without: inside-open only)</span>
          </span>
        </label>
      </div>` : ''}
    </div>`;
  }).join('');
}

window.addGarageDoorRow = function() {
  state.garageDoorItems.push({ category: 'door', spec: '8x7_std', sealColor: 'white', keyedHandle: false, qty: 1 });
  renderGarageDoorBuilder();
  renderRampSection();
  if (state.internalMode) window.rebuildPreview?.();
};

window.removeGarageDoorRow = function(idx) {
  state.garageDoorItems.splice(idx, 1);
  renderGarageDoorBuilder();
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

window.updateGarageDoorRow = function(idx) {
  const cat      = document.getElementById(`gdr-cat-${idx}`)?.value || 'door';
  const catChanged = state.garageDoorItems[idx]?.category !== cat;
  const spec     = catChanged
    ? (cat === 'door' ? '8x7_std' : '8x7')
    : (document.getElementById(`gdr-spec-${idx}`)?.value || (cat === 'door' ? '8x7_std' : '8x7'));
  state.garageDoorItems[idx] = {
    category:    cat,
    spec,
    sealColor:   cat === 'door' ? (document.getElementById(`gdr-seal-${idx}`)?.value || 'white') : 'white',
    keyedHandle: cat === 'door' ? !!(document.getElementById(`gdr-handle-${idx}`)?.checked) : false,
    qty:         parseInt(document.getElementById(`gdr-qty-${idx}`)?.value) || 1,
  };
  renderGarageDoorBuilder();
  renderRampSection();
  if (state.internalMode) window.renderFramingPanel();
  if (state.internalMode) window.rebuildPreview?.();
};

window.renderGarageDoorBuilder = renderGarageDoorBuilder;

// ── Wood Build Shop Doors ─────────────────────────────

const SHOP_DOOR_ROWS = [
  { width: 32, label: '32in Single' },
  { width: 36, label: '36in Single' },
  { width: 64, label: '64in Double' },
  { width: 72, label: '72in Double' },
];

function renderShopDoorSection() {
  const el = document.getElementById('shop-door-section');
  if (!el) return;
  const prices = state.siding === 'vinyl'
    ? CONFIG.SHOP_DOOR_PRICES_VINYL
    : CONFIG.SHOP_DOOR_PRICES_LP;
  const sidingNote = state.siding === 'vinyl' ? 'vinyl pricing' : 'LP pricing';
  el.innerHTML = SHOP_DOOR_ROWS.map(r => {
    const qty = state.shopDoors[r.width] || 0;
    return `<div class="qty-row">
      <label>${r.label} — Wood Build Shop Door</label>
      <input type="number" id="shop-door-${r.width}" value="${qty}" min="0" max="4"
             onchange="onShopDoorChange()">
      <span class="qty-note">${formatMoney(prices[r.width])} / set &nbsp;<span style="color:var(--muted);font-size:11px">(${sidingNote})</span></span>
    </div>`;
  }).join('');
}

window.onShopDoorChange = function() {
  SHOP_DOOR_ROWS.forEach(r => {
    state.shopDoors[r.width] = parseInt(document.getElementById(`shop-door-${r.width}`)?.value) || 0;
  });
  renderRampSection();
  if (state.internalMode) window.rebuildPreview?.();
};

window.renderShopDoorSection = renderShopDoorSection;

// ── Ramps ─────────────────────────────────────────────

function getAvailableRamps() {
  const slots = [];
  // Shop door ramps
  SHOP_DOOR_ROWS.forEach(r => {
    if ((state.shopDoors[r.width] || 0) > 0) {
      slots.push({ key: `shop_${r.width}`, sourceType: 'shop', width: r.width,
        label: `${r.label} Shop Door`, framing: '2×4 PT' });
    }
  });
  // Garage door ramps — one slot per unique width
  const gdWidths = new Set();
  (state.garageDoorItems || []).forEach(item => {
    const w = parseInt((item.spec || '').split('x')[0]);
    if (w && !gdWidths.has(w)) {
      gdWidths.add(w);
      slots.push({ key: `gd_${w}`, sourceType: 'gd', width: w,
        label: `${w}ft Garage Door`, framing: '2×6 PT' });
    }
  });
  return slots;
}

function renderRampSection() {
  const el = document.getElementById('ramp-section');
  if (!el) return;
  const slots = getAvailableRamps();
  if (!slots.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:6px 0">Add shop doors or garage doors in Step 7 to configure ramps.</div>';
    return;
  }
  el.innerHTML = slots.map(s => {
    const saved  = state.rampSelections[s.key] || { qty: 0, length: 4 };
    const pTable = s.sourceType === 'shop' ? CONFIG.RAMP_PRICES_SHOP : CONFIG.RAMP_PRICES_GD;
    const pRow   = pTable?.[s.width] || {};
    const price  = pRow[saved.length] || 0;
    const flag   = s.width === 32 ? '<span style="font-size:11px;color:var(--amber);margin-left:6px">⚑ uncommon — verify with customer</span>' : '';
    return `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;padding:10px;background:#f9fafb;border:1px solid var(--border);border-radius:5px">
      <div style="flex:1;min-width:160px">
        <div style="font-size:13px;font-weight:600">${s.label}${flag}</div>
        <div style="font-size:12px;color:var(--muted)">${s.framing} framing · PT 5/4 decking</div>
      </div>
      <select id="ramp-len-${s.key}" onchange="onRampChange('${s.key}')"
              style="padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:13px;font-family:inherit">
        <option value="4" ${saved.length === 4 ? 'selected' : ''}>4ft ramp</option>
        <option value="6" ${saved.length === 6 ? 'selected' : ''}>6ft ramp (+premium)</option>
      </select>
      <input type="number" id="ramp-qty-${s.key}" value="${saved.qty}" min="0" max="4"
             onchange="onRampChange('${s.key}')"
             style="width:60px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:13px">
      <span style="font-size:12px;font-weight:700;color:var(--green);min-width:60px;text-align:right">${saved.qty > 0 ? formatMoney(price * saved.qty) : '—'}</span>
    </div>`;
  }).join('');
}

window.onRampChange = function(key) {
  const length = parseInt(document.getElementById(`ramp-len-${key}`)?.value) || 4;
  const qty    = parseInt(document.getElementById(`ramp-qty-${key}`)?.value) || 0;
  state.rampSelections[key] = { qty, length };
  renderRampSection();
  if (state.internalMode) window.rebuildPreview?.();
};

window.renderRampSection = renderRampSection;

// Delegated remove handler
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-remove-type]');
  if (!btn) return;
  const idx  = parseInt(btn.dataset.removeIdx, 10);
  const type = btn.dataset.removeType;
  if (type === 'man-door') {
    state.manDoorItems.splice(idx, 1);
    renderManDoorBuilder();
  } else if (type === 'window') {
    state.windowItems.splice(idx, 1);
    renderWindowBuilder();
  } else if (type === 'garage-door') {
    state.garageDoorItems.splice(idx, 1);
    renderGarageDoorBuilder();
    renderRampSection();
    if (state.internalMode) window.renderFramingPanel();
  }
});
