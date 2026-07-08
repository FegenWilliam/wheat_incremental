// Wheat Incremental — core gameplay
// Data-driven and instance-based: every building the player owns is a separate
// object that workers (and the player) are assigned to individually. This is the
// foundation for many building types and multiple workers per building.

// --- Static definitions -----------------------------------------------------

// Stockpiled resources. Every item shares one cap (game.itemCap). Money is a
// separate currency (uncapped), handled below — it is not an item.
const ITEMS = {
  wheat: { name: "Wheat" },
  water: { name: "Water" },              // crafting material — cannot be sold
  roughFlour: { name: "Rough Flour" },
  wheatFlour: { name: "Wheat Flour" },
  temperedWheat: { name: "Tempered Wheat" }, // crafting material — cannot be sold
  whiteFlour: { name: "White Flour" },
};

// What each item sells for, in dollars. This is the base/fallback price; an
// item listed in PRICE_STATS instead takes its price from that (upgradeable)
// stat, so market upgrades can raise it.
const SELL_PRICES = {
  wheat: 1,
};

// Items whose sell price is a derived stat (see BASE_STATS in upgrades.js).
const PRICE_STATS = {
  roughFlour: "roughFlourPrice",
  wheatFlour: "wheatFlourPrice",
  whiteFlour: "whiteFlourPrice",
};

// An item is sellable only if it has a flat sell price or a price stat. Anything
// else (water, tempered wheat) is a crafting material: it stockpiles and feeds
// machines, but there's no market for it — the Inventory tab hides its sell row.
const isSellable = (item) => item in SELL_PRICES || item in PRICE_STATS;

// Current sell price of an item: the upgrade-driven stat if it has one, else
// its flat SELL_PRICES entry.
function sellPrice(item) {
  const stat = PRICE_STATS[item];
  if (stat) return Math.max(0, Math.round(deriveStats()[stat] ?? 0));
  return SELL_PRICES[item] || 0;
}

// Building TYPES. Each owned building is an instance of one of these.
//   worker       — the worker type this building needs to run (one type each).
//   produces     — output per turn, per working worker.
//   consumes     — input per turn, per working worker (processors only).
//   capacityStat — stat that caps how many workers can work one instance.
//   rateStats    — per-resource: which stat drives that resource's per-worker
//                  rate (so upgrades retune throughput). Falls back to the base
//                  number in produces/consumes when a resource isn't listed.
//   cost/costGrowth — buy price, scaling with how many of this type you own.
const BUILDINGS = {
  plot: {
    name: "Plot",
    desc: "Farmland. Runs when at least one worker is assigned to it.",
    cost: { money: 50 },
    costGrowth: 1.15,
    produces: { wheat: 10 },
    worker: "farmer",
    capacityStat: "maxFarmersPerPlot",
    rateStats: { wheat: "wheatPerFarmer" },
  },
  mill: {
    name: "Mill",
    desc: "Mills raw wheat into Rough Flour at a 2:1 ratio. Runs when a miller is assigned and there's enough wheat to feed it.",
    cost: { money: 150 },
    costGrowth: 1.15,
    consumes: { wheat: 20 },
    produces: { roughFlour: 10 },
    worker: "miller",
    rateStats: { wheat: "wheatPerMill", roughFlour: "flourPerMill" },
  },
  sifter: {
    name: "Sifter",
    desc: "Sifts Rough Flour into finer Wheat Flour at a 10:7 ratio. Runs when a sifter is assigned and there's enough rough flour to feed it.",
    cost: { money: 220 },
    costGrowth: 1.15,
    consumes: { roughFlour: 10 },
    produces: { wheatFlour: 7 },
    worker: "sifter",
    rateStats: { roughFlour: "roughFlourPerSifter", wheatFlour: "wheatFlourPerSifter" },
  },
  // Water Reservoir — a plot-class building. Pipes are its "workers": each pipe
  // moves `waterPerPipe` water per turn, and up to `maxPipesPerReservoir` pipes
  // fit on one reservoir. The reservoir itself caps total output per turn via
  // `produceCap` (maxWaterPerReservoir), so it's a max-water-per-turn limiter.
  reservoir: {
    name: "Water Reservoir",
    desc: "Holds water for the farm. Fit pipes to it to move water each turn, up to the reservoir's max output.",
    cost: { money: 300 },
    costGrowth: 1.15,
    produces: { water: 5 },
    worker: "pipe",
    capacityStat: "maxPipesPerReservoir",
    rateStats: { water: "waterPerPipe" },
    produceCap: { water: "maxWaterPerReservoir" },
  },
  // Tempering Bin — dampens wheat with water into tempered wheat. One temperer
  // worker covers several bins (see WORKERS.temperer.coverageStat), the reverse
  // of a plot; a bin still runs on a single worker-slot, so it's a single-slot
  // building here.
  temperingBin: {
    name: "Tempering Bin",
    desc: "Tempers wheat with water into Tempered Wheat. Needs a temperer's attention and enough wheat and water to run.",
    cost: { money: 260 },
    costGrowth: 1.15,
    consumes: { wheat: 10, water: 5 },
    produces: { temperedWheat: 8 },
    worker: "temperer",
    rateStats: {
      wheat: "wheatPerTemperingBin",
      water: "waterPerTemperingBin",
      temperedWheat: "temperedWheatPerTemperingBin",
    },
  },
  // Flour Processor — mills tempered wheat into premium White Flour. A regular
  // one-machine-one-worker building, like the mill and sifter.
  flourProcessor: {
    name: "Flour Processor",
    desc: "Processes Tempered Wheat into premium White Flour. Runs on one processor worker when fed tempered wheat.",
    cost: { money: 400 },
    costGrowth: 1.15,
    consumes: { temperedWheat: 10 },
    produces: { whiteFlour: 8 },
    worker: "processor",
    rateStats: { temperedWheat: "temperedWheatPerProcessor", whiteFlour: "whiteFlourPerProcessor" },
  },
};

