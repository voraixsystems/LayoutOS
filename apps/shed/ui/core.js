// ============================================================
// shed-quote/core.js — State, Navigation & Initialization
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================

import {
  getNextEstimateNumber,
  incrementEstimateCounter,
  logQuote,
  formatCurrency,
  formatDate,
} from '../../../core/layoutos-core.js';

import {
  CONFIG, ANCHOR, loadPrices, getPrices,
  getBasePrice, validateSize, calculateMaterials,
  calculateVinylAddon, calculateDemoPrice,
  getConditioningPackage, buildQuote,
  calculateRoofSheathing, calculateWallSheathing,
  calculateShelving, getLoftAvailability,
  calculateFraming,
  formatMoney, getStyleList, getValidWidths, getValidLengths,
} from '../shed-logic.js';

import { isStepVisible, nextVisibleStep, TOTAL_STEPS } from '../engine/step-visibility.js';

// Side-effect imports — register window.* bindings
import './steps.js';
import './builders.js';
import './generate.js';
import './internal.js';

// ── State ────────────────────────────────────────────────
export const state = {
  step: 1,
  style: null,
  width: null,
  length: null,
  wallHeight: 8,
  roof: 'shingle',
  siding: 'lp',
  conditioningLevel: 0,
  iceWater: { enabled: false, coverage: 'lower6' },
  addons: { manDoors:0, windows:0, garageDoors:0, ramps:0, loftFlag:false, shelvingFlag:false },
  demo: { enabled:false, width:8, length:8, concrete:false, concreteRateSqft:1.15 },
  customer: { name:'', address:'', email:'', phone:'' },
  internalMode: false,
  devMode: false,
  internalNotes: '',
  roofSheathingOption: 'none',
  carriageVariant: 'carriage', // 'carriage'|'classic' — only used when style === 'carriage'
  roofColor: null,
  roofColorLabel: '',
  roofColorPremium: false,
  roofColorTier: 'base',    // 'base'|'crinkle'
  roofGauge: '29',          // '29'|'26'
  wallSheathingOption: 'none',
  manDoorItems: [],
  windowItems: [],
  garageDoorItems: [],
  shopDoors: { 32: 0, 36: 0, 64: 0, 72: 0 },
  rampSelections: {},  // { 'shop_32': { qty, length }, 'gd_8': { qty, length }, ... }
  shelvingSpec: { enabled: false, linearFt: 0, material: 'osb' },
  loftRequested: false,
  slab: { enabled: false, ratePerSqft: 13, noWoodFloor: false },
  paymentTier: 'standard',
  priceOverrides: {},
  manualItems: [],
  wallStudSize: '2x4x8',
  rafterSpacing: 24,
};

// ── Step nav ─────────────────────────────────────────────
const STEP_LABELS = {
  1:'Style', 2:'Size', 3:'Wall Ht', 4:'Roofing',
  5:'Siding', 6:'Foundation', 7:'Win & Doors',
  8:'Add-Ons', 9:'Demo', 10:'Customer', 11:'Summary',
};

function isStepDone(n) {
  if (n === 9) return !!(state.customer && state.customer.name);
  return n < state.step;
}

window.renderStepNav = function() {
  const list = document.getElementById('step-nav-list');
  if (!list) return;
  list.innerHTML = '';
  for (let n = 1; n <= TOTAL_STEPS; n++) {
    const done = isStepDone(n);
    const current = n === state.step;
    const item = document.createElement('div');
    item.className = 'snav-item' +
      (current ? ' snav-current' : '') +
      (done && !current ? ' snav-done' : '');
    item.innerHTML = `<span class="snav-num">${n}</span><span class="snav-label">${STEP_LABELS[n]}</span>`;
    item.onclick = () => window.jumpStep(n);
    list.appendChild(item);
  }
};

window.jumpStep = function(n) {
  state.step = n;
  window.renderStepNav();
  const el = document.getElementById('s' + n);
  if (el) {
    el.classList.add('step-expanded');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (n === 11) window.rebuildPreview?.();
};

window.toggleStep = function(n) {
  document.getElementById('s' + n)?.classList.toggle('step-expanded');
};

window.toggleStepNav = function() {
  document.getElementById('step-nav').classList.toggle('collapsed');
};

function activateStepCollapse() {
  document.querySelectorAll('.step-card').forEach(card => {
    card.classList.remove('step-expanded');
    const title = card.querySelector('.step-title');
    if (title && !title.dataset.collapseWired) {
      const n = parseInt(card.id.slice(1));
      title.addEventListener('click', () => window.toggleStep(n));
      title.dataset.collapseWired = '1';
    }
  });
  document.getElementById('s' + state.step)?.classList.add('step-expanded');
}

// ── Draft autosave ───────────────────────────────────────
const DRAFT_KEY = 'shed_draft';

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  updateDraftFooter();
}

