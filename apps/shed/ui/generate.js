// ============================================================
// shed-quote/generate.js — Preview, Generate Modal & Quote Output
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================

import { state } from './core.js';
import {
  buildQuote, formatMoney, CONFIG, ANCHOR, getPrices,
} from '../shed-logic.js';
import {
  getNextEstimateNumber, incrementEstimateCounter, logQuote, formatRevisionNumber,
} from '../../../core/layoutos-core.js';

// ── Step 11: Preview ─────────────────────────────────────
function rebuildPreview() {
  state.customer.name    = document.getElementById('cust-name').value.trim();
  state.customer.address = document.getElementById('cust-addr').value.trim();
  state.customer.email   = document.getElementById('cust-email').value.trim();
  state.customer.phone   = document.getElementById('cust-phone').value.trim();
  if (state.internalMode) {
    state.internalNotes = document.getElementById('internal-notes').value;
    state.paymentTier   = document.getElementById('payment-tier').value;
  }
  collectManualItems();
  collectOverrides();

  const letter = resolveEstimateLetter();

  const quote = buildQuote({
    ...state,
    estimateNumber: getNextEstimateNumber(letter),
  });
  quote._internalMode = !!state.internalMode;

  renderPreview(quote);
  if (state.internalMode) {
    state._lastQuoteTotal = quote.pricing?.total ?? null;
    renderMarginView(quote);
    buildOverrideList(quote);
    window.renderFramingPanel();
  }
  if (state.devMode) { window.renderDevMarginView(quote); window.refreshDevFlags(); }
}

function renderPreview(quote) {
  const el = document.getElementById('quote-preview');
  const { lineItems, pricing, materials } = quote;

  let html = `
    <div class="ql-section">
      <div class="ql-section-title">Building</div>
      <div class="ql-row">
        <div class="ql-desc">${ANCHOR[quote.building.style]?.label || quote.building.style}</div>
        <div>${quote.building.width}×${quote.building.length}ft</div>
        <div>${quote.building.sqft} sqft</div>
      </div>
      <div class="ql-row">
        <div class="ql-desc">Wall height</div>
        <div>${quote.building.wallHeight}ft</div>
      </div>
      <div class="ql-row">
        <div class="ql-desc">Roof</div>
        <div>${quote.building.roof === 'metal' ? 'Metal R-Panel' : 'Architectural Shingle'}</div>
      </div>
      <div class="ql-row">
        <div class="ql-desc">Siding</div>
        <div>${quote.building.siding === 'vinyl' ? 'Vinyl' : 'LP SmartSide'}</div>
      </div>
      <div class="ql-row">
        <div class="ql-desc">Conditioning</div>
        <div>${quote.conditioning.label}</div>
      </div>
    </div>

    <div class="ql-section">
      <div class="ql-section-title">Line Items</div>
      <div class="ql-row" style="font-size:12px;color:var(--muted);font-weight:700">
        <div class="ql-desc">Description</div>
        <div class="ql-qty">Qty</div>
        <div class="ql-price">Cost</div>
      </div>
  `;

  lineItems.forEach(item => {
    html += `
      <div class="ql-row">
        <div class="ql-desc">
          ${item.description}
          ${item.flag ? `<div class="flag-note">⚑ ${item.flag}</div>` : ''}
        </div>
        <div class="ql-qty">${item.qty || 1}</div>
        <div class="ql-price ${item.isTBD ? 'tbd' : ''}">${formatMoney(item.total)}</div>
      </div>
    `;
  });

  html += `
    </div>
    <div class="ql-total-row">
      <span>ESTIMATED TOTAL</span>
      <span>${formatMoney(pricing.total)}</span>
    </div>
  `;

  if (quote.condensationWarning) {
    html += `<div class="notice notice-warn" style="margin-top:12px">
      ⚠ Metal roof + no conditioning — condensation risk. Consider adding a conditioning package.
    </div>`;
  }

  if (quote.autoNotes.length) {
    html += `<div class="ql-materials" style="margin-top:12px">`;
    quote.autoNotes.forEach(n => { html += `<div>• ${n}</div>`; });
    html += `</div>`;
  }

  el.innerHTML = html;
}

function renderMarginView(quote) {
  const { materials } = quote;
  const p = getPrices();
  const rows = [
    ['LP SmartSide sheets', materials.lpSheets, p.lp_smartside_sheet],
    ['Shingle squares', materials.shingleSquares, p.shingle_square],
    ['Roof sheathing sheets', materials.roofSheets, p.zip_roof_sheet],
    ['Wall sheathing sheets', materials.wallSheets, p.zip_wall_sheet],
    ['Fir strips (LF)', materials.furStripsLF, p.fir_strip_per_lf],
  ];
  let html = '<table style="width:100%;font-size:12px"><tr style="font-weight:700"><td>Material</td><td>Qty</td><td>Unit $</td><td>Subtotal</td></tr>';
  let matTotal = 0;
  rows.forEach(([label, qty, unitPrice]) => {
    const sub = Math.round(qty * unitPrice);
    matTotal += sub;
    html += `<tr><td>${label}</td><td>${qty}</td><td>${formatMoney(unitPrice)}</td><td>${formatMoney(sub)}</td></tr>`;
  });
  html += `<tr style="font-weight:700"><td colspan="3">Est. Material Cost</td><td>${formatMoney(matTotal)}</td></tr></table>`;
  document.getElementById('margin-detail').innerHTML = html;
}