// Hireable worker TYPES. Hired workers form a pool; you assign them to specific
// buildings on the Owned tab. Hire cost scales with how many you own.
const WORKERS = {
  farmer: {
    name: "Farmer",
    desc: "Works a plot. Assign farmers to specific plots on the Owned tab.",
    cost: { money: 25 },
    costGrowth: 1.15,
  },
  miller: {
    name: "Miller",
    desc: "Works a mill, grinding wheat into rough flour. Assign millers on the Owned tab.",
    cost: { money: 40 },
    costGrowth: 1.15,
  },
  sifter: {
    name: "Sifter",
    desc: "Works a sifter, sifting rough flour into wheat flour. Assign sifters on the Owned tab.",
    cost: { money: 55 },
    costGrowth: 1.15,
  },
  // Pipes move water on reservoirs. `costGrowthStat` makes their buy-price scaling
  // upgradeable (Pipe upgrades can flatten the cost curve).
  pipe: {
    name: "Pipe",
    desc: "Moves water on a reservoir. Fit pipes to reservoirs on the Owned tab; each carries water every turn.",
    cost: { money: 30 },
    costGrowthStat: "pipeCostGrowth",
  },
  // A temperer covers several tempering bins at once. `coverageStat` (binsPerTemperer)
  // sets how many bin worker-slots each hired temperer provides — the reverse of a
  // plot, and upgradeable.
  temperer: {
    name: "Temperer",
    desc: "Tends tempering bins. Each temperer can cover several bins at once — assign them on the Owned tab.",
    cost: { money: 60 },
    costGrowth: 1.15,
    coverageStat: "binsPerTemperer",
  },
  processor: {
    name: "Processor",
    desc: "Runs a flour processor, turning tempered wheat into white flour. One per machine.",
    cost: { money: 70 },
    costGrowth: 1.15,
  },
};

// --- Game state -------------------------------------------------------------

const game = {
  turn: 1,
  turnLimit: 80,
  itemCap: 200,           // per-item stockpile limit; same for every item
  money: 0,
  inventory: { wheat: 0, water: 0, roughFlour: 0, wheatFlour: 0, temperedWheat: 0, whiteFlour: 0 },
  workers: { farmer: 0, miller: 0, sifter: 0, pipe: 0, temperer: 0, processor: 0 }, // hired pool per type
  buildings: [],          // instances: { uid, type, assigned:{worker:n}, player:bool }
  nextBuildingUid: 1,
  upgrades: {},           // purchased upgrades: id -> level (1 for one-time buys)
  // --- Prestige. These three survive retirement; everything above resets. ---
  retirementPoints: 0,    // RP: bought in the RP Shop, spent in the Retirement Shop
  hasRetired: false,      // true once the player has retired at least once
  permanentUpgrades: {},  // permanent upgrade id -> level (bought with RP)
  rpBoughtThisRun: {},    // per-resource RP bought this run; drives each resource's own
                          // RP Shop price independently. Resets on retire.
};

// Create a building instance and add it to the world.
function addBuilding(type, { player = false } = {}) {
  const inst = { uid: game.nextBuildingUid++, type, assigned: {}, player };
  game.buildings.push(inst);
  return inst;
}

// Start owning one Plot with the player already working it (10 wheat/turn).
addBuilding("plot", { player: true });

// --- Money / cost helpers ---------------------------------------------------

function balance(res) {
  return res === "money" ? game.money : (game.inventory[res] || 0);
}

function canAfford(cost) {
  return Object.entries(cost).every(([res, amt]) => balance(res) >= amt);
}

function pay(cost) {
  for (const [res, amt] of Object.entries(cost)) {
    if (res === "money") game.money -= amt;
    else game.inventory[res] -= amt;
  }
}

function scaledCost(def, owned) {
  const scale = Math.pow(def.costGrowth ?? 1, owned);
  const out = {};
  for (const [res, amt] of Object.entries(def.cost)) out[res] = Math.ceil(amt * scale);
  return out;
}

const ownedCount = (type) => game.buildings.filter((b) => b.type === type).length;
const buildingCost = (type) => scaledCost(BUILDINGS[type], ownedCount(type));

// Worker buy price scales with how many you already own. Most workers use a flat
// `costGrowth`; a worker with a `costGrowthStat` instead reads its growth live
// from that stat, so upgrades can flatten the curve (never below 1 = no scaling).
function workerCost(type) {
  const def = WORKERS[type];
  const owned = game.workers[type] || 0;
  if (!def.costGrowthStat) return scaledCost(def, owned);
  const growth = Math.max(1, deriveStats()[def.costGrowthStat] ?? 1);
  const out = {};
  for (const [res, amt] of Object.entries(def.cost)) out[res] = Math.ceil(amt * Math.pow(growth, owned));
  return out;
}

// --- Upgrades ---------------------------------------------------------------
// The upgrade DATA lives in upgrades.js (UPGRADES / BASE_STATS / STAT_INFO),
// which is loaded before this file. Everything here is the engine that reads
// that data — you shouldn't need to edit it to add upgrades.

const upgradeLevel = (id) => game.upgrades[id] || 0;
const permUpgradeLevel = (id) => game.permanentUpgrades[id] || 0;
const findUpgrade = (id) => UPGRADES.find((u) => u.id === id);
const findPermUpgrade = (id) => PERMANENT_UPGRADES.find((u) => u.id === id);
const upgradeMaxLevel = (up) => (up.repeatable ? (up.maxLevel ?? Infinity) : 1);

// Turn an effect entry into { add, mult }. A bare number means "add".
function normalizeMod(mod) {
  if (typeof mod === "number") return { add: mod, mult: 0 };
  return { add: mod.add || 0, mult: mod.mult || 0 };
}

// Derived stats = base values with every owned upgrade applied. Additives are
// summed onto the base, then multipliers apply, so purchase order is irrelevant.
// Cached because with hundreds of upgrades we don't want to recompute per card.
let cachedStats = null;
const invalidateStats = () => { cachedStats = null; };

