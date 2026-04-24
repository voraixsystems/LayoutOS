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
  shelvingSpec: { enabled: false, linearFt: 0, material: 'osb' },
  loftRequested: false,
  slab: { enabled: false, ratePerSqft: 13, noWoodFloor: false },
  paymentTier: 'standard',
  priceOverrides: {},
  manualItems: [],
  wallStudSize: '2x4x8',
  rafterSpacing: 24,
};

// ── Init ─────────────────────────────────────────────────
await loadPrices();
document.getElementById('price-ramp').textContent = `$${CONFIG.ADDON_RAMP_PER_OPENING} per opening`;
buildStyleGrid();
updateProgress();

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
    document.body.style.setProperty('--blue-lt', '#f5f3ff');
    document.body.classList.add('internal-mode');
    window.renderFramingPanel();
    window.rebuildPreview();
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
  updateProgress();
  if (n === 10) window.rebuildPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
    });
    grid.appendChild(card);
  });
}

// ── Expose for inline handlers ────────────────────────────
window.showStepError = showStepError;
window.clearStepError = clearStepError;