function buildOverrideList(quote) {
  const list = document.getElementById('override-list');
  const overrideable = quote.lineItems.filter(i => !i.isTBD && i.total !== null);
  list.innerHTML = overrideable.map(item => `
    <div class="override-row">
      <label>${item.description.slice(0, 35)}</label>
      <input type="number" id="ov-${item.id}"
             value="${state.priceOverrides[item.id] ?? item.total}"
             onchange="collectOverridesAndRebuild()">
    </div>
  `).join('');
}

window.collectOverridesAndRebuild = function() {
  collectOverrides();
  rebuildPreview();
};

function collectOverrides() {
  document.querySelectorAll('[id^="ov-"]').forEach(el => {
    const id = el.id.replace('ov-', '');
    const val = parseFloat(el.value);
    if (!isNaN(val)) state.priceOverrides[id] = val;
  });
}

// ── Manual line items (internal) ────────────────────────
window.addManualItem = function() {
  const list = document.getElementById('manual-items-list');
  const idx  = state.manualItems.length;
  state.manualItems.push({ description: '', qty: 1, price: 0 });
  const row = document.createElement('div');
  row.className = 'manual-item-row';
  row.id = `mi-row-${idx}`;
  row.innerHTML = `
    <input type="text"   placeholder="Description" id="mi-desc-${idx}"
           oninput="updateManualItem(${idx})">
    <input type="number" placeholder="$" id="mi-price-${idx}" min="0"
           oninput="updateManualItem(${idx})">
    <input type="number" placeholder="Qty" id="mi-qty-${idx}" value="1" min="1"
           oninput="updateManualItem(${idx})">
    <button onclick="removeManualItem(${idx})">✕</button>
  `;
  list.appendChild(row);
};

window.updateManualItem = function(idx) {
  state.manualItems[idx] = {
    description: document.getElementById(`mi-desc-${idx}`)?.value || '',
    price: parseFloat(document.getElementById(`mi-price-${idx}`)?.value) || 0,
    qty:   parseInt(document.getElementById(`mi-qty-${idx}`)?.value)     || 1,
  };
  rebuildPreview();
};

window.removeManualItem = function(idx) {
  document.getElementById(`mi-row-${idx}`)?.remove();
  state.manualItems[idx] = { description: '', qty: 1, price: 0 };
  rebuildPreview();
};

function collectManualItems() {
  // Items are updated live via updateManualItem
}

// ── Unified Generate Modal ────────────────────────────────
let _genSuffix = '';
let _intSuffix = '';

window.generateQuote = function(directMode) {
  window.openGenModal(!!directMode);
};

window.openGenModal = function(directMode) {
  const name = document.getElementById('cust-name').value.trim();
  if (!name && !directMode && !state.internalMode) {
    window.goStep(10);
    window.showStepError(10, 'Customer name required before generating.');
    return;
  }

  const letter = resolveEstimateLetter();
  const estNum = getNextEstimateNumber(letter);
  const today  = new Date().toLocaleDateString('en-US',
    { month: 'long', day: 'numeric', year: 'numeric' });

  document.getElementById('gen-estnum').value = estNum;
  document.getElementById('gen-date').value   = today;
  document.getElementById('gen-name').value   = name;
  document.getElementById('gen-addr').value   = document.getElementById('cust-addr').value.trim();
  document.getElementById('gen-phone').value  = document.getElementById('cust-phone').value.trim();
  document.getElementById('gen-email').value  = document.getElementById('cust-email').value.trim();
  document.getElementById('gen-desc').value   = '';
  document.getElementById('gen-price').value  = '';

  const specCard = document.getElementById('gen-spec-card');
  const descWrap = document.getElementById('gen-desc-wrap');
  if (state.style && state.width && state.length) {
    const styleEl = document.querySelector(`#s1 .style-card[data-style="${state.style}"] .sc-label`);
    const styleLabel = styleEl ? styleEl.textContent : state.style;
    const roofLabel  = state.roof    || 'shingle';
    const sidingLabel = state.siding || 'LP';
    specCard.innerHTML = `<strong>${styleLabel}</strong> — ${state.width}×${state.length}ft`
      + `<div class="spec-note">${roofLabel} roof · ${sidingLabel} siding`
      + (state.wallHeight === 10 ? ' · 10ft walls' : '')
      + `</div>`;
    specCard.style.display = 'block';
    descWrap.style.display = 'none';
  } else {
    specCard.style.display = 'none';
    descWrap.style.display = 'block';
  }

  const panelEst  = collectEstimatorFromPanel();
  const panelName = (document.getElementById('int-est-name')?.value || '').trim();
  document.getElementById('gen-est-name').value  = panelName;
  document.getElementById('gen-est-phone').value = panelEst?.phone   || '';
  document.getElementById('gen-est-email').value = panelEst?.email   || '';
  document.getElementById('gen-est-web').value   = panelEst?.website || '';
  _genSuffix = _intSuffix;
  document.getElementById('gen-suf-jr').classList.toggle('active', _genSuffix === 'Jr.');
  document.getElementById('gen-suf-sr').classList.toggle('active', _genSuffix === 'Sr.');

  const panelPay = collectCustomPayment();
  document.getElementById('gen-payment').value = panelPay ||
    '50% deposit required to schedule. Balance due upon completion.';

  document.getElementById('gen-modal-backdrop').classList.add('open');
  setTimeout(() => {
    const nameField = document.getElementById('gen-name');
    if (!nameField.value) nameField.focus();
    else document.getElementById('gen-estnum').select();
  }, 60);
};