function deriveStats() {
  if (cachedStats) return cachedStats;
  const stats = { ...BASE_STATS };
  const mults = {};
  // Regular (run) upgrades and permanent (prestige) upgrades feed the same
  // stats — permanent ones just come from a separate, retirement-proof store.
  const applyUpgrades = (list, levelOf) => {
    for (const up of list) {
      const level = levelOf(up.id);
      if (level <= 0) continue;
      for (const [stat, mod] of Object.entries(up.effects || {})) {
        const { add, mult } = normalizeMod(mod);
        if (add) stats[stat] = (stats[stat] ?? 0) + add * level;
        if (mult) mults[stat] = (mults[stat] ?? 1) * Math.pow(mult, level);
      }
    }
  };
  applyUpgrades(UPGRADES, upgradeLevel);
  applyUpgrades(PERMANENT_UPGRADES, permUpgradeLevel);
  for (const [stat, m] of Object.entries(mults)) stats[stat] = (stats[stat] ?? 0) * m;
  cachedStats = stats;
  return stats;
}

// Cost of the *next* level. Repeatable upgrades scale with how many you own.
function upgradeCost(up) {
  if (!up.repeatable) return { ...up.cost };
  const scale = Math.pow(up.costGrowth ?? 1.15, upgradeLevel(up.id));
  const out = {};
  for (const [res, amt] of Object.entries(up.cost)) out[res] = Math.ceil(amt * scale);
  return out;
}

const requirementsMet = (up) => (up.requires || []).every((id) => upgradeLevel(id) > 0);

function canBuyUpgrade(up) {
  return requirementsMet(up)
    && upgradeLevel(up.id) < upgradeMaxLevel(up)
    && canAfford(upgradeCost(up));
}

function buyUpgrade(id) {
  const up = findUpgrade(id);
  if (!up || !canBuyUpgrade(up)) return;
  pay(upgradeCost(up));
  game.upgrades[id] = upgradeLevel(id) + 1;
  invalidateStats();
  render();
}

// --- Prestige: Retirement Points, permanent upgrades, and retiring ----------
// The prestige loop: play a run, at (or after) the turn limit trade your leftover
// resources for Retirement Points in the RP Shop, then Retire to reset the farm.
// RP and everything bought with it (permanent upgrades) survive the reset.

// --- RP Shop pricing --------------------------------------------------------
// The price of the NEXT Retirement Point rises steeply as you buy more RP THIS
// RUN — but each resource climbs its OWN price independently: buying RP with
// money makes the next money-bought RP dearer without touching the wheat or
// flour prices, and vice versa. Those per-resource "bought this run" counters
// (game.rpBoughtThisRun[resource]) all reset to 0 on every retirement, so prices
// climb hard within a run but start cheap again next time.
//
// Each resource declares a `cost`, which is EITHER:
//   • a full manual price curve as a plain array — one entry per RP, in order:
//         cost: [50, 150, 500, 1200, 3000, 6000, 10000]
//     entry 0 is the 1st RP of the run, entry 1 the 2nd, and so on. Once you buy
//     past the end of the array, the last entry's price simply holds. Just paste
//     the numbers you want — no wrapper, no multiplier.
//   • a function(n) — for anyone who'd rather compute it (n = RP already bought
//     this run, 0-based). `tiered(prices, step)` builds one that reads from a
//     table and then keeps climbing by `step` per RP beyond the table.
//
// Either way it's NOT limited to a single scaling multiplier — hand-tune freely.
function tiered(prices, step = 0) {
  return (n) => (n < prices.length
    ? prices[n]
    : prices[prices.length - 1] + step * (n - prices.length + 1));
}

const RP_EXCHANGE = {
  money: {
    label: "Money",
    cost: [500, 1500, 4000, 9000, 20000, 40000, 75000, 130000, 220000],
  },
  wheat: {
    label: "Wheat",
    cost: [100, 150, 200],
  },
  roughFlour: {
    label: "Rough Flour",
    cost: [50, 90, 140, 200],
  },
};

// Price the (n-th, 0-based) RP of the run bought with `resource`. Handles both
// the array (full manual curve; last entry holds past the end) and function forms.
function rpPriceAt(resource, n) {
  const c = RP_EXCHANGE[resource].cost;
  const raw = Array.isArray(c) ? c[Math.min(n, c.length - 1)] : c(n);
  return Math.max(0, Math.ceil(raw || 0));
}

// RP already bought with `resource` this run (drives that resource's price).
const rpBought = (resource) => game.rpBoughtThisRun[resource] || 0;

// Cost of the next RP bought with `resource`, at that resource's run count.
const rpCost = (resource) => rpPriceAt(resource, rpBought(resource));

// How many RP the given resource could buy right now, walking the escalating
// price up from the current run count (every purchase makes the next dearer).
function rpAffordable(resource) {
  let bought = rpBought(resource);
  let bal = balance(resource);
  let count = 0;
  while (true) {
    const c = rpPriceAt(resource, bought);
    if (c <= 0 || bal < c) break;          // c<=0 guard also prevents infinite loops
    bal -= c; bought += 1; count += 1;
  }
  return count;
}

// Buy Retirement Points by spending a resource. `count` is a number or "max".
// Bought one at a time because each purchase raises the price of the next.
function buyRP(resource, count) {
  const want = count === "max" ? Infinity : count;
  let bought = 0;
  while (bought < want) {
    const c = rpCost(resource);
    if (c <= 0 || balance(resource) < c) break;
    pay({ [resource]: c });
    game.retirementPoints += 1;
    game.rpBoughtThisRun[resource] = rpBought(resource) + 1;
    bought += 1;
  }
  if (bought > 0) render();
}

// Cost (in RP) of the next level of a permanent upgrade.
function permUpgradeCost(up) {
  if (!up.repeatable) return up.cost;
  return Math.ceil(up.cost * Math.pow(up.costGrowth ?? 1.5, permUpgradeLevel(up.id)));
}

function canBuyPermUpgrade(up) {
  return permUpgradeLevel(up.id) < upgradeMaxLevel(up)
    && game.retirementPoints >= permUpgradeCost(up);
}

function buyPermUpgrade(id) {
  const up = findPermUpgrade(id);
  if (!up || !canBuyPermUpgrade(up)) return;
  game.retirementPoints -= permUpgradeCost(up);
  game.permanentUpgrades[id] = permUpgradeLevel(id) + 1;
  invalidateStats();
  applyPermanentBonuses(false); // storage/turn-limit bonuses take effect at once
  render();
}

// Total stockpile cap: a base 200 plus the itemCapBonus stat, which is fed by
// both permanent (Deep Silos) and regular (Warehouse) storage upgrades. Derived
// live so warehouse upgrades bought mid-run take effect immediately.
function refreshItemCap() {
  game.itemCap = 200 + Math.floor(deriveStats().itemCapBonus || 0);
}

