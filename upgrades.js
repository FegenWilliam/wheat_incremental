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
//   wheatPerMill       base 20  — wheat one mill feeds in, per turn (the "rate").
//   flourPerMill       base 10  — rough flour one mill grinds out, per turn.
//   roughFlourPrice    base 4   — dollars each rough flour sells for.
//
// The mill's ratio is wheatPerMill : flourPerMill (base 20:10 = 2:1). To change:
//   • RATE  — multiply BOTH stats by the same factor to scale throughput while
//             keeping the ratio (×2 → 40 wheat in, 20 flour out).
//   • RATIO — add to flourPerMill alone to improve the yield (+2 → 20:12 = 10:6).
//   • PRICE — add to roughFlourPrice (+2 → sells for $6).
// (One mill = one miller; that cap is fixed in script.js, no stat for it.)
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
  roughFlourPrice: 4,
  // --- Prestige stats. Driven by PERMANENT_UPGRADES (bought with Retirement
  // Points) and applied at the start of each run — see script.js. ---
  startingMoney: 0,   // dollars in the bank at the start of every run
  bonusTurnLimit: 0,  // extra turns added onto the base 80-turn limit
  itemCapBonus: 0,    // extra stockpile room added onto the base 200 cap
};

// How each stat reads on cards / in the header. `integer: true` rounds down for
// display (you can't have half a farmer slot). `internal: true` keeps a stat out
// of the ordinary Upgrades header (used for prestige-only stats).
const STAT_INFO = {
  wheatPerFarmer:    { label: "wheat per farmer",     integer: false },
  maxFarmersPerPlot: { label: "max farmers per plot", integer: true  },
  wheatPerMill:      { label: "wheat per mill",       integer: true  },
  flourPerMill:      { label: "flour per mill",       integer: true  },
  roughFlourPrice:   { label: "rough flour price ($)", integer: true },
  startingMoney:     { label: "starting money ($)",   integer: true, internal: true },
  bonusTurnLimit:    { label: "bonus turns",          integer: true, internal: true },
  itemCapBonus:      { label: "bonus storage",        integer: true, internal: true },
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

  // --- Mill Yield — more flour from the same wheat (improves the ratio) -------
  // These add to flourPerMill only, so 20 wheat in yields more flour out:
  // base 20:10 (2:1) → 20:12 (10:6) → 20:14 (10:7) → 20:18 (≈10:9).
  {
    id: "mill_finer_grind",
    name: "Finer Grind",
    category: "Mill Yield",
    desc: "Tighter millstones waste less grain — more flour per load. Ratio 10:6.",
    cost: { money: 250 },
    effects: { flourPerMill: 2 },
  },
  {
    id: "mill_bran_recovery",
    name: "Bran Recovery",
    category: "Mill Yield",
    desc: "Sieve back the bran instead of tossing it. Ratio 10:7.",
    cost: { money: 800 },
    requires: ["mill_finer_grind"],
    effects: { flourPerMill: 2 },
  },
  {
    id: "mill_double_sift",
    name: "Double Sift",
    category: "Mill Yield",
    desc: "A second pass squeezes out every usable grain. Ratio ≈10:9.",
    cost: { money: 2200, wheat: 120 },
    requires: ["mill_bran_recovery"],
    effects: { flourPerMill: 4 },
  },

  // --- Mill Throughput — scale the RATE, keeping the ratio -------------------
  // Multipliers hit BOTH wheatPerMill and flourPerMill, so a mill chews through
  // proportionally more wheat for proportionally more flour.
  {
    id: "mill_bigger_stones",
    name: "Bigger Millstones",
    category: "Mill Throughput",
    desc: "Heavier stones handle half again as much each turn (×1.5 rate).",
    cost: { money: 500 },
    effects: { wheatPerMill: { mult: 1.5 }, flourPerMill: { mult: 1.5 } },
  },
  {
    id: "mill_water_wheel",
    name: "Water Wheel",
    category: "Mill Throughput",
    desc: "Let the river do the work — double the throughput (×2 rate).",
    cost: { money: 1600, wheat: 100 },
    requires: ["mill_bigger_stones"],
    effects: { wheatPerMill: { mult: 2 }, flourPerMill: { mult: 2 } },
  },
  {
    id: "mill_overdrive",
    name: "Grinding Overdrive",
    category: "Mill Throughput",
    desc: "Push the mill harder and harder. +25% rate each time you buy it.",
    cost: { money: 900 },
    requires: ["mill_bigger_stones"],
    repeatable: true,
    maxLevel: 6,
    costGrowth: 1.4,
    effects: { wheatPerMill: { mult: 1.25 }, flourPerMill: { mult: 1.25 } },
  },

  // --- Flour Market — raise what rough flour sells for -----------------------
  {
    id: "mill_sturdy_sacks",
    name: "Sturdy Sacks",
    category: "Flour Market",
    desc: "Cleaner, better-kept flour fetches a higher price. +$2 each.",
    cost: { money: 350 },
    effects: { roughFlourPrice: 2 },
  },
  {
    id: "mill_town_contract",
    name: "Town Contract",
    category: "Flour Market",
    desc: "A standing order from the town baker. +$2 per rough flour.",
    cost: { money: 1000 },
    requires: ["mill_sturdy_sacks"],
    effects: { roughFlourPrice: 2 },
  },
  {
    id: "mill_export_deal",
    name: "Export Deal",
    category: "Flour Market",
    desc: "Ship flour further afield for a little more each. Buy again and again.",
    cost: { money: 600 },
    requires: ["mill_town_contract"],
    repeatable: true,
    maxLevel: 10,
    costGrowth: 1.3,
    effects: { roughFlourPrice: 1 },
  },
];