window.closeGenModal = function() {
  document.getElementById('gen-modal-backdrop').classList.remove('open');
};

window.toggleGenSuffix = function(suf) {
  _genSuffix = (_genSuffix === suf) ? '' : suf;
  document.getElementById('gen-suf-jr').classList.toggle('active', _genSuffix === 'Jr.');
  document.getElementById('gen-suf-sr').classList.toggle('active', _genSuffix === 'Sr.');
};

window.toggleIntEstSuffix = function(suf) {
  _intSuffix = (_intSuffix === suf) ? '' : suf;
  document.getElementById('int-suf-jr').classList.toggle('active', _intSuffix === 'Jr.');
  document.getElementById('int-suf-sr').classList.toggle('active', _intSuffix === 'Sr.');
};

function collectEstimatorFromPanel() {
  const name  = (document.getElementById('int-est-name')?.value  || '').trim();
  const phone = (document.getElementById('int-est-phone')?.value || '').trim();
  const email = (document.getElementById('int-est-email')?.value || '').trim();
  const web   = (document.getElementById('int-est-web')?.value   || '').trim();
  if (!name && !phone && !email && !web) return null;
  return { name: name + (_intSuffix ? ', ' + _intSuffix : ''), phone, email, website: web };
}

function collectCustomPayment() {
  return (document.getElementById('custom-payment-note')?.value || '').trim();
}

window.confirmGenModal = function() {
  const estNum   = document.getElementById('gen-estnum').value.trim() || 'DRAFT';
  const date     = document.getElementById('gen-date').value.trim();
  const name     = document.getElementById('gen-name').value.trim();
  const addr     = document.getElementById('gen-addr').value.trim();
  const phone    = document.getElementById('gen-phone').value.trim();
  const email    = document.getElementById('gen-email').value.trim();
  const desc     = document.getElementById('gen-desc').value.trim();
  const priceRaw = parseFloat(document.getElementById('gen-price').value);
  const estName  = document.getElementById('gen-est-name').value.trim();
  const estPhone = document.getElementById('gen-est-phone').value.trim();
  const estEmail = document.getElementById('gen-est-email').value.trim();
  const estWeb   = document.getElementById('gen-est-web').value.trim();
  const payTerms = document.getElementById('gen-payment').value.trim();

  state.customer.name    = name;
  state.customer.address = addr;
  state.customer.phone   = phone;
  state.customer.email   = email;

  const quote = buildQuote({ ...state, estimateNumber: estNum });
  quote._internalMode = !!state.internalMode;
  if (date)                             quote.date        = date;
  if (desc)                             quote.projectDesc = desc;
  if (!isNaN(priceRaw) && priceRaw > 0) quote.manualPrice = priceRaw;
  if (estName || estPhone || estEmail || estWeb) {
    const fullName = estName + (_genSuffix ? ', ' + _genSuffix : '');
    quote.estimator = { name: fullName, phone: estPhone, email: estEmail, website: estWeb };
  }
  quote.paymentNote = payTerms;

  window.closeGenModal();
  logQuote(quote, 'shed');
  incrementEstimateCounter();

  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(quote))));
  localStorage.setItem('layoutos_current_quote', JSON.stringify(quote));
  window.open(`../../core/proposal.html?q=${encoded}`, '_blank');
};

// Backdrop click closes modal
document.getElementById('gen-modal-backdrop').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) window.closeGenModal();
});

// ── Helpers ───────────────────────────────────────────────
function resolveEstimateLetter() {
  return CONFIG.PREPARER_LETTER || 'F';
}

// ── Revision suffix helper ────────────────────────────────
window.applyRevisionSuffix = function() {
  const base = document.getElementById('gen-estnum')?.value?.trim();
  const rev  = parseInt(document.getElementById('gen-revision')?.value) || 0;
  if (!base) return;
  const stripped = base.replace(/\.\d+(-\d{2})$/, '$1');
  document.getElementById('gen-estnum').value = formatRevisionNumber(stripped, rev);
};

// ── Expose for cross-module calls ─────────────────────────
window.rebuildPreview        = rebuildPreview;
window.resolveEstimateLetter = resolveEstimateLetter;