// Recompute the run-level values that permanent upgrades feed into. Called after
// buying a permanent upgrade (money left alone) and at the start of a run, i.e.
// on retire (money reset to the Nest Egg amount).
function applyPermanentBonuses(setMoney) {
  invalidateStats();
  const stats = deriveStats();
  refreshItemCap();
  game.turnLimit = 80 + Math.floor(stats.bonusTurnLimit || 0);
  if (setMoney) game.money = Math.floor(stats.startingMoney || 0);
}

// Retire: wipe the farm back to a fresh run, keeping only RP and permanent
// upgrades. Permanent bonuses (starting money, extra turns, bigger storage) are
// applied to the new run.
function retire() {
  game.turn = 1;
  game.inventory = { wheat: 0, water: 0, roughFlour: 0, wheatFlour: 0, temperedWheat: 0, whiteFlour: 0 };
  game.workers = { farmer: 0, miller: 0, sifter: 0, pipe: 0, temperer: 0, processor: 0 };
  game.buildings = [];
  game.nextBuildingUid = 1;
  game.upgrades = {};
  game.rpBoughtThisRun = {}; // per-resource RP Shop prices reset for the new run
  game.hasRetired = true;
  applyPermanentBonuses(true);
  addBuilding("plot", { player: true }); // start again with one worked plot
  render();
}

// --- Worker bookkeeping -----------------------------------------------------

const findBuilding = (uid) => game.buildings.find((b) => b.uid === uid);

// Total of a worker type currently assigned across all buildings.
function totalAssigned(workerType) {
  return game.buildings.reduce((sum, b) => sum + (b.assigned[workerType] || 0), 0);
}

// Total worker-slots a hired pool provides. Normally one slot per worker, but a
// worker type with a `coverageStat` (e.g. a temperer covering several bins)
// provides that many slots each — the reverse of the plot model.
function workerSlots(workerType) {
  const def = WORKERS[workerType];
  const per = def.coverageStat ? Math.max(1, Math.floor(deriveStats()[def.coverageStat] ?? 1)) : 1;
  return (game.workers[workerType] || 0) * per;
}

// Free (unassigned) worker-slots of a type — what's left to place on buildings.
function idleWorkers(workerType) {
  return workerSlots(workerType) - totalAssigned(workerType);
}

// Everyone working a single building instance (assigned workers + the player).
function instanceWorkerCount(inst) {
  let n = inst.player ? 1 : 0;
  for (const c of Object.values(inst.assigned)) n += c;
  return n;
}

// How many workers can productively work one building instance at once. Driven
// by the building's `capacityStat` (Coordination upgrades raise it); defaults to
// 1. Extra workers beyond the cap sit idle and add nothing.
function instanceCapacity(inst) {
  const stat = BUILDINGS[inst.type].capacityStat;
  const cap = stat ? deriveStats()[stat] : 1;
  return Math.max(1, Math.floor(cap));
}

// Back-compat helper: capacity of a plot with no instance in hand.
const plotCapacity = () => Math.max(1, Math.floor(deriveStats().maxFarmersPerPlot));

// --- Production -------------------------------------------------------------
// Rates scale per worker: each of the (capped) workers on a building produces —
// and, for processors like the mill, consumes — the building's per-worker rate.
// A resource's per-worker amount comes from its `rateStats` stat when one is
// declared (so upgrades retune it), else the base number in produces/consumes.
// e.g. a plot with 2 farmers at wheatPerFarmer 12 makes 24 wheat/turn; a mill
// with 1 miller consumes 20 wheat and makes 10 flour.
function instanceRates(inst) {
  const def = BUILDINGS[inst.type];
  const stats = deriveStats();
  const workers = Math.min(instanceWorkerCount(inst), instanceCapacity(inst));
  // Floored so upgrade multipliers (e.g. a ×1.5 rate) never leave fractional
  // wheat or flour in the stockpile.
  const rate = (res, base) => {
    const stat = def.rateStats && def.rateStats[res];
    return Math.floor((stat ? stats[stat] : base) * workers);
  };
  const produces = {};
  const consumes = {};
  for (const [res, base] of Object.entries(def.produces || {})) {
    let amt = rate(res, base);
    // A building may cap a resource's per-turn output (e.g. a reservoir's max
    // water/turn), regardless of how many workers push against it.
    const capStat = def.produceCap && def.produceCap[res];
    if (capStat) amt = Math.min(amt, Math.max(0, Math.floor(stats[capStat] ?? 0)));
    produces[res] = amt;
  }
  for (const [res, base] of Object.entries(def.consumes || {})) consumes[res] = rate(res, base);
  return { produces, consumes, workers };
}

// Net nominal per-turn change across every owned building, keyed by item
// (produced minus consumed, assuming every processor is fed). Used for the
// "per turn" readouts — actual mill output at turn time is gated on real wheat.
function production() {
  const out = {};
  for (const inst of game.buildings) {
    const { produces, consumes } = instanceRates(inst);
    for (const [res, amt] of Object.entries(produces)) out[res] = (out[res] || 0) + amt;
    for (const [res, amt] of Object.entries(consumes)) out[res] = (out[res] || 0) - amt;
  }
  return out;
}

// --- Actions ----------------------------------------------------------------

// Add an amount to a stockpiled item, clamped to [0, itemCap].
function stock(res, amt) {
  game.inventory[res] = Math.max(0, Math.min(game.itemCap, (game.inventory[res] || 0) + amt));
}

function passTurn() {
  if (game.turn >= game.turnLimit) return;
  game.turn += 1;

  // Phase 1 — raw producers (no inputs) add their output to the stockpile.
  for (const inst of game.buildings) {
    if (BUILDINGS[inst.type].consumes) continue;
    for (const [res, amt] of Object.entries(instanceRates(inst).produces)) stock(res, amt);
  }

  // Phase 2 — processors (e.g. mills) consume from the stockpile and produce.
  // A mill only runs if there's enough wheat for its full input this turn, so
  // amounts stay whole; when several compete, earlier instances feed first.
  for (const inst of game.buildings) {
    const def = BUILDINGS[inst.type];
    if (!def.consumes) continue;
    const { produces, consumes } = instanceRates(inst);
    const fed = Object.entries(consumes).every(([res, amt]) => (game.inventory[res] || 0) >= amt);
    if (!fed) continue;
    for (const [res, amt] of Object.entries(consumes)) stock(res, -amt);
    for (const [res, amt] of Object.entries(produces)) stock(res, amt);
  }

  render();
}