// =============================================================================
// PERMANENT UPGRADES — the Retirement Shop.
// =============================================================================
// Bought with Retirement Points (RP) instead of money/wheat. Unlike the regular
// upgrades above, these PERSIST through retirement: they, your RP, and nothing
// else survive a reset. They feed the exact same stats as normal upgrades (so
// they flow through production automatically), plus the three prestige-only
// stats declared in BASE_STATS above.
//
//   cost       (required)  a number = how many RP the next level costs.
//   effects    (required)  same shape as regular upgrades.
//   repeatable / maxLevel / costGrowth  — as above; costGrowth scales the RP
//                                          cost per level (default 1.5).
// =============================================================================
const PERMANENT_UPGRADES = [
  {
    id: "perm_heirloom_seeds",
    name: "Heirloom Seeds",
    desc: "Generations of careful selection. Every farmer harvests more, forever.",
    cost: 2,
    repeatable: true,
    maxLevel: 20,
    costGrowth: 1.5,
    effects: { wheatPerFarmer: 3 },
  },
  {
    id: "perm_family_mill",
    name: "Family Milling Tradition",
    desc: "A milling dynasty. Every mill grinds out more flour per load, forever.",
    cost: 3,
    repeatable: true,
    maxLevel: 15,
    costGrowth: 1.5,
    effects: { flourPerMill: 3 },
  },
  {
    id: "perm_merchant_ties",
    name: "Merchant Ties",
    desc: "Old trade connections. Rough flour always sells for a little more.",
    cost: 3,
    repeatable: true,
    maxLevel: 15,
    costGrowth: 1.5,
    effects: { roughFlourPrice: 1 },
  },
  {
    id: "perm_big_family",
    name: "Big Family",
    desc: "More hands at home — fit another farmer on every plot from the very start.",
    cost: 8,
    repeatable: true,
    maxLevel: 4,
    costGrowth: 2,
    effects: { maxFarmersPerPlot: 1 },
  },
  {
    id: "perm_nest_egg",
    name: "Nest Egg",
    desc: "Start every new run with money already in the bank.",
    cost: 4,
    repeatable: true,
    maxLevel: 20,
    costGrowth: 1.4,
    effects: { startingMoney: 100 },
  },
  {
    id: "perm_late_career",
    name: "Late Career",
    desc: "Push retirement back — more turns each run before you must retire.",
    cost: 6,
    repeatable: true,
    maxLevel: 20,
    costGrowth: 1.5,
    effects: { bonusTurnLimit: 5 },
  },
  {
    id: "perm_deep_silos",
    name: "Deep Silos",
    desc: "Bigger permanent storage for every resource, run after run.",
    cost: 5,
    repeatable: true,
    maxLevel: 20,
    costGrowth: 1.4,
    effects: { itemCapBonus: 50 },
  },
];