window.deleteDraft = function() {
  localStorage.removeItem(DRAFT_KEY);
  updateDraftFooter();
};

function updateDraftFooter() {
  const el = document.getElementById('footer-draft-link');
  if (!el) return;
  const raw = localStorage.getItem(DRAFT_KEY);
  el.style.display = (raw && JSON.parse(raw).step >= 5) ? 'inline' : 'none';
}

function restoreSizeDropdowns(savedWidth, savedLength) {
  if (!state.style) return;
  const widths = getValidWidths(state.style);
  const wSel = document.getElementById('sel-width');
  wSel.innerHTML = widths.map(w => `<option value="${w}">${w} ft</option>`).join('');
  state.width = widths.includes(savedWidth) ? savedWidth : widths[0];
  wSel.value = state.width;
  const lengths = getValidLengths(state.style, state.width);
  const lSel = document.getElementById('sel-length');
  lSel.innerHTML = lengths.map(l => `<option value="${l}">${l} ft</option>`).join('');
  state.length = lengths.includes(savedLength) ? savedLength : lengths[0];
  lSel.value = state.length;
}

function restoreStateToUI() {
  buildStyleGrid();
  if (state.style && state.width && state.length) restoreSizeDropdowns(state.width, state.length);
  // Wall height
  ['8','10'].forEach(h => {
    const row = document.getElementById('wh-' + h);
    if (!row) return;
    row.classList.toggle('selected', state.wallHeight === parseInt(h));
    const inp = row.querySelector('input');
    if (inp) inp.checked = state.wallHeight === parseInt(h);
  });
  // Roof type
  ['shingle','metal'].forEach(r => {
    const row = document.getElementById('roof-' + r);
    if (!row) return;
    row.classList.toggle('selected', state.roof === r);
    const inp = row.querySelector('input');
    if (inp) inp.checked = state.roof === r;
  });
  const metalOpts = document.getElementById('metal-roof-options');
  const shingleOpts = document.getElementById('shingle-color-options');
  if (metalOpts) metalOpts.style.display = state.roof === 'metal' ? 'block' : 'none';
  if (shingleOpts) shingleOpts.style.display = state.roof === 'shingle' ? 'block' : 'none';
  // Roof sheathing
  [['none','none'],['vb','vb_only'],['osb','osb'],['zip','zip']].forEach(([id, key]) => {
    const row = document.getElementById('rso-' + id);
    if (!row) return;
    row.classList.toggle('selected', state.roofSheathingOption === key);
    const inp = row.querySelector('input');
    if (inp) inp.checked = state.roofSheathingOption === key;
  });
  // Siding
  ['lp','vinyl'].forEach(s => {
    const row = document.getElementById('siding-' + s);
    if (!row) return;
    row.classList.toggle('selected', state.siding === s);
    const inp = row.querySelector('input');
    if (inp) inp.checked = state.siding === s;
  });
  const vinylOpts = document.getElementById('vinyl-wall-options');
  if (vinylOpts) vinylOpts.style.display = state.siding === 'vinyl' ? 'block' : 'none';
  // Wall sheathing
  [['none','none'],['hw','house_wrap'],['zip','zip']].forEach(([id, key]) => {
    const row = document.getElementById('wso-' + id);
    if (!row) return;
    row.classList.toggle('selected', state.wallSheathingOption === key);
    const inp = row.querySelector('input');
    if (inp) inp.checked = state.wallSheathingOption === key;
  });
  // Customer fields
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  setVal('cust-name', state.customer.name);
  setVal('cust-addr', state.customer.address);
  setVal('cust-email', state.customer.email);
  setVal('cust-phone', state.customer.phone);
  // Carriage variant
  const cvp = document.getElementById('carriage-variant-picker');
  if (cvp) cvp.style.display = state.style === 'carriage' ? 'block' : 'none';
}

window.resumeDraft = function() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  const saved = JSON.parse(raw);
  Object.assign(state, saved);
  restoreStateToUI();
  window.renderShopDoorSection?.();
  window.renderRampSection?.();
  const target = saved.step || 1;
  if (state.internalMode) {
    window.renderStepNav();
    window.jumpStep(target);
  } else {
    document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active'));
    document.getElementById('s' + target)?.classList.add('active');
    updateProgress();
  }
};