function buyBuilding(type) {
  const cost = buildingCost(type);
  if (!canAfford(cost)) return;
  pay(cost);
  addBuilding(type);
  render();
}

function hireWorker(type) {
  const cost = workerCost(type);
  if (!canAfford(cost)) return;
  pay(cost);
  game.workers[type] = (game.workers[type] || 0) + 1;
  render();
}

// Assign/unassign a worker to a specific building instance.
function assignWorker(uid, workerType, delta) {
  const inst = findBuilding(uid);
  if (!inst) return;
  const cur = inst.assigned[workerType] || 0;
  if (delta > 0) {
    if (idleWorkers(workerType) <= 0) return;                     // none free to add
    if (instanceWorkerCount(inst) >= instanceCapacity(inst)) return; // already full
  }
  inst.assigned[workerType] = Math.max(0, cur + delta);
  render();
}

// Place the player in a specific building (they leave wherever they were), or
// pass null to make the player idle.
function setPlayerAt(uid) {
  for (const b of game.buildings) b.player = false;
  if (uid !== null) {
    const inst = findBuilding(uid);
    if (inst) inst.player = true;
  }
  render();
}

// Sell an item for dollars. `amount` is a number or "all".
function sell(item, amount) {
  const have = game.inventory[item] || 0;
  const qty = amount === "all" ? have : Math.min(amount, have);
  if (qty <= 0) return;
  game.inventory[item] -= qty;
  game.money += qty * sellPrice(item);
  render();
}

// Raise (or lower) the turn limit. Future upgrades call this.
function increaseTurnLimit(amount = 1) {
  game.turnLimit += amount;
  render();
  return game.turnLimit;
}

// --- DOM refs ---------------------------------------------------------------

const currentTurnEl = document.getElementById("current-turn");
const turnLimitEl = document.getElementById("turn-limit");
const wheatAmountEl = document.getElementById("wheat-amount");
const wheatCapEl = document.getElementById("wheat-cap");
const wheatStatEl = document.getElementById("wheat-stat");
const moneyAmountEl = document.getElementById("money-amount");
const wheatPerTurnEl = document.getElementById("wheat-per-turn");
const passTurnBtn = document.getElementById("pass-turn");
const turnMessageEl = document.getElementById("turn-message");
const buildingsListEl = document.getElementById("buildings-list");
const ownedHeaderEl = document.getElementById("owned-header");
const ownedListEl = document.getElementById("owned-list");
const workersListEl = document.getElementById("workers-list");
const upgradesHeaderEl = document.getElementById("upgrades-header");
const upgradesListEl = document.getElementById("upgrades-list");
const inventoryListEl = document.getElementById("inventory-list");

// Prestige DOM refs.
const prestigeBarEl = document.getElementById("prestige-bar");
const openRpShopBtn = document.getElementById("open-rp-shop");
const openRetirementShopBtn = document.getElementById("open-retirement-shop");
const retireBtn = document.getElementById("retire-btn");
const rpBalanceShopEl = document.getElementById("rp-balance-shop");
const rpBalancePermEl = document.getElementById("rp-balance-perm");
const rpShopListEl = document.getElementById("rp-shop-list");
const permUpgradesListEl = document.getElementById("perm-upgrades-list");
const retireModalEl = document.getElementById("retire-modal");

// --- Rendering --------------------------------------------------------------

function costLabel(cost) {
  return Object.entries(cost)
    .map(([res, amt]) => (res === "money" ? `$${amt}` : `${amt} ${ITEMS[res].name.toLowerCase()}`))
    .join(", ");
}

// Player's current location, as a readable string.
function playerLocation() {
  const inst = game.buildings.find((b) => b.player);
  if (!inst) return "Idle";
  return `${BUILDINGS[inst.type].name} #${instanceNumber(inst)}`;
}

// The N in "Plot #N": position of this instance among others of its type.
function instanceNumber(inst) {
  let n = 0;
  for (const b of game.buildings) {
    if (b.type === inst.type) {
      n += 1;
      if (b.uid === inst.uid) return n;
    }
  }
  return n;
}

function renderStats() {
  const prod = production();
  const wheat = game.inventory.wheat || 0;
  const atCap = wheat >= game.itemCap;

  currentTurnEl.textContent = game.turn;
  turnLimitEl.textContent = game.turnLimit;
  wheatAmountEl.textContent = wheat;
  wheatCapEl.textContent = game.itemCap;
  moneyAmountEl.textContent = game.money;
  const netWheat = prod.wheat || 0;
  wheatPerTurnEl.textContent = (netWheat >= 0 ? "+" : "−") + Math.abs(netWheat);
  wheatStatEl.classList.toggle("full", atCap);

  const atTurnLimit = game.turn >= game.turnLimit;
  passTurnBtn.disabled = atTurnLimit;

  let msg = "";
  if (atTurnLimit) msg = "Turn limit reached.";
  else if (atCap) msg = "Wheat storage full — sell some or the surplus is wasted.";
  turnMessageEl.textContent = msg;
}

