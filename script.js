// Wheat Incremental — core turn system
// Kept deliberately small; systems (resources, upgrades, etc.) get layered on later.

const game = {
  turn: 1,
  turnLimit: 80,
};

// --- DOM refs ---
const currentTurnEl = document.getElementById("current-turn");
const turnLimitEl = document.getElementById("turn-limit");
const passTurnBtn = document.getElementById("pass-turn");
const turnMessageEl = document.getElementById("turn-message");

// --- Rendering ---
function render() {
  currentTurnEl.textContent = game.turn;
  turnLimitEl.textContent = game.turnLimit;

  const atLimit = game.turn >= game.turnLimit;
  passTurnBtn.disabled = atLimit;
  turnMessageEl.textContent = atLimit
    ? "Turn limit reached."
    : "";
}

// --- Turn system ---
function passTurn() {
  if (game.turn >= game.turnLimit) return;
  game.turn += 1;
  render();
}

// Raise (or lower) the turn limit. Later upgrades will call this.
// Returns the new limit.
function increaseTurnLimit(amount = 1) {
  game.turnLimit += amount;
  render();
  return game.turnLimit;
}

// --- Wiring ---
passTurnBtn.addEventListener("click", passTurn);

// Expose the core API so it can be driven from the console or future systems.
window.wheatGame = { state: game, passTurn, increaseTurnLimit };

render();
