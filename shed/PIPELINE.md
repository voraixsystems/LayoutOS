# LayoutOS 2 — Pipeline & Architecture

FuddService · Le Roy NY · Exterior Construction Services

This doc explains the modular architecture of LayoutOS 2, where to make changes, and how to add new calculators (deck, pergola, pole barn, etc.) without re-learning the codebase every time.

---

## The Three Layers

```
┌──────────────────────────────────────────────────────────────┐
│                    UI LAYER                                   │
│  shed-quote.html  →  shed-output.html  →  shed-estimates.html │
│  (form inputs)       (priced quote)        (log/history)      │
└──────────────────────────┬───────────────────────────────────┘
                           │ imports from
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                 BUSINESS LOGIC LAYER                          │
│                                                               │
│  shed-logic.js  (thin facade — 108 lines, import/re-export)  │
│       │                                                       │
│       └──▶ shed/build-quote.js  ◀── ORCHESTRATOR             │
│                  │                                            │
│                  ├──▶ shed/pricing.js   (base $ + validation)│
│                  ├──▶ shed/materials.js (sheet counts)       │
│                  ├──▶ shed/addons.js    (vinyl, cond, etc.)  │
│                  │                                            │
│                  └─── reads ────┐                             │
│                                 ▼                             │
│                   ┌───────────────────────┐                   │
│                   │  DATA MODULES          │                   │
│                   │  shed/config.js   (rules)              │   │
│                   │  shed/anchor.js   (base prices)        │   │
│                   │  shed/prices.js   (part prices)        │   │
│                   └───────────────────────┘                   │
└──────────────────────────┬───────────────────────────────────┘
                           │ imports from
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     CORE LAYER                                │
│  layoutos-core.js  —  estimate numbering, logging, formatters│
│  prices.json       —  part prices (JSON data)                │
└──────────────────────────────────────────────────────────────┘
```

---

## File Map