// Buildings tab = the shop: buy new building instances.
function renderBuildingsShop() {
  buildingsListEl.innerHTML = "";
  for (const [type, def] of Object.entries(BUILDINGS)) {
    const cost = buildingCost(type);
    const affordable = canAfford(cost);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <span class="card-name">${def.name}</span>
        <span class="card-owned">Owned: ${ownedCount(type)}</span>
      </div>
      <p class="card-desc">${def.desc}</p>
      <div class="btn-row">
        <button class="buy-btn" ${affordable ? "" : "disabled"}>Buy — ${costLabel(cost)}</button>
      </div>
    `;
    card.querySelector(".buy-btn").addEventListener("click", () => buyBuilding(type));
    buildingsListEl.appendChild(card);
  }
}

// Only plot-like buildings hold more than one worker — that's exactly the ones
// with a `capacityStat` (a stat that can raise their worker cap). Everything
// else is a fixed one-worker-per-building shop, now and in the future. The Owned
// tab uses this split to pick the control style, so the player can *see* the
// difference: plots get a farmer counter, other buildings get a simple toggle.
const isMultiWorker = (type) => !!BUILDINGS[type].capacityStat;

// Which Owned sub-tab is showing: "plots" (multi-worker) or "buildings" (single).
let ownedTab = "plots";

// Shared status line for a building instance: its per-turn output/consumption,
// or why it's idle. `starved` = staffed but short on an input right now.
function instanceStatus(inst) {
  const { produces, consumes } = instanceRates(inst);
  const staffed = instanceWorkerCount(inst) >= 1;
  const starved = staffed && Object.entries(consumes)
    .some(([res, amt]) => (game.inventory[res] || 0) < amt);
  const outLabel = [
    ...Object.entries(consumes).map(([res, amt]) => `−${amt} ${ITEMS[res].name.toLowerCase()}`),
    ...Object.entries(produces).map(([res, amt]) => `+${amt} ${ITEMS[res].name.toLowerCase()}`),
  ].join(", ");
  let text;
  if (!staffed) text = "Idle — needs a worker";
  else if (starved) text = `${outLabel}/turn — low on wheat`;
  else text = outLabel + "/turn";
  return { text, starved };
}

// The "Work here / You: here" button, shared by both card styles.
function playerButtonHTML(inst) {
  return `<button class="mini-btn player-btn ${inst.player ? "active" : ""}">${inst.player ? "You: here" : "Work here"}</button>`;
}

function wirePlayerButton(card, inst) {
  card.querySelector(".player-btn")
    .addEventListener("click", () => setPlayerAt(inst.player ? null : inst.uid));
}

// Plot-style card: a farmer counter with a working/capacity note, because plots
// can hold several farmers at once.
function multiWorkerCard(inst) {
  const def = BUILDINGS[inst.type];
  const wType = def.worker;
  const wDef = WORKERS[wType];
  const assigned = inst.assigned[wType] || 0;
  const here = instanceWorkerCount(inst);
  const cap = instanceCapacity(inst);
  const full = here >= cap;
  const st = instanceStatus(inst);

  const card = document.createElement("div");
  card.className = "card" + (inst.player ? " here" : "");
  card.innerHTML = `
    <div class="card-head">
      <span class="card-name">${def.name} #${instanceNumber(inst)}</span>
      <span class="card-owned ${st.starved ? "warn" : ""}">${st.text}</span>
    </div>
    <div class="assign-line">
      <span class="row-label">${wDef.name}s:</span>
      <button class="mini-btn w-minus" ${assigned <= 0 ? "disabled" : ""}>&minus;</button>
      <span class="badge">${assigned}</span>
      <button class="mini-btn w-plus" ${idleWorkers(wType) <= 0 || full ? "disabled" : ""}>+</button>
      <span class="cap-note">${here}/${cap} working</span>
      <span class="spacer"></span>
      ${playerButtonHTML(inst)}
    </div>
  `;
  card.querySelector(".w-plus").addEventListener("click", () => assignWorker(inst.uid, wType, 1));
  card.querySelector(".w-minus").addEventListener("click", () => assignWorker(inst.uid, wType, -1));
  wirePlayerButton(card, inst);
  return card;
}

// Single-worker card: one on/off toggle, because every non-plot building runs on
// exactly one worker who does a flat one building's worth of work.
function singleWorkerCard(inst) {
  const def = BUILDINGS[inst.type];
  const wType = def.worker;
  const wDef = WORKERS[wType];
  const on = (inst.assigned[wType] || 0) >= 1;
  // Can only staff it if a worker is free AND the single slot isn't already
  // taken (by another worker or by the player standing in).
  const canAssign = idleWorkers(wType) > 0 && instanceWorkerCount(inst) < instanceCapacity(inst);
  const st = instanceStatus(inst);

  const toggle = on
    ? `<button class="mini-btn worker-toggle active">✓ ${wDef.name} working</button>`
    : `<button class="mini-btn worker-toggle" ${canAssign ? "" : "disabled"}>Assign ${wDef.name}</button>`;

  const card = document.createElement("div");
  card.className = "card" + (inst.player ? " here" : "");
  card.innerHTML = `
    <div class="card-head">
      <span class="card-name">${def.name} #${instanceNumber(inst)}</span>
      <span class="card-owned ${st.starved ? "warn" : ""}">${st.text}</span>
    </div>
    <div class="assign-line">
      ${toggle}
      <span class="spacer"></span>
      ${playerButtonHTML(inst)}
    </div>
  `;
  card.querySelector(".worker-toggle")
    .addEventListener("click", () => assignWorker(inst.uid, wType, on ? -1 : 1));
  wirePlayerButton(card, inst);
  return card;
}

// Owned tab = manage each building instance individually, split into Plots
// (multi-worker) and Buildings (one worker each).
function renderOwned() {
  // Header: where the player is, plus idle workers available to assign.
  const idleBits = Object.entries(WORKERS)
    .map(([id, def]) => `${def.name}s idle: <b>${idleWorkers(id)}</b>`)
    .join(" &nbsp;·&nbsp; ");
  ownedHeaderEl.innerHTML = `
    <div><span class="row-label">You:</span> <b>${playerLocation()}</b>
      ${game.buildings.some((b) => b.player) ? `<button class="mini-btn go-idle">Go idle</button>` : ""}
    </div>
    <div class="idle-line">${idleBits}</div>
  `;
  const idleBtn = ownedHeaderEl.querySelector(".go-idle");
  if (idleBtn) idleBtn.addEventListener("click", () => setPlayerAt(null));

  const plots = game.buildings.filter((b) => isMultiWorker(b.type));
  const others = game.buildings.filter((b) => !isMultiWorker(b.type));
  const groups = { plots, buildings: others };
  const list = groups[ownedTab] || [];

  ownedListEl.innerHTML = "";

  // Sub-tab bar: Plots | Buildings, with live counts.
  const bar = document.createElement("div");
  bar.className = "owned-tabs";
  bar.innerHTML = `
    <button class="owned-tab-btn ${ownedTab === "plots" ? "active" : ""}" data-otab="plots">Plots (${plots.length})</button>
    <button class="owned-tab-btn ${ownedTab === "buildings" ? "active" : ""}" data-otab="buildings">Buildings (${others.length})</button>
  `;
  bar.querySelectorAll(".owned-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => { ownedTab = btn.dataset.otab; render(); });
  });
  ownedListEl.appendChild(bar);

  if (list.length === 0) {
    const hint = document.createElement("p");
    hint.className = "card-desc";
    hint.textContent = ownedTab === "plots"
      ? "No plots yet — buy one on the Buildings tab."
      : "No other buildings yet — buy a Mill on the Buildings tab.";
    ownedListEl.appendChild(hint);
    return;
  }

  for (const inst of list) {
    ownedListEl.appendChild(isMultiWorker(inst.type) ? multiWorkerCard(inst) : singleWorkerCard(inst));
  }
}

// Workers tab = the hiring pool.
function renderWorkers() {
  workersListEl.innerHTML = "";
  for (const [type, def] of Object.entries(WORKERS)) {
    const owned = game.workers[type] || 0;
    const cost = workerCost(type);
    const affordable = canAfford(cost);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <span class="card-name">${def.name}</span>
        <span class="card-owned">Owned: ${owned} · Idle: ${idleWorkers(type)}</span>
      </div>
      <p class="card-desc">${def.desc}</p>
      <div class="btn-row">
        <button class="buy-btn" ${affordable ? "" : "disabled"}>Hire — ${costLabel(cost)}</button>
      </div>
    `;
    card.querySelector(".buy-btn").addEventListener("click", () => hireWorker(type));
    workersListEl.appendChild(card);
  }
}

