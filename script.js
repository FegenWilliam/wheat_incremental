// Wheat Incremental — core gameplay
// Data-driven and instance-based: every building the player owns is a separate
// object that workers (and the player) are assigned to individually. This is the
// foundation for many building types and multiple workers per building.

// --- Static definitions -----------------------------------------------------

// Stockpiled resources. Every item shares one cap (game.itemCap). Money is a
// separate currency (uncapped), handled below — it is not an item.
const ITEMS = {
  wheat: { name: "Wheat" },
};

// What each item sells for, in dollars.
const SELL_PRICES = {
  wheat: 1,
};

// Building TYPES. Each owned building is an instance of one of these.
//   worker  — the worker type this building needs to run (one type for now).
//   produces — output per turn when the building is "running".
//   cost/costGrowth — buy price, scaling with how many of this type you own.
const BUILDINGS = {
  plot: {
    name: "Plot",
    desc: "Farmland. Runs when at least one worker is assigned to it.",
    cost: { money: 50 },
    costGrowth: 1.15,
    produces: { wheat: 10 },
    worker: "farmer",
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
};

// --- Game state -------------------------------------------------------------

const game = {
  turn: 1,
  turnLimit: 80,
  itemCap: 200,           // per-item stockpile limit; same for every item
  money: 0,
  inventory: { wheat: 0 },
  workers: { farmer: 0 }, // hired (owned) pool per worker type
  buildings: [],          // instances: { uid, type, assigned:{worker:n}, player:bool }
  nextBuildingUid: 1,
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

// --- Production -------------------------------------------------------------
// One place to define how a building turns workers into output. For now a
// building runs at its base output when it has at least one worker; extra
// workers don't add yet. When plots should scale with multiple farmers, change
// only this function (e.g. multiply by worker count, or cap at a capacity).
function instanceOutput(inst) {
  const def = BUILDINGS[inst.type];
  const running = instanceWorkerCount(inst) >= 1 ? 1 : 0;
  const out = {};
  for (const [res, amt] of Object.entries(def.produces || {})) out[res] = amt * running;
  return out;
}

// Total per-turn production across every owned building, keyed by item.
function production() {
  const out = {};
  for (const inst of game.buildings) {
    for (const [res, amt] of Object.entries(instanceOutput(inst))) {
      out[res] = (out[res] || 0) + amt;
    }
  }
  return out;
}

// --- Actions ----------------------------------------------------------------

function passTurn() {
  if (game.turn >= game.turnLimit) return;
  game.turn += 1;
  const prod = production();
  for (const [res, amt] of Object.entries(prod)) {
    game.inventory[res] = Math.min(game.itemCap, (game.inventory[res] || 0) + amt);
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
  if (delta > 0 && idleWorkers(workerType) <= 0) return; // none free
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
  wheatPerTurnEl.textContent = prod.wheat || 0;
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
    const running = instanceWorkerCount(inst) >= 1;
    const out = instanceOutput(inst);
    const outLabel = Object.entries(out)
      .map(([res, amt]) => `+${amt} ${ITEMS[res].name.toLowerCase()}`)
      .join(", ");

    const card = document.createElement("div");
    card.className = "card" + (inst.player ? " here" : "");
    card.innerHTML = `
      <div class="card-head">
        <span class="card-name">${def.name} #${instanceNumber(inst)}</span>
        <span class="card-owned">${running ? outLabel + "/turn" : "Idle — needs a worker"}</span>
      </div>
      <div class="assign-line">
        <span class="row-label">${wDef.name}s:</span>
        <button class="mini-btn w-minus" ${assigned <= 0 ? "disabled" : ""}>&minus;</button>
        <span class="badge">${assigned}</span>
        <button class="mini-btn w-plus" ${idleWorkers(wType) <= 0 ? "disabled" : ""}>+</button>
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
  ITEMS, BUILDINGS, WORKERS,
  passTurn, buyBuilding, hireWorker, assignWorker, setPlayerAt, sell,
  addBuilding, increaseTurnLimit, production, idleWorkers,
};

render();