| File | Lines | Role | Depends on |
|---|---|---|---|
| `layoutos-core.js` | 187 | Universal core — estimate #s, logging, formatters | (none) |
| `prices.json` | 86 | Part prices (single source of truth for raw materials) | (data) |
| `shed-logic.js` | **108** | Thin facade — import/re-export. UI imports from here. | all shed/* |
| `shed/config.js` | 185 | Shed business rules, thresholds, tiers, door/window specs | (none) |
| `shed/anchor.js` | 128 | 7-style base price grid ("WxL":price) | (none) |
| `shed/prices.js` | 103 | Part prices loader + inline fallback table | config.js |
| `shed/pricing.js` | 147 | `getBasePrice`, `validateSize`, style-list helpers | config, anchor |
| `shed/materials.js` | 367 | `calculateMaterials`, `calculateFraming`, `calculateMetalPanels` | config, anchor, prices |
| `shed/addons.js` | 389 | Vinyl, demo, conditioning, sheathing, shelving, loft | config, prices |
| `shed/build-quote.js` | 464 | `buildQuote` orchestrator + auto-notes + payment terms | config, anchor, prices, pricing, materials, addons, core |

---

## Decision Tree — Where to Edit

Use this when you know WHAT you want to change but not WHERE to change it.

### "I want to change a price"

| What kind of price? | Edit this |
|---|---|
| A raw part (lumber, sheet, fastener, door, window) | **`prices.json`** (keep `shed/prices.js` fallback in sync) |
| A base shed price (e.g. 12×24 Deluxe) | **`shed/anchor.js`** |
| A vinyl siding tier ($1300, $1700, $2200...) | **`shed/config.js`** → `VINYL_TIERS` |
| A demo tier | **`shed/config.js`** → `DEMO_TIERS` |
| Width premium (18ft, 20ft) | **`shed/config.js`** → `WIDTH_PREMIUMS` |
| Metal roof multiplier | **`shed/config.js`** → `METAL_ROOF_MULTIPLIER` |

### "I want to change a rule"

| Rule | Edit this |
|---|---|
| Gambrel escalation (16ft+ → double decker) | `shed/config.js` → `GAMBREL_UPGRADE_WIDTH`, `GAMBREL_STYLES` |
| Loft availability rules | `shed/config.js` → `LOFT_*` constants |
| Wall heights offered | `shed/config.js` → `WALL_HEIGHT_*` |
| Valid widths/lengths per style | `shed/anchor.js` → `widthRange`, `lengthRange` |
| Payment threshold (3-tier) | `shed/config.js` → `PAYMENT_LARGE_THRESHOLD` |
| Company info (address, phone, email) | `shed/config.js` → `COMPANY_*` |

### "I want to change a calculation"

| Calculation | Edit this |
|---|---|
| How base price interpolates between sizes | `shed/pricing.js` → `interpolateSqft`, `getBasePrice` |
| How siding sheets are counted | `shed/materials.js` → `calculateMaterials` |
| Framing takeoff (studs, rafters, joists) | `shed/materials.js` → `calculateFraming` |
| Metal panel counting | `shed/materials.js` → `calculateMetalPanels` |
| Vapor barrier / conditioning level math | `shed/addons.js` → `calcConditioningCosts` |
| Roof sheathing upgrades (OSB / Zip) | `shed/addons.js` → `calculateRoofSheathing` |
| Wall sheathing upgrades | `shed/addons.js` → `calculateWallSheathing` |
| Shelving formula | `shed/addons.js` → `calculateShelving` |
| How quote total is assembled | `shed/build-quote.js` → `buildQuote` |
| Auto-generated customer notes | `shed/build-quote.js` → `generateAutoNotes` |

### "I want to change how a quote is presented"

Edit the HTML files — `shed-quote.html`, `shed-output.html`, `shed-estimates.html`. Never put pricing/business logic in HTML.

---

## Modification Pipeline (Process)

Use this order every time you make a change, to minimize bugs and context usage:

1. **Identify the concern.** Is it data, a rule, a calculation, or presentation?
2. **Look up the file** in the Decision Tree above.
3. **Open ONLY that file** in Claude Code or your editor. You should never need more than one module open at a time.
4. **Make the change.** If you need to see test expectations, they're in the function header comments (e.g. "12x24 Deluxe, 8ft wall → lpSheets=19").
5. **If the change adds or removes an exported function**, update `shed-logic.js` (the facade) so the UI still sees it.
6. **If the change touches `prices.json`**, also update `PRICES_FALLBACK` in `shed/prices.js` so offline/file:// use still works.
7. **Test** against the case in the function header. Open one of the HTML files in a browser and spot-check a quote.

---

## Adding a New Calculator (deck, pergola, pole-barn, ...)

The shed pattern is the template. To add a `deck/` calculator:

```
layoutos-root/
├── layoutos-core.js          ← shared, no changes needed
├── prices.json               ← add deck-specific part prices here
│
├── shed-logic.js             ← untouched
├── shed/                     ← untouched
│
├── deck-logic.js             ← NEW thin facade (copy shed-logic.js pattern)
├── deck/                     ← NEW folder
│   ├── config.js             ← deck business rules
│   ├── anchor.js             ← deck base prices (if applicable)
│   ├── pricing.js            ← deck getBasePrice, validateSize
│   ├── materials.js          ← deck sheet/board counts
│   ├── addons.js             ← deck-specific add-ons (railings, stairs, etc.)
│   └── build-quote.js        ← deck orchestrator
│
├── deck-quote.html           ← NEW UI (imports from deck-logic.js)
├── deck-output.html
└── deck-estimates.html
```

**Rules for adding a new calculator:**

1. Each calculator gets its own `{name}/` folder and `{name}-logic.js` facade.
2. Raw part prices ALWAYS go in `prices.json` — one source of truth across calculators.
3. The calculator's own pricing adjustments, tiers, rules — those live in `{name}/config.js`.
4. All calculators share `layoutos-core.js` for estimate numbering, logging, formatters.
5. Never let a calculator import from another calculator's folder. Shared logic graduates to `layoutos-core.js`.

---

## LayoutOS 2 Refactor — History

**Before (LayoutOS 1):**
- `shed-logic.js`: 1,617 lines (monolith)
- Any change required opening the whole file, burning context.

**After (LayoutOS 2):**
- `shed-logic.js`: 108 lines (facade)
- 7 focused modules in `shed/`, largest is 464 lines
- Average module: ~270 lines
- Context cost per change: ~5× lower

Extraction order (safest → most coupled):
1. `shed/config.js` (pure constants)
2. `shed/anchor.js` (pure data)
3. `shed/prices.js` (state + loader)
4. `shed/pricing.js` (logic, depends on config + anchor)
5. `shed/materials.js` (logic, depends on config + anchor + prices)
6. `shed/addons.js` (logic, depends on config + prices)
7. `shed/build-quote.js` (orchestrator, depends on everything)

All 20 original named exports preserved through the facade. UI files (`shed-quote.html`, `shed-output.html`, `shed-estimates.html`) required zero changes.