// A readable "+2 wheat per farmer, ×1.5 …" line, generated from an upgrade's
// effects so new upgrades describe themselves with no extra work.
function effectLabel(up) {
  const parts = [];
  for (const [stat, mod] of Object.entries(up.effects || {})) {
    const label = (STAT_INFO[stat] || {}).label || stat;
    const { add, mult } = normalizeMod(mod);
    if (add) parts.push(`+${add} ${label}`);
    if (mult) parts.push(`×${mult} ${label}`);
  }
  return parts.join(", ");
}

function formatStat(stat, val) {
  return (STAT_INFO[stat] || {}).integer ? Math.floor(val) : Math.round(val * 100) / 100;
}

function upgradeCard(up) {
  const level = upgradeLevel(up.id);
  const maxed = level >= upgradeMaxLevel(up);
  const locked = !requirementsMet(up);
  const cost = upgradeCost(up);
  const affordable = canAfford(cost);

  const card = document.createElement("div");
  card.className = "card upgrade" + (maxed ? " owned" : "") + (locked && !maxed ? " locked" : "");

  const levelTag = up.repeatable
    ? ` <span class="lvl">Lv ${level}${up.maxLevel ? "/" + up.maxLevel : ""}</span>`
    : (level > 0 ? ` <span class="lvl">✓</span>` : "");

  let action;
  if (maxed) {
    action = `<span class="owned-tag">${up.repeatable ? "Maxed" : "Owned"}</span>`;
  } else if (locked) {
    const names = up.requires.map((id) => (findUpgrade(id)?.name) || id);
    action = `<span class="lock-tag">🔒 Requires: ${names.join(", ")}</span>`;
  } else {
    action = `<button class="buy-btn" ${affordable ? "" : "disabled"}>Buy — ${costLabel(cost)}</button>`;
  }

  card.innerHTML = `
    <div class="card-head">
      <span class="card-name">${up.name}${levelTag}</span>
      <span class="card-owned">${effectLabel(up)}</span>
    </div>
    ${up.desc ? `<p class="card-desc">${up.desc}</p>` : ""}
    <div class="btn-row">${action}</div>
  `;
  const btn = card.querySelector(".buy-btn");
  if (btn) btn.addEventListener("click", () => buyUpgrade(up.id));
  return card;
}

// Upgrades tab = spend money/wheat on permanent bonuses, grouped by category.
function renderUpgrades() {
  const stats = deriveStats();
  upgradesHeaderEl.innerHTML = Object.keys(STAT_INFO)
    .filter((stat) => !STAT_INFO[stat].internal)
    .map((stat) => `${(STAT_INFO[stat] || {}).label}: <b>${formatStat(stat, stats[stat] ?? 0)}</b>`)
    .join(" &nbsp;·&nbsp; ");

  upgradesListEl.innerHTML = "";
  // Group by category, preserving the order categories first appear in the file.
  const groups = new Map();
  for (const up of UPGRADES) {
    const cat = up.category || "Misc";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(up);
  }
  for (const [cat, list] of groups) {
    const heading = document.createElement("h2");
    heading.className = "upgrade-cat";
    heading.textContent = cat;
    upgradesListEl.appendChild(heading);
    for (const up of list) upgradesListEl.appendChild(upgradeCard(up));
  }
}

// --- Prestige rendering -----------------------------------------------------

// Turn at which the prestige bar (Retirement Points Shop, Retire) unlocks within
// a run. Editable — the bar also always appears once you hit the turn limit or
// have retired at least once.
const PRESTIGE_UNLOCK_TURN = 40;

// The prestige bar (below the title): the Retirement Points Shop opens from
// PRESTIGE_UNLOCK_TURN onward (or once you've retired at least once), so the bar
// itself appears then. The Retire button, though, stays hidden until you actually
// hit the max turn — you can shop for RP early, but only retire at run's end. The
// Retirement Shop button only appears after the first retirement.
function renderPrestigeBar() {
  const show = game.hasRetired
    || game.turn >= PRESTIGE_UNLOCK_TURN
    || game.turn >= game.turnLimit;
  prestigeBarEl.classList.toggle("hidden", !show);
  retireBtn.classList.toggle("hidden", game.turn < game.turnLimit);
  openRetirementShopBtn.classList.toggle("hidden", !game.hasRetired);
}

// Money reads with a leading $, everything else is a plain count.
const resAmountLabel = (res, amt) => (res === "money" ? `$${amt}` : `${amt}`);

