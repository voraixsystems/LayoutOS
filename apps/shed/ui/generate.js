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

  window.updatePriceWidgetFull?.(quote);
  renderPreview(quote);
  if (state.internalMode) {
    state._lastQuoteTotal = quote.pricing?.total ?? null;
    renderMarginView(quote);
    buildOverrideList(quote);
    window.renderFramingPanel();
    if (document.getElementById('payment-tier')?.value === 'three_tier') updateMilestones();
  }
  if (state.devMode) { window.renderDevMarginView(quote); window.refreshDevFlags(); }
}

function renderPreview(quote) {
  const el = document.getElementById('quote-preview');
  const { lineItems, pricing } = quote;
  const b = quote.building;

  const roofType    = b.roof === 'metal' ? 'Metal R-Panel' : 'Architectural Shingle';
  const colorSuffix = b.roofColorLabel ? ` — ${b.roofColorLabel}${b.isAutoColor ? ' (default)' : ''}` : '';
  const roofLabel   = `${roofType}${colorSuffix}`;

  if (!state.internalMode) {
    // Client mode — specs + total only, no line item breakdown
    const sidingLabel = b.siding === 'vinyl' ? 'Vinyl' : 'LP SmartSide';
    const addOns = lineItems.filter(i =>
      i.group && !['base','roof','siding','conditioning'].includes(i.group) && i.description
    );

    let html = `
      <div class="ql-section">
        <div class="ql-section-title">Your Quote Summary</div>
        <div class="ql-row"><div class="ql-desc">${ANCHOR[b.style]?.label || b.style}</div><div>${b.width}×${b.length}ft · ${b.sqft} sqft</div></div>
        <div class="ql-row"><div class="ql-desc">Wall height</div><div>${b.wallHeight}ft</div></div>
        <div class="ql-row"><div class="ql-desc">Roof</div><div>${roofLabel}</div></div>
        <div class="ql-row"><div class="ql-desc">Siding</div><div>${sidingLabel}</div></div>
      </div>`;

    if (addOns.length) {
      html += `<div class="ql-section"><div class="ql-section-title">Add-Ons</div>`;
      addOns.forEach(i => {
        html += `<div class="ql-row"><div class="ql-desc">${i.description}</div><div>${i.qty > 1 ? '×' + i.qty : ''}</div></div>`;
      });
      html += `</div>`;
    }

    html += `
      <div class="ql-total-row">
        <span>QUOTE TOTAL</span>
        <span>${formatMoney(pricing.total)}</span>
      </div>
      <div class="ql-materials" style="margin-top:10px;font-size:12px">
        Price subject to site conditions. Contact us to receive your formal written estimate.
      </div>`;

    if (quote.condensationWarning) {
      html += `<div class="notice notice-warn" style="margin-top:12px">
        ⚠ Metal roof + no conditioning — condensation risk. Consider adding a conditioning package.
      </div>`;
    }

    el.innerHTML = html;
    return;
  }

  // Internal mode — full line item breakdown
  let html = `
    <div class="ql-section">
      <div class="ql-section-title">Building</div>
      <div class="ql-row">
        <div class="ql-desc">${ANCHOR[b.style]?.label || b.style}</div>
        <div>${b.width}×${b.length}ft</div>
        <div>${b.sqft} sqft</div>
      </div>
      <div class="ql-row"><div class="ql-desc">Wall height</div><div>${b.wallHeight}ft</div></div>
      <div class="ql-row"><div class="ql-desc">Roof</div><div>${roofLabel}</div></div>
      <div class="ql-row"><div class="ql-desc">Siding</div><div>${b.siding === 'vinyl' ? 'Vinyl' : 'LP SmartSide'}</div></div>
      <div class="ql-row"><div class="ql-desc">Conditioning</div><div>${quote.conditioning?.label || '—'}</div></div>
    </div>
    <div class="ql-section">
      <div class="ql-section-title">Line Items</div>
      <div class="ql-row" style="font-size:12px;color:var(--muted);font-weight:700">
        <div class="ql-desc">Description</div>
        <div class="ql-qty">Qty</div>
        <div class="ql-price">Cost</div>
      </div>`;

  lineItems.forEach(item => {
    html += `
      <div class="ql-row">
        <div class="ql-desc">${item.description}${item.flag ? `<div class="flag-note">⚑ ${item.flag}</div>` : ''}</div>
        <div class="ql-qty">${item.qty || 1}</div>
        <div class="ql-price ${item.isTBD ? 'tbd' : ''}">${formatMoney(item.total)}</div>
      </div>`;
  });

  html += `</div>
    <div class="ql-total-row">
      <span>ESTIMATED TOTAL</span>
      <span>${formatMoney(pricing.total)}</span>
    </div>`;

  if (quote.condensationWarning) {
    html += `<div class="notice notice-warn" style="margin-top:12px">
      ⚠ Metal roof + no conditioning — condensation risk. Consider adding a conditioning package.
    </div>`;
  }
  if (quote.autoNotes?.length) {
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
  Object.keys(state.priceOverrides).forEach(k => {
    if (!state.priceOverrides[k]) delete state.priceOverrides[k];
  });
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
    const id  = el.id.replace('ov-', '');
    const val = parseFloat(el.value);
    if (!isNaN(val) && val > 0) state.priceOverrides[id] = val;
    else delete state.priceOverrides[id];
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
  if (!state.internalMode) {
    const name = document.getElementById('cust-name').value.trim();
    if (!name) {
      window.goStep(11);
      window.showStepError(11, 'Your name is required to generate a quote.');
      return;
    }
    const letter = resolveEstimateLetter();
    const quote  = buildQuote({ ...state, estimateNumber: getNextEstimateNumber(letter) });
    logQuote(quote, 'client-quote');
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(quote))));
    localStorage.setItem('layoutos_current_quote', JSON.stringify(quote));
    window.open(`../../core/quote.html?q=${encoded}`, '_blank');
    return;
  }
  window.openGenModal(!!directMode);
};

