// Wheat Incremental — core gameplay
// Data-driven: new items, buildings, and workers are just entries in the registries.

// --- Static definitions -----------------------------------------------------

// Stockpiled resources. Every item shares one cap (game.itemCap). Money is a
// separate currency (uncapped) handled below — it is not an item.
const ITEMS = {
  wheat: { name: "Wheat" },
};

// What each item sells for, in dollars.
const SELL_PRICES = {
  wheat: 1,
};

// Buildings the player can buy. `produces` is added to inventory each turn, per
// ACTIVE copy. A building with `needsWorker` only counts as active when a worker
// (a hired worker or the player) is assigned to it.
// Cost scales with how many you own: ceil(base * costGrowth^owned).
const BUILDINGS = {
  plot: {
    name: "Plot",
    desc: "Farmland. Each plot that is being farmed yields 10 wheat per turn.",
    cost: { money: 50 },
    costGrowth: 1.15,
    produces: { wheat: 10 },
    needsWorker: true,
  },
};

// Hireable workers. `worksOn` is the building id a worker can be assigned to.
// One worker farms one building. Hire cost scales like buildings.
const WORKERS = {
  farmer: {
    name: "Farmer",
    desc: "Works a single plot so it produces wheat.",
    cost: { money: 25 },
    costGrowth: 1.15,
    worksOn: "plot",
  },
};

// --- Game state -------------------------------------------------------------

const game = {
  turn: 1,
  turnLimit: 80,
  itemCap: 200,           // per-item stockpile limit; same for every item
  money: 0,
  inventory: { wheat: 0 },
  buildings: { plot: 1 }, // start owning 1 Plot
  workers: { farmer: 0 }, // hired (owned) workers
  assigned: { farmer: 0 },// workers currently assigned to their worksOn building
  playerJob: "plot",      // building id the player works, or "idle"
};

// --- Money / cost helpers ---------------------------------------------------

// Read a balance for either the money currency or a stockpiled item.
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

const buildingCost = (id) => scaledCost(BUILDINGS[id], game.buildings[id] || 0);
const workerCost = (id) => scaledCost(WORKERS[id], game.workers[id] || 0);

// --- Derived values ---------------------------------------------------------

// How many workers (hired + the player) are currently on a given building.
function workersOn(buildingId) {
  let n = game.playerJob === buildingId ? 1 : 0;
  for (const [wid, def] of Object.entries(WORKERS)) {
    if (def.worksOn === buildingId) n += game.assigned[wid] || 0;
  }
  return n;
}

// Copies of a building that actually produce this turn.
function activeCount(buildingId) {
  const def = BUILDINGS[buildingId];
  const owned = game.buildings[buildingId] || 0;
  if (!def.needsWorker) return owned;
  return Math.min(owned, workersOn(buildingId));
}