// RP Shop: one card per resource, converting it into Retirement Points.
function renderRPShop() {
  rpBalanceShopEl.textContent = game.retirementPoints;
  rpShopListEl.innerHTML = "";
  for (const [res, def] of Object.entries(RP_EXCHANGE)) {
    const have = balance(res);
    const next = rpCost(res);
    const max = rpAffordable(res);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <span class="card-name">${def.label}</span>
        <span class="card-owned">You have: ${resAmountLabel(res, have)}</span>
      </div>
      <p class="card-desc">Next RP: ${resAmountLabel(res, next)} — price rises with each RP bought this run.</p>
      <div class="btn-row">
        <button class="buy-btn rp-buy1" ${max < 1 ? "disabled" : ""}>Buy 1 RP</button>
        <button class="buy-btn rp-buymax" ${max < 1 ? "disabled" : ""}>Buy Max${max > 0 ? ` — +${max} RP` : ""}</button>
      </div>
    `;
    card.querySelector(".rp-buy1").addEventListener("click", () => buyRP(res, 1));
    card.querySelector(".rp-buymax").addEventListener("click", () => buyRP(res, "max"));
    rpShopListEl.appendChild(card);
  }
}

// A permanent-upgrade card (RP-priced), mirroring the regular upgrade card.
function permUpgradeCard(up) {
  const level = permUpgradeLevel(up.id);
  const maxed = level >= upgradeMaxLevel(up);
  const cost = permUpgradeCost(up);
  const affordable = game.retirementPoints >= cost;

  const card = document.createElement("div");
  card.className = "card upgrade" + (maxed ? " owned" : "");

  const levelTag = up.repeatable
    ? ` <span class="lvl">Lv ${level}${up.maxLevel ? "/" + up.maxLevel : ""}</span>`
    : (level > 0 ? ` <span class="lvl">✓</span>` : "");

  const action = maxed
    ? `<span class="owned-tag">${up.repeatable ? "Maxed" : "Owned"}</span>`
    : `<button class="buy-btn" ${affordable ? "" : "disabled"}>Buy — ${cost} RP</button>`;

  card.innerHTML = `
    <div class="card-head">
      <span class="card-name">${up.name}${levelTag}</span>
      <span class="card-owned">${effectLabel(up)}</span>
    </div>
    ${up.desc ? `<p class="card-desc">${up.desc}</p>` : ""}
    <div class="btn-row">${action}</div>
  `;
  const btn = card.querySelector(".buy-btn");
  if (btn) btn.addEventListener("click", () => buyPermUpgrade(up.id));
  return card;
}

function renderRetirementShop() {
  rpBalancePermEl.textContent = game.retirementPoints;
  permUpgradesListEl.innerHTML = "";
  for (const up of PERMANENT_UPGRADES) permUpgradesListEl.appendChild(permUpgradeCard(up));
}

function renderInventory() {
  inventoryListEl.innerHTML = "";
  for (const [id, def] of Object.entries(ITEMS)) {
    const amount = game.inventory[id] || 0;
    const pct = Math.min(100, (amount / game.itemCap) * 100);
    const atCap = amount >= game.itemCap;
    const sellable = isSellable(id);
    const price = sellPrice(id);

    const sellRow = sellable
      ? `<div class="btn-row">
        <span class="row-label">Sell (@ $${price}):</span>
        <button class="mini-btn sell1" ${amount < 1 ? "disabled" : ""}>Sell 1</button>
        <button class="mini-btn sell10" ${amount < 1 ? "disabled" : ""}>Sell 10</button>
        <button class="mini-btn sellall" ${amount < 1 ? "disabled" : ""}>Sell All</button>
      </div>`
      : `<div class="btn-row"><span class="row-label">Crafting material — not for sale.</span></div>`;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <span class="card-name">${def.name}</span>
        <span class="inv-amount ${atCap ? "full" : ""}">${amount} / ${game.itemCap}</span>
      </div>
      <div class="bar"><div class="bar-fill ${atCap ? "full" : ""}" style="width:${pct}%"></div></div>
      ${sellRow}
    `;
    if (sellable) {
      card.querySelector(".sell1").addEventListener("click", () => sell(id, 1));
      card.querySelector(".sell10").addEventListener("click", () => sell(id, 10));
      card.querySelector(".sellall").addEventListener("click", () => sell(id, "all"));
    }
    inventoryListEl.appendChild(card);
  }
}

function render() {
  refreshItemCap();
  renderStats();
  renderBuildingsShop();
  renderOwned();
  renderWorkers();
  renderUpgrades();
  renderInventory();
  renderPrestigeBar();
  renderRPShop();
  renderRetirementShop();
}

// --- Wiring -----------------------------------------------------------------

passTurnBtn.addEventListener("click", passTurn);

// --- Prestige wiring: overlays and the retire confirmation ------------------

function closeScreens() {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
}

openRpShopBtn.addEventListener("click", () => {
  closeScreens();
  document.getElementById("screen-rp-shop").classList.remove("hidden");
  render();
});

openRetirementShopBtn.addEventListener("click", () => {
  closeScreens();
  document.getElementById("screen-retirement-shop").classList.remove("hidden");
  render();
});

document.querySelectorAll("[data-close-screen]").forEach((btn) => {
  btn.addEventListener("click", closeScreens);
});

retireBtn.addEventListener("click", () => retireModalEl.classList.remove("hidden"));
document.getElementById("retire-cancel")
  .addEventListener("click", () => retireModalEl.classList.add("hidden"));
document.getElementById("retire-confirm").addEventListener("click", () => {
  retireModalEl.classList.add("hidden");
  closeScreens();
  retire();
});

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tab-panel").forEach((p) =>
      p.classList.toggle("active", p.id === `tab-${tab}`)
    );
  });
});

// Expose the core API for the console and future systems.
window.wheatGame = {
  state: game,
  ITEMS, BUILDINGS, WORKERS, UPGRADES, PERMANENT_UPGRADES, RP_EXCHANGE,
  passTurn, buyBuilding, hireWorker, assignWorker, setPlayerAt, sell, sellPrice,
  addBuilding, increaseTurnLimit, production, idleWorkers,
  buyUpgrade, deriveStats, plotCapacity, instanceCapacity, instanceRates,
  buyRP, rpCost, rpAffordable, buyPermUpgrade, retire, permUpgradeLevel,
};

render();
