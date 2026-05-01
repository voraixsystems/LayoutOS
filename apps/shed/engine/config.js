// ============================================================
// shed/config.js — Shed Business Rules & Constants
// LayoutOS 2 — Fudd Service, Le Roy NY
// ============================================================
// PURPOSE: Single source of truth for shed configuration.
//   - Company info, payment thresholds, delivery radius
//   - Siding / roof / wall height constants
//   - Width premiums, gambrel rules, loft availability
//   - Door / window / vinyl / demo tier definitions
//
// SAFE TO EDIT: business rules, thresholds, labels.
// DO NOT EDIT: add-on prices (ADDON_* are null — loaded from
//   prices.json at runtime via loadPrices()).
//
// Depends on: nothing. Pure data.
// Consumed by: shed/anchor.js, shed/pricing.js, shed/materials.js,
//   shed/addons.js, shed/build-quote.js, shed-logic.js (facade).
// ============================================================

// ------------------------------------------------------------
// CONFIGS — one per line, clearly marked
// ------------------------------------------------------------
export const CONFIG = {
  // Company
  COMPANY_NAME:        'Fudd Service',
  COMPANY_DBA:         'FuddService',
  COMPANY_TAGLINE:     'Exterior Construction Services',
  COMPANY_ADDRESS:     '6 North Street',
  COMPANY_CITY:        'Le Roy NY 14482',
  COMPANY_EMAIL:       'fuddservice@gmail.com',
  COMPANY_PHONE:       '585-297-0777',
  COMPANY_WEBSITE:     'www.fuddservice.com',

  // Delivery
  DELIVERY_RADIUS_MILES: 75,
  DELIVERY_NOTE: 'Delivery included within 75 miles of Le Roy NY',

  // Payment
  PAYMENT_STANDARD: '50% deposit required to schedule. Balance due upon completion.',
  PAYMENT_LARGE_THRESHOLD: 15000,       // milestone payment schedule above this
  PAYMENT_LARGE_NOTE: 'Payment schedule to be discussed for projects over $15,000.',
  // Milestone percentages for large projects — rendered in shed-output.html
  // Labels map to build status checkpoints; amounts calculated from total at render time
  PAYMENT_MILESTONES: [
    { label: 'Deposit — due at signing',       pct: 0.33 },
    { label: 'Progress — delivery / rough-in', pct: 0.34 },
    { label: 'Balance — due at completion',    pct: 0.33 },
  ],

  // Estimate numbering — keys and counter logic live in layoutos-core.js
  // Format: [PREPARER_LETTER][counter]-[2-digit-year]
  // e.g. F28-26 = Fudd Service estimate #28, year 2026
  PREPARER_LETTER: 'F',  // F = Fudd Service — change if another preparer takes over

  // Internal mode unlock code
  INTERNAL_UNLOCK: 'LAYOUT',

  // Siding
  // LP SmartSide: $50/sheet — wood shed, no wall sheathing options (wood over wood not done)
  LP_SMARTSIDE_PRICE_PER_SHEET: 50,     // $50/sheet, LP SmartSide
  LP_SQFT_PER_SHEET: 32,                // 4ft x 8ft sheet = 32 sqft

  // Roof
  // Metal panels: 3ft wide, ordered to length — NOT 4x8 sheets
  // Fir strips: 24in OC, REQUIRED under any metal roof over OSB or Zip — metal cannot screw to OSB
  // OSB: $13/sheet (volatile — verify before quoting)
  // Zip wall (green 7/16): $45/sheet | Zip roof (brown 5/8): $60/sheet
  METAL_ROOF_MULTIPLIER: 0.12,          // +12% on base price after vinyl add-on
  METAL_WASTE_FACTOR: 1.10,             // 10% waste on metal panels
  SHINGLE_SQFT_PER_SQUARE: 100,         // 1 square = 100 sqft
  METAL_PANEL_WIDTH_FT: 3,              // panels are 3ft wide
  METAL_PANEL_STANDARD_LENGTHS: [8, 10, 12, 14, 16], // order next length above slope
  VB_OVERLAP_FACTOR: 1.15,              // 15% overlap — vapor barrier coverage

  // Wall heights
  WALL_HEIGHT_STANDARD: 8,              // ft
  WALL_HEIGHT_TALL: 10,                 // ft
  WALL_10FT_UPCHARGE_PER_LF: 4.50,     // labor + stud upgrade per LF of wall perimeter for 10ft walls

  // Roof pitch (standard)
  ROOF_PITCH_RISE_OVER_RUN: 5 / 12,   // 5/12 standard pitch
  ROOF_PITCH_LABEL: '5/12',           // display string for estimates — update when pitch options are added

  // Overhang per side (ft) by style group
  OVERHANG_ECONOMY:   0.5,             // economy + carriage styles
  OVERHANG_DELUXE:    1.0,             // deluxe style
  OVERHANG_GAMBREL:   0.5,             // mini/low/maxi/double barn styles

  // Sheet math
  ZIP_TAPE_SHEETS_PER_ROLL: 8,         // 1 roll covers 8 sheets of Zip tape
  FIR_STRIP_SPACING_INCHES: 24,        // 24in OC furring strips
  SHEET_SQFT: 32,                      // 4x8 sheet = 32 sqft (LP, OSB, Zip)

  // Vapor barrier / conditioning
  VAPOR_BARRIER_SQFT_PER_ROLL: 500,
  FELT_COVERAGE_SQFT_PER_ROLL: 400,        // ~400 sqft per roll, 15lb felt
  HOUSEWRAP_COVERAGE_SQFT_PER_ROLL: 1000,  // Tyvek or equiv, ~1000 sqft per roll
  ICW_SQFT_PER_ROLL: 225,                  // Grace Ice & Water Shield 36in×75ft, HD #202088840

  // Width premiums for 18ft and 20ft sheds
  WIDTH_PREMIUMS: { 18: 1.13, 20: 1.18 },

  // Gambrel styles — 16ft+ width must use Double Decker
  GAMBREL_STYLES: ['mini', 'low', 'maxi'],
  GAMBREL_UPGRADE_WIDTH: 16,

  // Loft availability
  // Loft: manual quote only — too variable for formula
  // Attic trusses: separate quote entirely, not in calculator
  GAMBREL_ROOF_STYLES: ['mini', 'low', 'maxi', 'double'],  // loft available on all gambrel
  LOFT_PITCH_MINIMUM: 7 / 12,          // gable loft requires >= 7/12 pitch (standard is 5/12 = not available)
  LOFT_HEADROOM_MIN_WIDTH: 16,         // 16ft+ for full loft headroom; <16 = limited headroom warning

  // Shelving spec — 2ft deep, 36in AFF, framing: front + back + mid support
  SHELVING_DEPTH_FT: 2,                // shelf depth in feet
  SHELVING_FRAMING_RUNS: 3,            // front rail + back rail + one mid support
  FRAMING_2X4_COST_PER_LF: 0.59,       // per LF — 2x4 framing

  // Add-on prices — populated from prices.json by loadPrices() at app init.
  // Do not set values here; they are sourced at load time. Single source of truth.
  // Garage door prices — populated at runtime by loadPrices()
  ADDON_GARAGE_DOOR_8X7_STD:      null,  // 8×7 Clopay Non-Insulated
  ADDON_GARAGE_DOOR_8X7_R6:       null,  // 8×7 Clopay R-6.5 Insulated
  ADDON_GARAGE_DOOR_8X8_STD:      null,  // 8×8 Non-Insulated (10ft wall only)
  ADDON_GARAGE_DOOR_9X7_STD:      null,  // 9×7 Non-Insulated
  ADDON_GARAGE_DOOR_9X7_R6:       null,  // 9×7 R-6.5 Insulated
  ADDON_GARAGE_DOOR_SEAL_9FT:     null,  // 9ft door seal — white or brown, same price
  ADDON_GARAGE_DOOR_KEYED_HANDLE: null,  // exterior keyed entry handle
  ADDON_FRAMED_OPENING_8X7:       null,
  ADDON_FRAMED_OPENING_8X8:       null,
  ADDON_FRAMED_OPENING_9X7:       null,
  ADDON_FRAMED_OPENING_9X8:       null,
  ADDON_FRAMED_OPENING_10X7:      null,
  ADDON_FRAMED_OPENING_12X7:      null,
  ADDON_FRAMED_OPENING_16X7:      null,

  ADDON_MAN_DOOR:            null,       // legacy — use ADDON_MAN_DOOR_* below
  ADDON_MAN_DOOR_SOLID:      null,       // 36x80 Primed Steel JELD-WEN — HD
  ADDON_MAN_DOOR_9LITE:      null,       // 36x80 9-Lite Steel JELD-WEN — HD — SKU VERIFY
  ADDON_MAN_DOOR_FANLITE:    null,       // 36x80 Fan-Lite Steel JELD-WEN — HD — SKU VERIFY
  ADDON_WINDOW_24x27:        null,       // legacy — use ADDON_WINDOW_* below
  ADDON_WINDOW_SINGLE_HUNG:  null,       // 24x30 Single Hung — Project Source Lowes
  ADDON_WINDOW_SLIDING:      null,       // 36x36 Sliding — Project Source Lowes
  ADDON_GARAGE_DOOR_INSTALL: null,       // install labor only — verify HD material price
  ADDON_RAMP_PER_OPENING:    null,       // legacy — replaced by RAMP_PRICES_SHOP / RAMP_PRICES_GD

  // Wood Build Shop Door sell prices — siding-aware (additional set; one set included in base)
  SHOP_DOOR_PRICES_VINYL: { 32: 170, 36: 185, 64: 320, 72: 350 },
  SHOP_DOOR_PRICES_LP:    { 32: 133, 36: 148, 64: 245, 72: 275 },

  // Ramp sell prices by door width (in) and ramp length (ft) — shop doors use 2x4 PT
  RAMP_PRICES_SHOP: {
    32: { 4:  85, 6: 110 },
    36: { 4:  90, 6: 115 },
    64: { 4: 110, 6: 140 },
    72: { 4: 120, 6: 150 },
  },
  // GD ramps — 2x6 PT framing, keyed by GD width in feet
  RAMP_PRICES_GD: {
     8: { 4: 160, 6: 195 },
     9: { 4: 175, 6: 210 },
    10: { 4: 190, 6: 225 },
    12: { 4: 215, 6: 260 },
    16: { 4: 250, 6: 300 },
  },
  ADDON_PREMIUM_PLYWOOD:     null,       // 3/4in BC plywood — shelving upgrade
  ADDON_OSB_SHEET:           null,       // OSB — volatile, verify before quoting

  // Man door type specs — descriptions, SKUs, source
  // Note: 9-lite and fan-lite SKUs are placeholders — VERIFY before ordering
  MAN_DOOR_SPECS: {
    solid: {
      label: '36×80 Primed Steel — JELD-WEN',
      sku_left:  'THDJW166100275',
      sku_right: 'THDJW166100278',
      source: 'Home Depot',
      verified: true,
    },
    '9lite': {
      label: '36×80 9-Lite Steel — JELD-WEN',
      sku_left:  'THDJW166100277',  // VERIFY
      sku_right: 'THDJW166100280',  // VERIFY
      source: 'Home Depot',
      verified: false,  // SKUs need field verification
    },
    fanlite: {
      label: '36×80 Fan-Lite Steel — JELD-WEN',
      sku_left:  'THDJW166100279',  // VERIFY
      sku_right: 'THDJW166100282',  // VERIFY
      source: 'Home Depot',
      verified: false,  // SKUs need field verification
    },
  },

  // Window type specs — descriptions, SKUs, source
  WINDOW_SPECS: {
    single_hung: {
      label: '24×30 Single Hung Vinyl — Project Source',
      sku: '5013341551',
      source: "Lowe's",
      operation: null,  // fixed, no direction
    },
    sliding: {
      label: '36×36 Sliding Vinyl — Project Source',
      sku: '5013341567',
      source: "Lowe's",
      operation: ['left', 'right'],  // left or right operable
    },
  },

  // Vinyl siding add-on tiers — flat add-on amount by floor sqft
  // breakpoints: inclusive upper bound (sqft <= bp → use this price)
  // Source: ShedPriceAnchor.json pricing_adjustments
  VINYL_TIERS: {
    breakpoints: [99,   200,  300,  500,  Infinity],
    prices:      [1300, 1700, 2200, 3000, 3800],
  },

  // Demo pricing tiers — flat rate by demolished shed sqft
  // breakpoints: inclusive upper bound (sqft <= bp → use this price)
  // UPDATE 2026-04-18: rescaled — 20×20 (400 sqft) = $1,600 confirmed on live quote
  DEMO_TIERS: {
    breakpoints: [120, 240, 320, 400, 512, Infinity],
    prices:      [700, 1000, 1300, 1600, 2000, 2500],
  },

  // Concrete slab removal — per sqft, applied on top of demo if slab is present
  // UPDATE 2026-04-18: $450 for 20×20 (400 sqft) = $1.125/sqft — defaulting to $1.15
  CONCRETE_REMOVAL_RATE_PER_SQFT: 1.15,

  // Floor / slab — interim rates. Wood floor is standard (in base price).
  // TODO: replace NO_FLOOR_DEDUCT_RATE with real floor-cost calc when done.
  SLAB_DEFAULT_RATE_PER_SQFT:  13,  // concrete slab starting rate, editable per quote
  NO_FLOOR_DEDUCT_RATE_PER_SQFT: 3, // interim credit when wood floor is removed

  // Foundation / Slab — spec string and site-variability caveat for output rendering
  SLAB_SPEC_TEXT:   '4in slab · wire grid · 12in haunch',
  SLAB_CAVEAT_NOTE: 'Final slab price subject to site conditions — soil type, access, depth, and drainage may affect cost.',

  // Garage door seals — 3 per door (bottom + 2 sides), 9ft strip each
  GARAGE_DOOR_SEALS_PER_DOOR: 3,

  // Garage door specs — doors we supply and install
  GARAGE_DOOR_SPECS: {
    '8x7_std': { label: '8×7 Clopay Non-Insulated', priceKey: 'garage_door_8x7_std', wallHeightMin: 8,  openingSqft: 56 },
    '8x7_r6':  { label: '8×7 Clopay R-6.5 Insulated', priceKey: 'garage_door_8x7_r6', wallHeightMin: 8, openingSqft: 56 },
    '8x8_std': { label: '8×8 Non-Insulated',           priceKey: 'garage_door_8x8_std', wallHeightMin: 10, openingSqft: 64 },
    '9x7_std': { label: '9×7 Non-Insulated',           priceKey: 'garage_door_9x7_std', wallHeightMin: 8,  openingSqft: 63 },
    '9x7_r6':  { label: '9×7 R-6.5 Insulated',        priceKey: 'garage_door_9x7_r6',  wallHeightMin: 8,  openingSqft: 63 },
  },

  // Framed opening specs — framing only, client supplies door + installer
  // lbwNote: true = flag load-bearing wall note on estimate
  FRAMED_OPENING_SPECS: {
    '8x7':    { label: '8×7',  priceKey: 'framed_opening_8x7',  wallHeightMin: 8,  openingSqft: 56,  lbwNote: false },
    '8x8':    { label: '8×8',  priceKey: 'framed_opening_8x8',  wallHeightMin: 10, openingSqft: 64,  lbwNote: false },
    '9x7':    { label: '9×7',  priceKey: 'framed_opening_9x7',  wallHeightMin: 8,  openingSqft: 63,  lbwNote: false },
    '9x8':    { label: '9×8',  priceKey: 'framed_opening_9x8',  wallHeightMin: 10, openingSqft: 72,  lbwNote: false },
    '10x7':   { label: '10×7', priceKey: 'framed_opening_10x7', wallHeightMin: 8,  openingSqft: 70,  lbwNote: false },
    '12x7':   { label: '12×7', priceKey: 'framed_opening_12x7', wallHeightMin: 8,  openingSqft: 84,  lbwNote: true  },
    '16x7':   { label: '16×7', priceKey: 'framed_opening_16x7', wallHeightMin: 8,  openingSqft: 112, lbwNote: true  },
    'custom': { label: 'Custom', priceKey: null,                 wallHeightMin: 8,  openingSqft: 56,  lbwNote: false },
  },

  // ── Metal roofing colors ────────────────────────────────
  // gauge26: true = available in 26ga (others are 29ga standard)
  // premium: true = slight upcharge (crinkle/matte finish)
  METAL_PREMIUM_BASE_PER_LF:    2.99,  // per panel-LF upcharge — bare/matte premium colors
  METAL_PREMIUM_CRINKLE_PER_LF: 3.75, // per panel-LF upcharge — crinkle finish colors

  METAL_COLORS_STANDARD: [
    { key: 'stealth_black',   label: 'Stealth Black',   hex: '#1c1c1c', gauge26: true  },
    { key: 'zinc_gray',       label: 'Zinc Gray',       hex: '#8a9099'                 },
    { key: 'burnished_slate', label: 'Burnished Slate', hex: '#52484a', gauge26: true  },
    { key: 'coca_brown',      label: 'Coca Brown',      hex: '#5c3d2e'                 },
    { key: 'charcoal',        label: 'Charcoal',        hex: '#4a4a4a', gauge26: true  },
    { key: 'forest_green',    label: 'Forest Green',    hex: '#2d5a27', gauge26: true  },
    { key: 'burgundy',        label: 'Burgundy',        hex: '#6b1f2a'                 },
    { key: 'rustic_red',      label: 'Rustic Red',      hex: '#8b3a3a'                 },
    { key: 'bright_red',      label: 'Bright Red',      hex: '#cc2200'                 },
    { key: 'hawaiian_blue',   label: 'Hawaiian Blue',   hex: '#1a6b9a'                 },
    { key: 'ash_gray',        label: 'Ash Gray',        hex: '#9ba5a8', gauge26: true  },
    { key: 'sahara_tan',      label: 'Sahara Tan',      hex: '#c4a96b'                 },
    { key: 'clay',            label: 'Clay',            hex: '#9e8a72'                 },
    { key: 'light_stone',     label: 'Light Stone',     hex: '#d4c9a8'                 },
    { key: 'polar_white',     label: 'Polar White',     hex: '#f0eeea', gauge26: true  },
    { key: 'gallery_blue',    label: 'Gallery Blue',    hex: '#4a6fa8'                 },
  ],

  METAL_COLORS_PREMIUM: [
    { key: 'bare_galv',               label: 'Bare Galv',               hex: '#bcc4c8', premium: true, premiumTier: 'base'    },
    { key: 'matte_black',             label: 'Matte Black',             hex: '#0d0d0d', premium: true, premiumTier: 'base'    },
    { key: 'crinkle_black',           label: 'Crinkle Black',           hex: '#111111', premium: true, premiumTier: 'crinkle' },
    { key: 'crinkle_burnished_slate', label: 'Crinkle Burnished Slate', hex: '#4a4042', premium: true, premiumTier: 'crinkle' },
    { key: 'crinkle_charcoal',        label: 'Crinkle Charcoal',        hex: '#2d2d2d', premium: true, premiumTier: 'crinkle' },
  ],

  // Shingle colors — GAF Timberline HD stocked colors. Others available by order.
  // Swatches are approximate — view physical samples before spec'ing.
  SHINGLE_COLORS: [
    { key: 'hickory',         label: 'Hickory',         hex: '#5e3d1e' },
    { key: 'barkwood',        label: 'Barkwood',        hex: '#3d2a14' },
    { key: 'charcoal',        label: 'Charcoal',        hex: '#111111' },
    { key: 'fox_hollow_gray', label: 'Fox Hollow Gray', hex: '#c0bbb4' },
    { key: 'oyster_gray',     label: 'Oyster Gray',     hex: '#9d9388' },
    { key: 'pewter_gray',     label: 'Pewter Gray',     hex: '#7d8087' },
    { key: 'shakewood',       label: 'Shakewood',       hex: '#6b5040' },
    { key: 'slate',           label: 'Slate',           hex: '#5a6570' },
    { key: 'weathered_wood',  label: 'Weathered Wood',  hex: '#7a7060' },
  ],

  // ── Estimate base notes — edit freely ───────────────────
  // These print on every estimate. Wipe and rewrite as needed.
  // Dynamic notes (metal condensation, loft, garage door warnings) are
  // added automatically in build-quote.js and are NOT in this array.
  ESTIMATE_NOTES_BASE: [
    'These numbers are subject to change based on location, supplies, equipment, rentals, and the unforeseen.',
    'Delivery included within 75 miles of Le Roy NY.',
    'Roof pitch: 5/12 standard. Non-standard pitch is available by request.',
  ],

  // Footer — LayoutOS — built by Fudd
  FOOTER_TAG: 'LayoutOS — built by Fudd',

  // All prices subject to change
  DISCLAIMER: 'These numbers are subject to change based on location, supplies, equipment, rentals, and the unforeseen.',
};