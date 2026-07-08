// Wheat Incremental — UPGRADES
// =============================================================================
// THIS FILE IS MEANT TO BE EDITED BY HAND.
//
// Adding an upgrade = adding one entry to the UPGRADES array below. For ordinary
// upgrades you never touch script.js — the game reads this list and builds the
// Upgrades tab, the costs, the prerequisites and the effects automatically. (The
// one exception is an UNLOCK upgrade that reveals a building: it also needs a
// single line in script.js — see "Requirements & unlocking buildings" below.)
//
// ---- Where to edit what -----------------------------------------------------
//   An upgrade's name / price / effect / requirement .. this file, UPGRADES.
//   Permanent (Retirement-Point) upgrades ............. this file, PERMANENT_UPGRADES.
//   A brand-new stat to boost ......................... this file, BASE_STATS + STAT_INFO.
//   A building's name / price / what it makes ......... script.js, BUILDINGS.
//   Which buildings start locked (gated progression) .. script.js, BUILDINGS `requires`.
//   The price of buying Retirement Points ............. script.js, RP_EXCHANGE.
//   Run length & when prestige unlocks ................ script.js, game.turnLimit
//                                                       and PRESTIGE_UNLOCK_TURN.
//
// ---- Upgrade fields ---------------------------------------------------------
//   id         (required)  unique string. Never reuse or rename one that's live.
//   name       (required)  shown in bold on the card.
//   cost       (required)  { money: 100 } or { wheat: 50 } or both.
//   effects    (required)  what buying it changes — see "Effects" below.
//   desc       (optional)  a sentence of flavor / explanation.
//   category   (optional)  groups cards under a heading (default "Misc").
//   requires   (optional)  ["other_id", ...] — all must be owned before unlock.
//                          (Buildings read this too — see below.)
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
// ---- Requirements & unlocking buildings (gated progression) -----------------
// `requires: ["some_id", ...]` hides an upgrade until every listed upgrade is
// owned — that's how you build a chain (buy A to reveal B to reveal C).
//
// The SAME field gates BUILDINGS, which is how a new run starts with only some
// buildings for sale and the rest earned later. A building whose `requires` is
// unmet is hidden from the Buildings shop entirely. To lock a building behind an
// upgrade, two small edits:
//   1) HERE — add a normal upgrade with an empty effect. It changes no stat; its
//      only job is to be a key the building looks for:
//          { id: "unlock_bakery", name: "Open a Bakery", category: "Expansion",
//            cost: { money: 500 }, effects: {} },
//   2) script.js — give the building a matching `requires`:
//          bakery: { name: "Bakery", cost: { money: 800 }, /* … */,
//                    requires: ["unlock_bakery"] },
// Now the Bakery only appears once "Open a Bakery" is bought. Two live examples
// already work this way — copy them as templates: `unlock_sifter` (reveals the
// Sifter) and `unlock_white_flour` (reveals the whole reservoir → tempering bin
// → flour processor chain).
//
// ---- Stats you can modify ---------------------------------------------------
//   wheatPerFarmer     base 10  — wheat each farmer makes per plot, per turn.
//   maxFarmersPerPlot  base 1   — how many farmers can work one plot at once.
//   wheatPerMill       base 20  — wheat one mill feeds in, per turn (the "rate").
//   flourPerMill       base 10  — rough flour one mill grinds out, per turn.
//   roughFlourPrice    base 4   — dollars each rough flour sells for.
//   roughFlourPerSifter base 10 — rough flour one sifter feeds in, per turn.
//   wheatFlourPerSifter base 7  — wheat flour one sifter sifts out, per turn.
//   wheatFlourPrice    base 12  — dollars each wheat flour sells for.
//
// The mill's ratio is wheatPerMill : flourPerMill (base 20:10 = 2:1). To change:
//   • RATE  — multiply BOTH stats by the same factor to scale throughput while
//             keeping the ratio (×2 → 40 wheat in, 20 flour out).
//   • RATIO — add to flourPerMill alone to improve the yield (+2 → 20:12 = 10:6).
//   • PRICE — add to roughFlourPrice (+2 → sells for $6).
// (One mill = one miller; that cap is fixed in script.js, no stat for it.)
//
// The sifter works exactly the same way — ratio roughFlourPerSifter :
// wheatFlourPerSifter (base 10:7). To change:
//   • MAX CAPACITY — multiply BOTH sifter stats to scale how much it processes
//                    while keeping the ratio (×2 → 20 rough in, 14 wheat out).
//   • RATIO — add to wheatFlourPerSifter alone to improve the yield (+1 → 10:8).
//   • PRICE — add to wheatFlourPrice (+2 → sells for $14).
// (One sifter = one sifter worker; that cap is fixed in script.js.)
//
// Water & the white-flour chain (reservoir → tempering bin → flour processor):
//   • RESERVOIR — a plot-class building worked by pipes. `waterPerPipe` is each
//     pipe's output, `maxPipesPerReservoir` how many pipes fit, and
//     `maxWaterPerReservoir` caps total water/turn no matter how many pipes push.
//     `pipeCostGrowth` scales the pipe buy-price; multiply it DOWN toward 1 to
//     soften the cost curve (a "price scaling reduction").
//   • TEMPERING BIN — CAPACITY: ×all three bin stats together to scale throughput;
//     RATIO: add to temperedWheatPerTemperingBin alone for more yield per load.
//     `binsPerTemperer` is how many bins one temperer covers (raise it = more bins
//     per hire — the reverse of a plot).
//   • FLOUR PROCESSOR — CAPACITY: ×both processor stats; RATIO: add to
//     whiteFlourPerProcessor alone; PRICE: add to whiteFlourPrice. One processor =
//     one processor worker.
//
// Want a brand-new stat? Add it to BASE_STATS and STAT_INFO just below, then any
// upgrade can target it. (Making it actually *do* something in production lives
// in script.js's instanceRates — but the stats above are already wired.)
// =============================================================================

