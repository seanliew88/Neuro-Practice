const games = {
  shapeshift: { name: "ShapeShift", modes: { symbol: "Symbol Switch", arrow: "Arrow + Arithmetic" } },
  tower: { name: "Tower", modes: { tower: "Tower" } },
  numberbox: { name: "Number Box", modes: { classic: "Classic" } },
  grillmaster: { name: "Grill Master", modes: { classic: "Classic" } },
  balloon: { name: "Balloon", modes: { classic: "Classic" } },
  figureitout: { name: "Figure It Out", modes: { classic: "Classic" } },
};
const elements = {
  accountName: document.querySelector("#account-name"),
  game: document.querySelector("#game-select"),
  mode: document.querySelector("#mode-select"),
  date: document.querySelector("#ranking-date"),
  title: document.querySelector("#ranking-title"),
  playerCount: document.querySelector("#player-count"),
  podium: document.querySelector("#podium"),
  yourRank: document.querySelector("#your-rank"),
  yourPosition: document.querySelector("#your-position"),
  yourResult: document.querySelector("#your-result"),
  body: document.querySelector("#ranking-body"),
  status: document.querySelector("#ranking-status"),
};
let requestVersion = 0;

// Add game options and preserve a valid game from the page URL.
function initializeSelectors() {
  const requestedGame = new URLSearchParams(window.location.search).get("game");
  elements.game.innerHTML = Object.entries(games).map(([value, game]) => `<option value="${value}">${game.name}</option>`).join("");
  elements.game.value = games[requestedGame] ? requestedGame : "shapeshift";
  updateModes();
  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  if (games[elements.game.value].modes[requestedMode]) elements.mode.value = requestedMode;
}

// Refresh mode choices when the selected game changes.
function updateModes() {
  const modes = games[elements.game.value].modes;
  elements.mode.innerHTML = Object.entries(modes).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
}

// Build one table cell without treating display names as HTML.
function cell(value) {
  const item = document.createElement("td");
  item.textContent = value;
  return item;
}

// Render the top three as distinct leaderboard cards.
function renderPodium(rankings) {
  elements.podium.replaceChildren();
  for (let position = 1; position <= 3; position += 1) {
    const ranking = rankings.find((entry) => entry.position === position);
    const card = document.createElement("article");
    card.className = ranking ? "podium-card" : "podium-empty";
    if (!ranking) {
      card.textContent = `#${position} waiting`;
    } else {
      const place = document.createElement("span");
      const name = document.createElement("strong");
      const score = document.createElement("small");
      place.textContent = `#${position}`;
      name.textContent = ranking.displayName;
      score.textContent = `${ranking.scorePerMinute.toFixed(1)} score / min · ${ranking.accuracy.toFixed(1)}%`;
      card.append(place, name, score);
    }
    elements.podium.append(card);
  }
}

// Render the top fifty and highlight the signed-in account.
function renderTable(rankings) {
  elements.body.replaceChildren();
  const leaders = rankings.filter((ranking) => ranking.position <= 50);
  if (!leaders.length) {
    const row = document.createElement("tr");
    const empty = cell("No completed sessions in this mode today.");
    empty.colSpan = 5;
    empty.className = "empty-row";
    row.append(empty);
    elements.body.append(row);
    return;
  }
  for (const ranking of leaders) {
    const row = document.createElement("tr");
    if (ranking.isCurrentUser) row.className = "current";
    row.append(
      cell(`#${ranking.position}`),
      cell(ranking.displayName),
      cell(ranking.scorePerMinute.toFixed(1)),
      cell(`${ranking.accuracy.toFixed(1)}%`),
      cell(String(ranking.score)),
    );
    elements.body.append(row);
  }
}

// Load the selected mode's current UTC-day leaderboard.
async function loadRankings() {
  const version = ++requestVersion;
  const gameKey = elements.game.value;
  const modeKey = elements.mode.value;
  const game = games[gameKey];
  elements.title.textContent = `${game.name} · ${game.modes[modeKey]}`;
  elements.status.textContent = "Loading today's results.";
  elements.yourRank.hidden = true;
  const query = new URLSearchParams({ game: gameKey, mode: modeKey });
  window.history.replaceState(null, "", `/rankings/?${query}`);
  try {
    const response = await window.neuroRequest(`/api/rankings?${query}`);
    const result = await response.json();
    if (version !== requestVersion) return;
    if (!response.ok) throw new Error(result.error || "Rankings are unavailable.");
    const displayDate = new Date(`${result.date}T12:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    elements.date.textContent = `${displayDate} · UTC`;
    elements.playerCount.textContent = `${result.playerCount} ranked player${result.playerCount === 1 ? "" : "s"}`;
    renderPodium(result.rankings);
    renderTable(result.rankings);
    const current = result.rankings.find((ranking) => ranking.isCurrentUser);
    if (current) {
      elements.yourRank.hidden = false;
      elements.yourPosition.textContent = `#${current.position}`;
      elements.yourResult.textContent = `${current.scorePerMinute.toFixed(1)} score / min · ${current.accuracy.toFixed(1)}% accuracy`;
    }
    elements.status.textContent = result.playerCount ? "Only each player's best result today is ranked." : "Complete a session to set the first result.";
  } catch (error) {
    if (version !== requestVersion) return;
    elements.podium.replaceChildren();
    elements.body.replaceChildren();
    elements.playerCount.textContent = "Unavailable";
    elements.status.textContent = error.message;
  }
}

elements.game.addEventListener("change", () => { updateModes(); loadRankings(); });
elements.mode.addEventListener("change", loadRankings);
initializeSelectors();
window.neuroAuthState.then((state) => {
  elements.accountName.textContent = state.user.displayName;
});
loadRankings();
