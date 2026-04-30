// ============================================================
// shed/steps.js — Step Visibility Registry
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================
// Flip a step from 'internal' → 'live' when it's ready for clients.
// 'hidden' removes it entirely (even in internal mode).

export const TOTAL_STEPS = 11;

export const STEP_VISIBILITY = {
  1:  'live',      // Style
  2:  'live',      // Size
  3:  'live',      // Wall Height
  4:  'live',      // Roofing
  5:  'live',      // Siding
  6:  'internal',  // Foundation / Slab  ← internal-only until pricing finalised
  7:  'live',      // Windows & Doors
  8:  'live',      // Add-Ons
  9:  'live',      // Demo Existing Shed
  10: 'live',      // Customer Information
  11: 'live',      // Quote Summary
};

export function isStepVisible(stepNum, isInternalMode) {
  const v = STEP_VISIBILITY[stepNum];
  if (v === 'hidden')   return false;
  if (v === 'internal') return !!isInternalMode;
  return true; // 'live'
}

export function getStepStatus(stepNum) {
  return STEP_VISIBILITY[stepNum] || 'live';
}

// Returns the next step number in direction (+1 forward, -1 back) that is
// visible to the current user.  Falls back to current if nothing found.
export function nextVisibleStep(current, direction, isInternalMode) {
  let n = current + direction;
  const limit = direction > 0 ? TOTAL_STEPS + 1 : 0;
  while (n !== limit) {
    if (isStepVisible(n, isInternalMode)) return n;
    n += direction;
  }
  return current; // nowhere to go
}
