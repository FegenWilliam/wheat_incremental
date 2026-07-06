// Wheat Incremental — core gameplay
// Data-driven so new items and buildings are just entries in the registries below.

// --- Static definitions -----------------------------------------------------

// Every stockpiled resource. Shares one cap (game.itemCap). More get added here.
const ITEMS = {
  wheat: { name: "Wheat" },
};

// Buildings the player can buy. `produces` is added to inventory each turn.
// Cost scales with how many you already own: ceil(base * costGrowth^owned).
const BUILDINGS = {
  plot: {
    name: "Plot",
    desc: "Grows wheat. Produces 10 wheat per turn.",
    cost: { wheat: 50 },
    costGrowth: 1.15,
    produces: { wheat: 10 },
  },
};

// --- Game state -------------------------------------------------------------

const game = {
  turn: 1,
  turnLimit: 80,
  itemCap: 200, // per-item stockpile limit; same for every item
  inventory: { wheat: 0 },
  buildings: { plot: 1 }, // player starts owning 1 Plot
};

// --- Derived values ---------------------------------------------------------

// Total per-turn production across all buildings, keyed by item.
function production() {
  const out = {};
  for (const [id, count] of Object.entries(game.buildings)) {
    const produces = BUILDINGS[id].produces || {};
    for (const [item, amt] of Object.entries(produces)) {
      out[item] = (out[item] || 0) + amt * count;
    }
  }
  return out;
}

// Cost to buy the next copy of a building, given how many are owned.
function nextCost(id) {
  const def = BUILDINGS[id];
  const owned = game.buildings[id] || 0;
  const scale = Math.pow(def.costGrowth ?? 1, owned);
  const out = {};
  for (const [item, amt] of Object.entries(def.cost)) {
    out[item] = Math.ceil(amt * scale);
  }
  return out;
}

function canAfford(cost) {
  return Object.entries(cost).every(([item, amt]) => (game.inventory[item] || 0) >= amt);
}

// --- Actions ----------------------------------------------------------------

function passTurn() {
  if (game.turn >= game.turnLimit) return;
  game.turn += 1;
  const prod = production();
  for (const [item, amt] of Object.entries(prod)) {
    game.inventory[item] = Math.min(game.itemCap, (game.inventory[item] || 0) + amt);
  }
  render();
}

function buyBuilding(id) {
  const cost = nextCost(id);
  if (!canAfford(cost)) return;
  for (const [item, amt] of Object.entries(cost)) {
    game.inventory[item] -= amt;
  }
  game.buildings[id] = (game.buildings[id] || 0) + 1;
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
const wheatPerTurnEl = document.getElementById("wheat-per-turn");
const passTurnBtn = document.getElementById("pass-turn");
const turnMessageEl = document.getElementById("turn-message");
const buildingsListEl = document.getElementById("buildings-list");
const inventoryListEl = document.getElementById("inventory-list");

// --- Rendering --------------------------------------------------------------

function costLabel(cost) {
  return Object.entries(cost)
    .map(([item, amt]) => `${amt} ${ITEMS[item].name.toLowerCase()}`)
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
  wheatPerTurnEl.textContent = prod.wheat || 0;
  wheatStatEl.classList.toggle("full", atCap);

  const atTurnLimit = game.turn >= game.turnLimit;
  passTurnBtn.disabled = atTurnLimit;

  let msg = "";
  if (atTurnLimit) msg = "Turn limit reached.";
  else if (atCap) msg = "Wheat storage full — pass a turn to waste the overflow.";
  turnMessageEl.textContent = msg;
}

function renderBuildings() {
  buildingsListEl.innerHTML = "";
  for (const [id, def] of Object.entries(BUILDINGS)) {
    const owned = game.buildings[id] || 0;
    const cost = nextCost(id);
    const affordable = canAfford(cost);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <span class="card-name">${def.name}</span>
        <span class="card-owned">Owned: ${owned}</span>
      </div>
      <p class="card-desc">${def.desc}</p>
      <button class="buy-btn" ${affordable ? "" : "disabled"}>
        Buy — ${costLabel(cost)}
      </button>
    `;
    card.querySelector(".buy-btn").addEventListener("click", () => buyBuilding(id));
    buildingsListEl.appendChild(card);
  }
}

function renderInventory() {
  inventoryListEl.innerHTML = "";
  for (const [id, def] of Object.entries(ITEMS)) {
    const amount = game.inventory[id] || 0;
    const pct = Math.min(100, (amount / game.itemCap) * 100);
    const atCap = amount >= game.itemCap;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <span class="card-name">${def.name}</span>
        <span class="inv-amount ${atCap ? "full" : ""}">${amount} / ${game.itemCap}</span>
      </div>
      <div class="bar"><div class="bar-fill ${atCap ? "full" : ""}" style="width:${pct}%"></div></div>
    `;
    inventoryListEl.appendChild(card);
  }
}

function render() {
  renderStats();
  renderBuildings();
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
window.wheatGame = { state: game, ITEMS, BUILDINGS, passTurn, buyBuilding, increaseTurnLimit, production };

render();
