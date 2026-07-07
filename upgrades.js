// Wheat Incremental — UPGRADES
// =============================================================================
// THIS FILE IS MEANT TO BE EDITED BY HAND.
//
// Adding an upgrade = adding one entry to the UPGRADES array below. You never
// need to touch script.js — the game reads this list and builds the Upgrades
// tab, the costs, the prerequisites and the effects automatically.
//
// ---- Upgrade fields ---------------------------------------------------------
//   id         (required)  unique string. Never reuse or rename one that's live.
//   name       (required)  shown in bold on the card.
//   cost       (required)  { money: 100 } or { wheat: 50 } or both.
//   effects    (required)  what buying it changes — see "Effects" below.
//   desc       (optional)  a sentence of flavor / explanation.
//   category   (optional)  groups cards under a heading (default "Misc").
//   requires   (optional)  ["other_id", ...] — all must be owned before unlock.
//   repeatable (optional)  true = can be bought many times; the effect stacks.
//   maxLevel   (optional)  cap for a repeatable upgrade (default: unlimited).
//   costGrowth (optional)  repeatable cost ×multiplier per level (default 1.15).
//
// ---- Effects ----------------------------------------------------------------
// `effects` maps a STAT to how buying it changes that stat. A plain number ADDS:
//     effects: { wheatPerFarmer: 2 }               // +2
// Use { mult: n } to multiply, or { add: n } to be explicit:
//     effects: { wheatPerFarmer: { mult: 1.5 } }   // ×1.5
//     effects: { maxFarmersPerPlot: { add: 1 } }   // +1
// One upgrade may touch several stats at once:
//     effects: { wheatPerFarmer: 5, maxFarmersPerPlot: 1 }
//
// Across ALL owned upgrades, additive bonuses are summed onto the base first,
// then every multiplier is applied — so the order you buy things never matters:
//     final = (base + Σadd) × Πmult
//
// ---- Stats you can modify ---------------------------------------------------
//   wheatPerFarmer     base 10  — wheat each farmer makes per plot, per turn.
//   maxFarmersPerPlot  base 1   — how many farmers can work one plot at once.
//   wheatPerMill       base 20  — wheat one miller feeds into a mill, per turn.
//   flourPerMill       base 10  — rough flour one miller mills, per turn.
//   maxMillersPerMill  base 1   — how many millers can work one mill at once.
//
// The mill's 2:1 ratio is just wheatPerMill / flourPerMill, and its throughput
// is those two numbers — so upgrades can retune the rate OR the ratio by nudging
// either stat. (Rough flour's sell price lives in SELL_PRICES in script.js.)
//
// Want a brand-new stat? Add it to BASE_STATS and STAT_INFO just below, then any
// upgrade can target it. (Making it actually *do* something in production lives
// in script.js's instanceRates — but the stats above are already wired.)
// =============================================================================

// Base value of every derived stat, before any upgrades are bought.
const BASE_STATS = {
  wheatPerFarmer: 10,
  maxFarmersPerPlot: 1,
  wheatPerMill: 20,
  flourPerMill: 10,
  maxMillersPerMill: 1,
};

// How each stat reads on cards / in the header. `integer: true` rounds down for
// display (you can't have half a farmer slot).
const STAT_INFO = {
  wheatPerFarmer:    { label: "wheat per farmer",     integer: false },
  maxFarmersPerPlot: { label: "max farmers per plot", integer: true  },
  wheatPerMill:      { label: "wheat per mill",       integer: false },
  flourPerMill:      { label: "flour per mill",       integer: false },
  maxMillersPerMill: { label: "max millers per mill", integer: true  },
};

// =============================================================================
// THE UPGRADES. Add as many as you like — one object per upgrade.
// =============================================================================
const UPGRADES = [
  // --- Plot Efficiency — more wheat out of every farmer ----------------------
  {
    id: "eff_sharper_scythes",
    name: "Sharper Scythes",
    category: "Plot Efficiency",
    desc: "Well-honed blades. Every farmer harvests a little more each turn.",
    cost: { money: 100 },
    effects: { wheatPerFarmer: 2 },
  },
  {
    id: "eff_crop_rotation",
    name: "Crop Rotation",
    category: "Plot Efficiency",
    desc: "Rested soil yields fuller heads of wheat.",
    cost: { money: 300 },
    requires: ["eff_sharper_scythes"],
    effects: { wheatPerFarmer: 3 },
  },
  {
    id: "eff_fertilizer",
    name: "Fertilizer",
    category: "Plot Efficiency",
    desc: "A richer field. Each farmer brings in noticeably more.",
    cost: { money: 700 },
    requires: ["eff_crop_rotation"],
    effects: { wheatPerFarmer: 5 },
  },
  {
    id: "eff_irrigation",
    name: "Irrigation",
    category: "Plot Efficiency",
    desc: "Steady water multiplies every farmer's whole output.",
    cost: { money: 2000, wheat: 100 },
    requires: ["eff_fertilizer"],
    effects: { wheatPerFarmer: { mult: 1.5 } },
  },
  {
    // A repeatable upgrade: buy it over and over, cost climbs, effect stacks.
    id: "eff_daily_practice",
    name: "Daily Practice",
    category: "Plot Efficiency",
    desc: "Farmers get a little better every day. Buy again and again.",
    cost: { money: 150 },
    repeatable: true,
    maxLevel: 10,
    costGrowth: 1.3,
    effects: { wheatPerFarmer: 1 },
  },

  // --- Coordination — more farmers on a single plot --------------------------
  {
    id: "coord_teamwork",
    name: "Teamwork",
    category: "Coordination",
    desc: "Two hands are better than one. Fit a second farmer on each plot.",
    cost: { money: 250 },
    effects: { maxFarmersPerPlot: 1 },
  },
  {
    id: "coord_shift_work",
    name: "Shift Work",
    category: "Coordination",
    desc: "Overlapping shifts squeeze another farmer onto every plot.",
    cost: { money: 900 },
    requires: ["coord_teamwork"],
    effects: { maxFarmersPerPlot: 1 },
  },
  {
    id: "coord_foreman",
    name: "Foreman",
    category: "Coordination",
    desc: "A foreman keeps a bigger crew organised — two more farmers per plot.",
    cost: { money: 3000, wheat: 150 },
    requires: ["coord_shift_work"],
    effects: { maxFarmersPerPlot: 2 },
  },
];