// Total per-turn production across all buildings, keyed by item.
function production() {
  const out = {};
  for (const [id, def] of Object.entries(BUILDINGS)) {
    const active = activeCount(id);
    for (const [res, amt] of Object.entries(def.produces || {})) {
      out[res] = (out[res] || 0) + amt * active;
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

function buyBuilding(id) {
  const cost = buildingCost(id);
  if (!canAfford(cost)) return;
  pay(cost);
  game.buildings[id] = (game.buildings[id] || 0) + 1;
  render();
}

function hireWorker(id) {
  const cost = workerCost(id);
  if (!canAfford(cost)) return;
  pay(cost);
  game.workers[id] = (game.workers[id] || 0) + 1;
  render();
}

// Assign/unassign a hired worker to its building. Clamped to [0, owned].
function assignWorker(id, delta) {
  const owned = game.workers[id] || 0;
  const cur = game.assigned[id] || 0;
  game.assigned[id] = Math.max(0, Math.min(owned, cur + delta));
  render();
}

// Put the player on a building (its id) or set them idle.
function setPlayerJob(job) {
  game.playerJob = job;
  render();
}

// Sell wheat (or any item) for dollars. `amount` is a number or "all".
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
const playerPanelEl = document.getElementById("player-panel");
const workersListEl = document.getElementById("workers-list");
const inventoryListEl = document.getElementById("inventory-list");

// --- Rendering --------------------------------------------------------------

function costLabel(cost) {
  return Object.entries(cost)
    .map(([res, amt]) => (res === "money" ? `$${amt}` : `${amt} ${ITEMS[res].name.toLowerCase()}`))
    .join(", ");
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

function renderBuildings() {
  buildingsListEl.innerHTML = "";
  for (const [id, def] of Object.entries(BUILDINGS)) {
    const owned = game.buildings[id] || 0;
    const active = activeCount(id);
    const cost = buildingCost(id);
    const affordable = canAfford(cost);

    const workedInfo = def.needsWorker ? ` · Farmed: ${active} / ${owned}` : "";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <span class="card-name">${def.name}</span>
        <span class="card-owned">Owned: ${owned}${workedInfo}</span>
      </div>
      <p class="card-desc">${def.desc}</p>
      <div class="btn-row">
        <button class="buy-btn" ${affordable ? "" : "disabled"}>Buy — ${costLabel(cost)}</button>
      </div>
    `;
    card.querySelector(".buy-btn").addEventListener("click", () => buyBuilding(id));
    buildingsListEl.appendChild(card);
  }
}

function renderPlayer() {
  playerPanelEl.innerHTML = "";
  const card = document.createElement("div");
  card.className = "card player";

  // One button per building that needs a worker, plus Idle.
  const jobs = Object.entries(BUILDINGS)
    .filter(([, def]) => def.needsWorker)
    .map(([id, def]) => ({ id, label: `Farm ${def.name}` }));
  jobs.push({ id: "idle", label: "Idle" });

  const buttons = jobs
    .map(
      (j) =>
        `<button class="mini-btn ${game.playerJob === j.id ? "active" : ""}" data-job="${j.id}">${j.label}</button>`
    )
    .join("");

  card.innerHTML = `
    <div class="card-head">
      <span class="card-name">You</span>
      <span class="card-owned">${game.playerJob === "idle" ? "Idle" : "Farming"}</span>
    </div>
    <p class="card-desc">Put yourself to work. You count as one worker wherever you're assigned.</p>
    <div class="btn-row"><span class="row-label">Assign:</span>${buttons}</div>
  `;
  card.querySelectorAll(".mini-btn").forEach((btn) =>
    btn.addEventListener("click", () => setPlayerJob(btn.dataset.job))
  );
  playerPanelEl.appendChild(card);
}

function renderWorkers() {
  workersListEl.innerHTML = "";
  for (const [id, def] of Object.entries(WORKERS)) {
    const owned = game.workers[id] || 0;
    const assigned = game.assigned[id] || 0;
    const cost = workerCost(id);
    const affordable = canAfford(cost);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <span class="card-name">${def.name}</span>
        <span class="card-owned">Owned: ${owned} · Assigned: ${assigned}</span>
      </div>
      <p class="card-desc">${def.desc}</p>
      <div class="btn-row">
        <button class="buy-btn hire" ${affordable ? "" : "disabled"}>Hire — ${costLabel(cost)}</button>
        <span class="row-label">Assign:</span>
        <button class="mini-btn unassign" ${assigned <= 0 ? "disabled" : ""}>&minus;</button>
        <button class="mini-btn assign" ${assigned >= owned ? "disabled" : ""}>+</button>
      </div>
    `;
    card.querySelector(".hire").addEventListener("click", () => hireWorker(id));
    card.querySelector(".assign").addEventListener("click", () => assignWorker(id, 1));
    card.querySelector(".unassign").addEventListener("click", () => assignWorker(id, -1));
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
  renderBuildings();
  renderPlayer();
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
  passTurn, buyBuilding, hireWorker, assignWorker, setPlayerJob, sell,
  increaseTurnLimit, production,
};

render();