// Base value of every derived stat, before any upgrades are bought.
const BASE_STATS = {
  wheatPerFarmer: 10,
  maxFarmersPerPlot: 1,
  wheatPrice: 1,            // dollars each wheat sells for.
  wheatPerMill: 20,
  flourPerMill: 10,
  roughFlourPrice: 4,
  roughFlourPerSifter: 10,  // rough flour one sifter feeds in, per turn (the "rate"/capacity).
  wheatFlourPerSifter: 7,   // wheat flour one sifter sifts out, per turn.
  wheatFlourPrice: 12,      // dollars each wheat flour sells for.
  // --- Water: reservoirs (max water/turn) + pipes (the movers) ----------------
  waterPerPipe: 5,          // water one pipe moves per turn (per-pipe rate).
  maxPipesPerReservoir: 1,  // how many pipes fit on one reservoir at once.
  maxWaterPerReservoir: 20, // hard cap on a reservoir's water output per turn.
  pipeCostGrowth: 1.15,     // ×price per pipe already owned; upgrades flatten it toward 1.
  // --- Tempering bin: wheat + water -> tempered wheat -------------------------
  wheatPerTemperingBin: 10,          // wheat one bin consumes per turn.
  waterPerTemperingBin: 5,           // water one bin consumes per turn.
  temperedWheatPerTemperingBin: 8,   // tempered wheat one bin makes per turn.
  binsPerTemperer: 4,                // tempering bins a single temperer can cover.
  // --- Flour processor: tempered wheat -> white flour ------------------------
  temperedWheatPerProcessor: 10,     // tempered wheat one processor consumes per turn.
  whiteFlourPerProcessor: 8,         // white flour one processor makes per turn.
  whiteFlourPrice: 20,               // dollars each white flour sells for.
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
  wheatPrice:        { label: "wheat price ($)",       integer: true },
  wheatPerMill:      { label: "wheat per mill",       integer: true  },
  flourPerMill:      { label: "flour per mill",       integer: true  },
  roughFlourPrice:   { label: "rough flour price ($)", integer: true },
  roughFlourPerSifter: { label: "rough flour per sifter", integer: true },
  wheatFlourPerSifter: { label: "wheat flour per sifter", integer: true },
  wheatFlourPrice:   { label: "wheat flour price ($)", integer: true },
  waterPerPipe:      { label: "water per pipe",        integer: true },
  maxPipesPerReservoir: { label: "max pipes per reservoir", integer: true },
  maxWaterPerReservoir: { label: "max water per reservoir", integer: true },
  pipeCostGrowth:    { label: "pipe cost scaling",     integer: false, internal: true },
  wheatPerTemperingBin: { label: "wheat per tempering bin", integer: true },
  waterPerTemperingBin: { label: "water per tempering bin", integer: true },
  temperedWheatPerTemperingBin: { label: "tempered wheat per bin", integer: true },
  binsPerTemperer:   { label: "bins per temperer",     integer: true },
  temperedWheatPerProcessor: { label: "tempered wheat per processor", integer: true },
  whiteFlourPerProcessor: { label: "white flour per processor", integer: true },
  whiteFlourPrice:   { label: "white flour price ($)", integer: true },
  startingMoney:     { label: "starting money ($)",   integer: true, internal: true },
  bonusTurnLimit:    { label: "bonus turns",          integer: true, internal: true },
  itemCapBonus:      { label: "bonus storage",        integer: true, internal: true },
};

