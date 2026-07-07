// Wheat Incremental — core gameplay
// Data-driven and instance-based: every building the player owns is a separate
// object that workers (and the player) are assigned to individually. This is the
// foundation for many building types and multiple workers per building.

// --- Static definitions -----------------------------------------------------

// Stockpiled resources. Every item shares one cap (game.itemCap). Money is a
// separate currency (uncapped), handled below — it is not an item.
const ITEMS = {
  wheat: { name: "Wheat" },
  roughFlour: { name: "Rough Flour" },
};

// What each item sells for, in dollars.
const SELL_PRICES = {
  wheat: 1,
  roughFlour: 4,
};

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
    capacityStat: "maxMillersPerMill",
    rateStats: { wheat: "wheatPerMill", roughFlour: "flourPerMill" },
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
};

// --- Game state -------------------------------------------------------------

const game = {
  turn: 1,
  turnLimit: 80,
  itemCap: 200,           // per-item stockpile limit; same for every item
  money: 0,
  inventory: { wheat: 0, roughFlour: 0 },
  workers: { farmer: 0, miller: 0 }, // hired (owned) pool per worker type
  buildings: [],          // instances: { uid, type, assigned:{worker:n}, player:bool }
  nextBuildingUid: 1,
  upgrades: {},           // purchased upgrades: id -> level (1 for one-time buys)
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
const workerCost = (type) => scaledCost(WORKERS[type], game.workers[type] || 0);

// --- Upgrades ---------------------------------------------------------------
// The upgrade DATA lives in upgrades.js (UPGRADES / BASE_STATS / STAT_INFO),
// which is loaded before this file. Everything here is the engine that reads
// that data — you shouldn't need to edit it to add upgrades.

const upgradeLevel = (id) => game.upgrades[id] || 0;
const findUpgrade = (id) => UPGRADES.find((u) => u.id === id);
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
  for (const up of UPGRADES) {
    const level = upgradeLevel(up.id);
    if (level <= 0) continue;
    for (const [stat, mod] of Object.entries(up.effects || {})) {
      const { add, mult } = normalizeMod(mod);
      if (add) stats[stat] = (stats[stat] ?? 0) + add * level;
      if (mult) mults[stat] = (mults[stat] ?? 1) * Math.pow(mult, level);
    }
  }
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

// --- Worker bookkeeping -----------------------------------------------------

const findBuilding = (uid) => game.buildings.find((b) => b.uid === uid);

// Total of a worker type currently assigned across all buildings.
function totalAssigned(workerType) {
  return game.buildings.reduce((sum, b) => sum + (b.assigned[workerType] || 0), 0);
}

// Hired but unassigned workers of a type.
function idleWorkers(workerType) {
  return (game.workers[workerType] || 0) - totalAssigned(workerType);
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
  const rate = (res, base) => {
    const stat = def.rateStats && def.rateStats[res];
    return (stat ? stats[stat] : base) * workers;
  };
  const produces = {};
  const consumes = {};
  for (const [res, base] of Object.entries(def.produces || {})) produces[res] = rate(res, base);
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
  game.money += qty * (SELL_PRICES[item] || 0);
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

// Owned tab = manage each building instance individually.
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

  ownedListEl.innerHTML = "";
  if (game.buildings.length === 0) {
    ownedListEl.innerHTML = `<p class="card-desc">No buildings yet — buy one on the Buildings tab.</p>`;
    return;
  }

  for (const inst of game.buildings) {
    const def = BUILDINGS[inst.type];
    const wType = def.worker;
    const wDef = WORKERS[wType];
    const assigned = inst.assigned[wType] || 0;
    const here = instanceWorkerCount(inst);
    const cap = instanceCapacity(inst);
    const full = here >= cap;
    const staffed = here >= 1;
    const { produces, consumes } = instanceRates(inst);
    // Staffed processor with too little input on hand right now is "starved".
    const starved = staffed && Object.entries(consumes)
      .some(([res, amt]) => (game.inventory[res] || 0) < amt);
    const outLabel = [
      ...Object.entries(consumes).map(([res, amt]) => `−${amt} ${ITEMS[res].name.toLowerCase()}`),
      ...Object.entries(produces).map(([res, amt]) => `+${amt} ${ITEMS[res].name.toLowerCase()}`),
    ].join(", ");

    let status;
    if (!staffed) status = "Idle — needs a worker";
    else if (starved) status = `${outLabel}/turn — low on wheat`;
    else status = outLabel + "/turn";

    const card = document.createElement("div");
    card.className = "card" + (inst.player ? " here" : "");
    card.innerHTML = `
      <div class="card-head">
        <span class="card-name">${def.name} #${instanceNumber(inst)}</span>
        <span class="card-owned ${starved ? "warn" : ""}">${status}</span>
      </div>
      <div class="assign-line">
        <span class="row-label">${wDef.name}s:</span>
        <button class="mini-btn w-minus" ${assigned <= 0 ? "disabled" : ""}>&minus;</button>
        <span class="badge">${assigned}</span>
        <button class="mini-btn w-plus" ${idleWorkers(wType) <= 0 || full ? "disabled" : ""}>+</button>
        <span class="cap-note">${here}/${cap} working</span>
        <span class="spacer"></span>
        <button class="mini-btn player-btn ${inst.player ? "active" : ""}">
          ${inst.player ? "You: here" : "Work here"}
        </button>
      </div>
    `;
    card.querySelector(".w-plus").addEventListener("click", () => assignWorker(inst.uid, wType, 1));
    card.querySelector(".w-minus").addEventListener("click", () => assignWorker(inst.uid, wType, -1));
    card.querySelector(".player-btn").addEventListener("click", () =>
      setPlayerAt(inst.player ? null : inst.uid)
    );
    ownedListEl.appendChild(card);
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

function renderInventory() {
  inventoryListEl.innerHTML = "";
  for (const [id, def] of Object.entries(ITEMS)) {
    const amount = game.inventory[id] || 0;
    const pct = Math.min(100, (amount / game.itemCap) * 100);
    const atCap = amount >= game.itemCap;
    const price = SELL_PRICES[id] || 0;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <span class="card-name">${def.name}</span>
        <span class="inv-amount ${atCap ? "full" : ""}">${amount} / ${game.itemCap}</span>
      </div>
      <div class="bar"><div class="bar-fill ${atCap ? "full" : ""}" style="width:${pct}%"></div></div>
      <div class="btn-row">
        <span class="row-label">Sell (@ $${price}):</span>
        <button class="mini-btn sell1" ${amount < 1 ? "disabled" : ""}>Sell 1</button>
        <button class="mini-btn sell10" ${amount < 1 ? "disabled" : ""}>Sell 10</button>
        <button class="mini-btn sellall" ${amount < 1 ? "disabled" : ""}>Sell All</button>
      </div>
    `;
    card.querySelector(".sell1").addEventListener("click", () => sell(id, 1));
    card.querySelector(".sell10").addEventListener("click", () => sell(id, 10));
    card.querySelector(".sellall").addEventListener("click", () => sell(id, "all"));
    inventoryListEl.appendChild(card);
  }
}

function render() {
  renderStats();
  renderBuildingsShop();
  renderOwned();
  renderWorkers();
  renderUpgrades();
  renderInventory();
}

// --- Wiring -----------------------------------------------------------------

passTurnBtn.addEventListener("click", passTurn);

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
  ITEMS, BUILDINGS, WORKERS, UPGRADES,
  passTurn, buyBuilding, hireWorker, assignWorker, setPlayerAt, sell,
  addBuilding, increaseTurnLimit, production, idleWorkers,
  buyUpgrade, deriveStats, plotCapacity, instanceCapacity, instanceRates,
};

render();