// ── Init ─────────────────────────────────────────────────
await loadPrices();
buildStyleGrid();
window.renderShopDoorSection?.();
window.renderRampSection?.();
updateProgress();
updateDraftFooter();

// ── Keyboard listeners: LAYOUT (internal) + DEVMODE ─────
let keyBuf = '';
let devKeyBuf = '';
document.addEventListener('keydown', (e) => {
  if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  keyBuf    += e.key; keyBuf    = keyBuf.slice(-6);
  devKeyBuf += e.key; devKeyBuf = devKeyBuf.slice(-7);
  if (keyBuf === CONFIG.INTERNAL_UNLOCK) {
    state.internalMode = true;
    document.getElementById('int-badge').style.display = 'inline-block';
    document.getElementById('internal-panel').style.display = 'block';
    document.getElementById('int-direct-btn').style.display = 'inline-block';
    document.getElementById('btn-generate').textContent = 'Generate Estimate →';
    document.body.style.setProperty('--blue-lt', '#f5f3ff');
    document.body.classList.add('internal-mode');
    window.renderFramingPanel();
    window.rebuildPreview();
    activateStepCollapse();
    window.renderStepNav();
  }
  if (devKeyBuf === 'DEVMODE') window.activateDevMode();
});

// ── Step grid / navigation ───────────────────────────────
function updateProgress() {
  const pct = (state.step / TOTAL_STEPS) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('step-indicator').textContent =
    `Step ${state.step} of ${TOTAL_STEPS}`;
}

window.goStep = function(n) {
  if (!isStepVisible(n, state.internalMode)) {
    const dir = n > state.step ? 1 : -1;
    n = nextVisibleStep(n, dir, state.internalMode);
    if (n === state.step) return;
  }
  if (n > state.step) {
    const err = validateStep(state.step);
    if (err) {
      showStepError(state.step, err);
      return;
    }
    clearStepError(state.step);
  }
  document.getElementById('s' + state.step).classList.remove('active');
  state.step = n;
  document.getElementById('s' + n).classList.add('active');
  if (state.internalMode) document.getElementById('s' + n)?.classList.add('step-expanded');
  updateProgress();
  if (n === 11) window.rebuildPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  saveDraft();
  window.renderStepNav();
};

function validateStep(step) {
  if (step === 1 && !state.style) return 'Please select a style.';
  if (step === 2) {
    if (!state.width || !state.length) return 'Select width and length.';
    const v = validateSize(state.style, state.width, state.length);
    if (!v.valid) return v.reason;
  }
  if (step === 9) {
    if (!document.getElementById('cust-name').value.trim())
      return 'Customer name is required.';
  }
  return null;
}

function showStepError(step, msg) {
  const el = document.getElementById('s' + step + '-error');
  if (el) el.textContent = msg;
}
function clearStepError(step) {
  const el = document.getElementById('s' + step + '-error');
  if (el) el.textContent = '';
}

// ── Step 1: Style grid ───────────────────────────────────
function buildStyleGrid() {
  const grid = document.getElementById('style-grid');
  grid.innerHTML = '';
  getStyleList().forEach(s => {
    const card = document.createElement('div');
    card.className = 'style-card' + (state.style === s.key ? ' selected' : '');
    card.dataset.key = s.key;
    card.innerHTML = `
      <div class="style-name">${s.label}</div>
      <div class="style-desc">${s.description}</div>
      <div class="style-sizes">${s.widthRange[0]}–${s.widthRange[1]}ft wide × ${s.lengthRange[0]}–${s.lengthRange[1]}ft long</div>
    `;
    card.addEventListener('click', () => {
      document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.style = s.key;
      clearStepError(1);
      window.populateSizeDropdowns();
      const cvp = document.getElementById('carriage-variant-picker');
      if (cvp) cvp.style.display = s.key === 'carriage' ? 'block' : 'none';
      if (state.internalMode) window.renderFramingPanel();
      if (state.step <= 1) {
        state.internalMode ? window.jumpStep(2) : window.goStep(2);
      } else {
        window.renderStepNav();
        saveDraft();
      }
    });
    grid.appendChild(card);
  });
}

// ── Expose for inline handlers ────────────────────────────
window.saveDraftFromStep = saveDraft;
window.showStepError = showStepError;
window.clearStepError = clearStepError;