window.openGenModal = function(directMode) {
  const name = document.getElementById('cust-name').value.trim();
  if (!name && !directMode && !state.internalMode) {
    window.goStep(11);
    window.showStepError(11, 'Customer name required before generating.');
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

  const panelPay  = collectCustomPayment();
  const isTierred = document.getElementById('payment-tier')?.value === 'three_tier';
  document.getElementById('gen-payment').value = isTierred
    ? (panelPay || '3-tier payment schedule — see milestone breakdown below.')
    : (panelPay || '50% deposit required to schedule. Balance due upon completion.');

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
  quote.paymentNote       = payTerms;
  const milestones = collectMilestones();
  if (milestones) quote.paymentMilestones = milestones;

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

// ── Milestone editor ─────────────────────────────────────
window.onPaymentTierChange = function() {
  const tier = document.getElementById('payment-tier').value;
  document.getElementById('milestone-editor').style.display =
    tier === 'three_tier' ? 'block' : 'none';
  if (tier === 'three_tier') updateMilestones();
  rebuildPreview();
};

window.updateMilestones = function() {
  const total = state._lastQuoteTotal || 0;
  const p1 = parseFloat(document.getElementById('ms-pct-1').value) || 0;
  const p2 = parseFloat(document.getElementById('ms-pct-2').value) || 0;
  const p3 = Math.max(0, 100 - p1 - p2);
  const warn = document.getElementById('ms-warn');

  if (p1 + p2 >= 100) {
    warn.style.display = 'inline';
  } else {
    warn.style.display = 'none';
  }

  const a1 = Math.round(total * p1 / 100);
  const a2 = Math.round(total * p2 / 100);
  const a3 = total - a1 - a2;

  document.getElementById('ms-pct-3').textContent = p3.toFixed(1) + '%';
  document.getElementById('ms-amt-1').textContent = '$' + a1.toLocaleString();
  document.getElementById('ms-amt-2').textContent = '$' + a2.toLocaleString();
  document.getElementById('ms-amt-3').textContent = '$' + a3.toLocaleString();
};

window.roundMilestones = function() {
  const total = state._lastQuoteTotal || 0;
  const p1 = parseFloat(document.getElementById('ms-pct-1').value) || 0;
  const p2 = parseFloat(document.getElementById('ms-pct-2').value) || 0;
  const r = n => Math.round(n / 500) * 500;

  const a1r = r(total * p1 / 100);
  const a2r = r(total * p2 / 100);
  const a3r = total - a1r - a2r;

  document.getElementById('ms-amt-1').textContent = '$' + a1r.toLocaleString();
  document.getElementById('ms-amt-2').textContent = '$' + a2r.toLocaleString();
  document.getElementById('ms-amt-3').textContent = '$' + a3r.toLocaleString();
};

function collectMilestones() {
  const tier = document.getElementById('payment-tier')?.value;
  if (tier !== 'three_tier') return null;
  const parse  = s => parseInt((s || '').replace(/[$,]/g, '')) || 0;
  const label2 = (document.getElementById('ms-label-2')?.value?.trim()) || 'Progress payment';
  return [
    { label: 'Deposit — due at signing', amount: parse(document.getElementById('ms-amt-1').textContent) },
    { label: label2,                     amount: parse(document.getElementById('ms-amt-2').textContent) },
    { label: 'Balance — due at completion', amount: parse(document.getElementById('ms-amt-3').textContent) },
  ];
}

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