// =============================================================================
// THE UPGRADES. Add as many as you like — one object per upgrade.
// =============================================================================
const UPGRADES = [
  // --- Expansion — unlock new buildings & production chains -------------------
  // These upgrades don't tune a stat; buying one reveals its building(s) in the
  // Buildings shop (each gated building lists the upgrade id in its `requires`).
  // Until then the building's Buy button stays hidden, so a fresh run starts with
  // only Plots and Mills for sale and the rest of the farm is earned as a
  // progression. They work like any other upgrade — cost money, buy once.
  {
    id: "unlock_sifter",
    name: "Sifting Line",
    category: "Expansion",
    desc: "Set up a sifting line. Unlocks the Sifter in the Buildings shop, turning rough flour into finer, pricier Wheat Flour.",
    cost: { money: 200 },
    effects: {},
  },
  {
    id: "unlock_white_flour",
    name: "White Flour Refinery",
    category: "Expansion",
    desc: "Open the whole white-flour chain. Unlocks Water Reservoirs, Tempering Bins and Flour Processors, refining wheat all the way to premium White Flour.",
    cost: { money: 1200 },
    requires: ["unlock_sifter"],
    effects: {},
  },

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

  // --- Sifter Yield — more wheat flour from the same rough flour (the ratio) --
  // These add to wheatFlourPerSifter only, so 10 rough flour in yields more wheat
  // flour out: base 10:7 → 10:8 → 10:9 → 10:11.
  {
    id: "sift_fine_mesh",
    name: "Fine Mesh",
    category: "Sifter Yield",
    desc: "A finer screen keeps more of the good flour. Ratio 10:8.",
    cost: { money: 350 },
    effects: { wheatFlourPerSifter: 1 },
  },
  {
    id: "sift_tapered_screen",
    name: "Tapered Screen",
    category: "Sifter Yield",
    desc: "Angled mesh shakes every last grain through. Ratio 10:9.",
    cost: { money: 1000 },
    requires: ["sift_fine_mesh"],
    effects: { wheatFlourPerSifter: 1 },
  },
  {
    id: "sift_double_pass",
    name: "Double Pass",
    category: "Sifter Yield",
    desc: "Run the flour through twice to recover the fines. Ratio 10:11.",
    cost: { money: 2600, roughFlour: 100 },
    requires: ["sift_tapered_screen"],
    effects: { wheatFlourPerSifter: 2 },
  },

  // --- Sifter Capacity — scale how much a sifter processes (keeps the ratio) --
  // Multipliers hit BOTH roughFlourPerSifter and wheatFlourPerSifter, so a sifter
  // handles proportionally more rough flour for proportionally more wheat flour.
  {
    id: "sift_bigger_frame",
    name: "Bigger Frame",
    category: "Sifter Capacity",
    desc: "A larger sifting frame handles half again as much each turn (×1.5).",
    cost: { money: 600 },
    effects: { roughFlourPerSifter: { mult: 1.5 }, wheatFlourPerSifter: { mult: 1.5 } },
  },
  {
    id: "sift_powered_shaker",
    name: "Powered Shaker",
    category: "Sifter Capacity",
    desc: "A driven shaker doubles how much a sifter can process (×2 capacity).",
    cost: { money: 1800, roughFlour: 80 },
    requires: ["sift_bigger_frame"],
    effects: { roughFlourPerSifter: { mult: 2 }, wheatFlourPerSifter: { mult: 2 } },
  },
  {
    id: "sift_overclock",
    name: "Shaker Overclock",
    category: "Sifter Capacity",
    desc: "Push the shaker harder and harder. +25% capacity each time you buy it.",
    cost: { money: 1000 },
    requires: ["sift_bigger_frame"],
    repeatable: true,
    maxLevel: 6,
    costGrowth: 1.4,
    effects: { roughFlourPerSifter: { mult: 1.25 }, wheatFlourPerSifter: { mult: 1.25 } },
  },

  // --- Wheat Flour Market — raise what wheat flour sells for ------------------
  {
    id: "sift_paper_sacks",
    name: "Paper Sacks",
    category: "Wheat Flour Market",
    desc: "Clean paper sacks keep the flour pristine — worth more. +$3 each.",
    cost: { money: 500 },
    effects: { wheatFlourPrice: 3 },
  },
  {
    id: "sift_bakery_deal",
    name: "Bakery Deal",
    category: "Wheat Flour Market",
    desc: "A standing order from the village bakery. +$3 per wheat flour.",
    cost: { money: 1400 },
    requires: ["sift_paper_sacks"],
    effects: { wheatFlourPrice: 3 },
  },
  {
    id: "sift_city_market",
    name: "City Market",
    category: "Wheat Flour Market",
    desc: "Sell fine flour into the city market for a little more each. Buy again and again.",
    cost: { money: 900 },
    requires: ["sift_bakery_deal"],
    repeatable: true,
    maxLevel: 10,
    costGrowth: 1.3,
    effects: { wheatFlourPrice: 1 },
  },

  // --- Water Reservoirs — bigger output cap and room for more pipes ----------
  // MAX PRODUCTION raises the reservoir's water/turn ceiling; MAX PIPES lets more
  // pipes work one reservoir (it's a plot-class building).
  {
    id: "res_wider_mains",
    name: "Wider Mains",
    category: "Water Reservoirs",
    desc: "Fatter feed pipes let a reservoir push more water each turn. +15 max water/turn.",
    cost: { money: 400 },
    effects: { maxWaterPerReservoir: 15 },
  },
  {
    id: "res_pumping_station",
    name: "Pumping Station",
    category: "Water Reservoirs",
    desc: "A powered station keeps the water moving. +30 max water/turn.",
    cost: { money: 1200 },
    requires: ["res_wider_mains"],
    effects: { maxWaterPerReservoir: 30 },
  },
  {
    id: "res_extra_ports",
    name: "Extra Ports",
    category: "Water Reservoirs",
    desc: "Cut another port so one more pipe can work each reservoir.",
    cost: { money: 700 },
    effects: { maxPipesPerReservoir: 1 },
  },
  {
    id: "res_manifold",
    name: "Manifold",
    category: "Water Reservoirs",
    desc: "A branching manifold fits two more pipes on every reservoir.",
    cost: { money: 2400, water: 60 },
    requires: ["res_extra_ports"],
    effects: { maxPipesPerReservoir: 2 },
  },

  // --- Pipes — more water per pipe, and cheaper pipe scaling ------------------
  {
    id: "pipe_wider_bore",
    name: "Wider Bore",
    category: "Pipes",
    desc: "A wider bore carries more water per pipe, every turn. +3 water per pipe.",
    cost: { money: 500 },
    effects: { waterPerPipe: 3 },
  },
  {
    id: "pipe_pressurized",
    name: "Pressurized Flow",
    category: "Pipes",
    desc: "Pressurize the line to push half again as much water (×1.5 per pipe).",
    cost: { money: 1500, water: 50 },
    requires: ["pipe_wider_bore"],
    effects: { waterPerPipe: { mult: 1.5 } },
  },
  {
    id: "pipe_standard_fittings",
    name: "Standard Fittings",
    category: "Pipes",
    desc: "Standardized fittings make each new pipe cheaper than the last. Softens pipe price scaling. Buy again and again.",
    cost: { money: 600 },
    repeatable: true,
    maxLevel: 8,
    costGrowth: 1.3,
    effects: { pipeCostGrowth: { mult: 0.95 } },
  },

  // --- Tempering — bin throughput/yield, plus bins per temperer --------------
  {
    id: "temper_bigger_bin",
    name: "Bigger Bin",
    category: "Tempering",
    desc: "A larger bin tempers half again as much each turn (×1.5 capacity).",
    cost: { money: 700 },
    effects: {
      wheatPerTemperingBin: { mult: 1.5 },
      waterPerTemperingBin: { mult: 1.5 },
      temperedWheatPerTemperingBin: { mult: 1.5 },
    },
  },
  {
    id: "temper_even_soak",
    name: "Even Soak",
    category: "Tempering",
    desc: "Evenly dampened grain wastes less — more tempered wheat per load. +2 yield.",
    cost: { money: 900 },
    effects: { temperedWheatPerTemperingBin: 2 },
  },
  {
    id: "temper_rest_time",
    name: "Longer Rest",
    category: "Tempering",
    desc: "Give the grain longer to rest for a fuller temper. +2 yield.",
    cost: { money: 2000, water: 60 },
    requires: ["temper_even_soak"],
    effects: { temperedWheatPerTemperingBin: 2 },
  },
  {
    id: "temper_multi_tending",
    name: "Multi-Tending",
    category: "Tempering",
    desc: "Trained temperers keep an eye on more bins at once. +2 bins per temperer.",
    cost: { money: 1500 },
    effects: { binsPerTemperer: 2 },
  },
  {
    id: "temper_clipboard_system",
    name: "Clipboard System",
    category: "Tempering",
    desc: "A tracking system lets each temperer cover even more bins. +3 bins per temperer.",
    cost: { money: 3500 },
    requires: ["temper_multi_tending"],
    effects: { binsPerTemperer: 3 },
  },

  // --- Flour Processor — capacity, yield, and white-flour price --------------
  {
    id: "proc_bigger_rollers",
    name: "Bigger Rollers",
    category: "Flour Processor",
    desc: "Wider rollers process half again as much tempered wheat (×1.5 capacity).",
    cost: { money: 900 },
    effects: {
      temperedWheatPerProcessor: { mult: 1.5 },
      whiteFlourPerProcessor: { mult: 1.5 },
    },
  },
  {
    id: "proc_precision_rollers",
    name: "Precision Rollers",
    category: "Flour Processor",
    desc: "Finely set rollers recover more white flour per load. +2 yield.",
    cost: { money: 1300 },
    effects: { whiteFlourPerProcessor: 2 },
  },
  {
    id: "proc_air_classifier",
    name: "Air Classifier",
    category: "Flour Processor",
    desc: "An air classifier separates the finest flour, boosting yield further. +3 yield.",
    cost: { money: 3200, temperedWheat: 80 },
    requires: ["proc_precision_rollers"],
    effects: { whiteFlourPerProcessor: 3 },
  },
  {
    id: "proc_premium_label",
    name: "Premium Label",
    category: "Flour Processor",
    desc: "Brand your white flour as premium goods. +$4 per white flour.",
    cost: { money: 1500 },
    effects: { whiteFlourPrice: 4 },
  },
  {
    id: "proc_patisserie_deal",
    name: "Patisserie Deal",
    category: "Flour Processor",
    desc: "Supply the city patisseries with fine flour. Buy again and again. +$2 each.",
    cost: { money: 1800 },
    requires: ["proc_premium_label"],
    repeatable: true,
    maxLevel: 10,
    costGrowth: 1.3,
    effects: { whiteFlourPrice: 2 },
  },

  // --- Storage — raise the stockpile cap for EVERY item (flat +storage) -------
  // These add a flat amount to itemCapBonus, so the shared per-item cap goes up
  // for wheat, rough flour and any future item alike. (Reset on retirement; the
  // permanent Deep Silos upgrade in the Retirement Shop stacks on top.)
  {
    id: "store_granary",
    name: "Granary",
    category: "Storage",
    desc: "A proper granary. +100 storage for every resource.",
    cost: { money: 200 },
    effects: { itemCapBonus: 100 },
  },
  {
    id: "store_warehouse",
    name: "Warehouse",
    category: "Storage",
    desc: "A dedicated warehouse. +200 storage for every resource.",
    cost: { money: 800 },
    requires: ["store_granary"],
    effects: { itemCapBonus: 200 },
  },
  {
    id: "store_grain_elevator",
    name: "Grain Elevator",
    category: "Storage",
    desc: "Tower storage on a whole new scale. +500 storage for every resource.",
    cost: { money: 2500, wheat: 150 },
    requires: ["store_warehouse"],
    effects: { itemCapBonus: 500 },
  },
  {
    id: "store_extra_bins",
    name: "Extra Bins",
    category: "Storage",
    desc: "Bolt on more storage bins whenever you like. +150 storage each. Buy again and again.",
    cost: { money: 500 },
    requires: ["store_granary"],
    repeatable: true,
    maxLevel: 20,
    costGrowth: 1.25,
    effects: { itemCapBonus: 150 },
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
    id: "perm_family_sifter",
    name: "Family Sifting Tradition",
    desc: "A sifting dynasty. Every sifter recovers more wheat flour per load, forever.",
    cost: 3,
    repeatable: true,
    maxLevel: 15,
    costGrowth: 1.5,
    effects: { wheatFlourPerSifter: 2 },
  },
  {
    id: "perm_baker_ties",
    name: "Baker Ties",
    desc: "Old bakery connections. Wheat flour always sells for a little more.",
    cost: 4,
    repeatable: true,
    maxLevel: 15,
    costGrowth: 1.5,
    effects: { wheatFlourPrice: 2 },
  },
  {
    id: "perm_deep_wells",
    name: "Deep Wells",
    desc: "Tap deeper water tables. Every pipe carries more water from the very start.",
    cost: 3,
    repeatable: true,
    maxLevel: 15,
    costGrowth: 1.5,
    effects: { waterPerPipe: 1 },
  },
  {
    id: "perm_patissier_dynasty",
    name: "Patissier Dynasty",
    desc: "A family name the finest bakeries trust. White flour always sells for more.",
    cost: 5,
    repeatable: true,
    maxLevel: 15,
    costGrowth: 1.5,
    effects: { whiteFlourPrice: 2 },
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
