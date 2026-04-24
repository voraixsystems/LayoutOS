// ============================================================
// LAYOUTOS-CORE.JS  —  Shared infrastructure for all modules
// Fudd Service, Le Roy NY
// ============================================================
// MODULE-AGNOSTIC — no shed, post-frame, or trade-specific
// logic belongs here.
// Import from this file in any module that needs estimate
// numbering, quote logging, or output formatting.
// ============================================================

// ------------------------------------------------------------
// CORE localStorage KEYS — single definition for all modules.
// These must never be redefined elsewhere. If a module needs
// its own key, add it here under a module-prefixed name.
// ------------------------------------------------------------
const CORE_KEYS = {
  ESTIMATE_COUNTER: 'layoutos_estimate_counter',  // integer — increments per confirmed quote
  ESTIMATE_YEAR:    'layoutos_estimate_year',      // YYYY — counter resets when year changes
  QUOTES_LOG:       'layoutos_quotes_log',         // array of all confirmed quote records
};

// ============================================================
// 1. ESTIMATE COUNTER
// Format: [LETTER][counter]-[YY]
//   LETTER = first letter of customer first name, uppercased
//   counter = sequential integer, resets to 1 each new year
//   YY = 2-digit year
// e.g. F28-26 for customer "Frank", estimate #28, year 2026
//
// getNextEstimateNumber(firstNameLetter)
//   Returns the number the NEXT quote WOULD receive.
//   Does NOT write to localStorage — safe to call repeatedly
//   for previews without burning estimate numbers.
//
// incrementEstimateCounter()
//   Commits the increment. Call exactly ONCE per confirmed
//   quote, AFTER the quote is built and saved to the log.
// ============================================================
export function getNextEstimateNumber(firstNameLetter) {
  // Accept either a single letter (default: first letter of first name,
  // e.g. "F" for Frank → "F28-26") OR a short alpha prefix override
  // (e.g. "Fudd" → "Fudd28-26"). UPDATE 2026-04-17.
  const raw = (firstNameLetter || 'X').toString().trim().toUpperCase();
  // Strip any non-alpha chars for safety; fall back to 'X' if empty.
  const prefix = raw.replace(/[^A-Z]/g, '') || 'X';
  const letter = prefix.slice(0, 8); // cap at 8 chars
  const now    = new Date();
  const yr     = now.getFullYear();
  const yr2    = String(yr).slice(-2);

  const storedYear = parseInt(localStorage.getItem(CORE_KEYS.ESTIMATE_YEAR) || '0');
  let counter      = parseInt(localStorage.getItem(CORE_KEYS.ESTIMATE_COUNTER) || '0');

  // Counter would reset on a new year — reflect that in the preview
  if (storedYear !== yr) counter = 0;

  return `${letter}${counter + 1}-${yr2}`;
}

export function incrementEstimateCounter() {
  // Commits the counter — call AFTER quote is saved to log, not before
  const now  = new Date();
  const yr   = now.getFullYear();
  let storedYear = parseInt(localStorage.getItem(CORE_KEYS.ESTIMATE_YEAR) || '0');
  let counter    = parseInt(localStorage.getItem(CORE_KEYS.ESTIMATE_COUNTER) || '0');

  if (storedYear !== yr) {
    // New year — reset and record the new year
    counter = 0;
    localStorage.setItem(CORE_KEYS.ESTIMATE_YEAR, String(yr));
  }
  counter++;
  localStorage.setItem(CORE_KEYS.ESTIMATE_COUNTER, String(counter));
  return counter;
}

// ============================================================
// 2. QUOTES LOG
// All confirmed quotes are appended here permanently.
// This is business training data — never auto-delete.
//
// logQuote(quoteObject, moduleName)
//   Appends quote to the log with timestamp and module tag.
//   Pass moduleName as a string matching MODULES key (e.g. 'shed').
//
// getQuotesLog() — returns full array, newest last
//
// clearQuotesLog() — dev use only; requires user confirmation
// ============================================================
export function logQuote(quoteObject, moduleName) {
  const log = getQuotesLog();
  log.push({
    timestamp: new Date().toISOString(),
    module:    moduleName || 'unknown',
    ...quoteObject,
  });
  localStorage.setItem(CORE_KEYS.QUOTES_LOG, JSON.stringify(log));
}

export function getQuotesLog() {
  try {
    return JSON.parse(localStorage.getItem(CORE_KEYS.QUOTES_LOG) || '[]');
  } catch (_) {
    return [];
  }
}

export function clearQuotesLog() {
  // Requires confirmation — dev / admin use only
  if (typeof confirm === 'function' &&
      !confirm('Clear ALL quote history? This cannot be undone.')) {
    return false;
  }
  localStorage.removeItem(CORE_KEYS.QUOTES_LOG);
  return true;
}

// ============================================================
// 3. OUTPUT FORMATTING HELPERS
// Use these on all output pages for consistent display.
// Never duplicate these inline in module files.
// ============================================================

// Returns "$1,234.00" — two decimal places, US locale
// Returns "TBD" for null / undefined
export function formatCurrency(n) {
  if (n === null || n === undefined) return 'TBD';
  return '$' + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Returns long-form date: "April 16, 2026"
// Pass a Date object or leave empty for today
export function formatDate(date) {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleDateString('en-US', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
  });
}

// Returns a revision-suffixed estimate number.
// formatRevisionNumber('F16-26', 1) → 'F16.1-26'
// formatRevisionNumber('F16-26', 0) → 'F16-26'
export function formatRevisionNumber(baseNumber, revision) {
  if (!revision || revision <= 0) return baseNumber;
  const match = baseNumber.match(/^(.+)-(\d{2})$/);
  if (!match) return `${baseNumber}.${revision}`;
  return `${match[1]}.${revision}-${match[2]}`;
}

// Returns a normalized header object for any output page.
// businessInfo  — { name, tagline, address, city, email, phone, website }
// customerInfo  — { name, address, email, phone }
// estimateNumber — string e.g. "F28-26"
// date           — formatted date string or Date object; defaults to today
export function formatEstimateHeader(businessInfo, customerInfo, estimateNumber, date) {
  const b = businessInfo || {};
  const c = customerInfo || {};
  return {
    company: {
      name:    b.name    || '',
      tagline: b.tagline || '',
      address: b.address || '',
      city:    b.city    || '',
      email:   b.email   || '',
      phone:   b.phone   || '',
      website: b.website || '',
    },
    estimateNumber: estimateNumber || '',
    // Accept already-formatted string or convert Date object
    date: (typeof date === 'string' && date) ? date : formatDate(date),
    customer: {
      name:    c.name    || '',
      address: c.address || '',
      email:   c.email   || '',
      phone:   c.phone   || '',
    },
  };
}

// ============================================================
// 4. MODULE REGISTRY
// Each entry describes one LayoutOS estimating module.
// Add post-frame, concrete, decks etc. here — not in module files.
// ============================================================
export const MODULES = {
  shed: {
    id:         'shed',
    name:       'Shed & Barn',
    logicFile:  'shed-logic.js',
    quoteFile:  'shed-quote.html',
    outputFile: 'shed-output.html',
  },
  // postframe: { id: 'postframe', name: 'Post-Frame Building',
  //   logicFile: 'postframe-logic.js', quoteFile: 'postframe-quote.html',
  //   outputFile: 'postframe-output.html' },
  // concrete:  { id: 'concrete', name: 'Concrete & Foundation', ... },
  // deck:      { id: 'deck',     name: 'Deck & Porch', ... },
};