const MAX_GRILL_LOAD = 12;
const cuts = [
  { name: "Steak", className: "steak" },
  { name: "Chicken", className: "chicken" },
  { name: "Burger", className: "burger" },
  { name: "Sausage", className: "sausage" },
];

const state = {
  active: false,
  durationSeconds: 60,
  startedAt: null,
  timerId: null,
  frameId: null,
  nextSpawnAt: 0,
  nextMeatId: 0,
  meats: [],
  correct: 0,
  total: 0,
  score: 0,
  rawPulled: 0,
  charred: 0,
  streak: 0,
  bestStreak: 0,
  peakGrillLoad: 0,
  totalCookMilliseconds: 0,
  fastestCookMilliseconds: 0,
  history: [],
};

const elements = {
  home: document.querySelector("#home-screen"),
  game: document.querySelector("#game-screen"),
  historyScreen: document.querySelector("#history-screen"),
  durations: [...document.querySelectorAll(".duration")],
  start: document.querySelector("#start-button"),
  timer: document.querySelector("#timer"),
  sessionScore: document.querySelector("#session-score"),
  grill: document.querySelector("#grill"),
  grillMessage: document.querySelector("#grill-message"),
  grillLoad: document.querySelector("#grill-load"),
  quit: document.querySelector("#quit-button"),
  cooked: document.querySelector("#cooked"),
  mistakes: document.querySelector("#mistakes"),
  accuracy: document.querySelector("#accuracy"),
  streak: document.querySelector("#streak"),
  summary: document.querySelector("#round-summary"),
  summaryDetails: document.querySelector("#summary-details"),
  endActions: document.querySelector("#end-actions"),
  playAgain: document.querySelector("#play-again"),
  returnHome: document.querySelector("#return-home"),
  historyButton: document.querySelector("#history-button"),
  backToHome: document.querySelector("#back-to-home"),
  historyStatus: document.querySelector("#history-status"),
  historyBody: document.querySelector("#history-body"),
  historyDetail: document.querySelector("#history-detail"),
  historyDetailList: document.querySelector("#history-detail-list"),
};

// Pick one item uniformly from a non-empty array.
function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

// Format seconds as the countdown clock shown during a shift.
function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

// Format stored millisecond timings for summaries and history details.
function formatMilliseconds(milliseconds) {
  return milliseconds ? `${(milliseconds / 1000).toFixed(1)} sec` : "--";
}

// Refresh all live score and grill-load indicators.
function updateMetrics() {
  const mistakes = state.total - state.correct;
  const accuracy = state.total ? state.correct / state.total * 100 : 0;
  elements.sessionScore.textContent = `Score ${state.score}`;
  elements.cooked.textContent = state.correct;
  elements.mistakes.textContent = mistakes;
  elements.accuracy.textContent = state.total ? `${accuracy.toFixed(1)}%` : "--";
  elements.streak.textContent = state.streak;
  elements.grillLoad.textContent = `${state.meats.length} on grill`;
}

// Create the interactive card and cached progress elements for one cut.
function createMeatElement(meat) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `meat-card cut-${meat.cut.className} raw`;
  button.dataset.meatId = String(meat.id);
  button.setAttribute("aria-label", `${meat.cut.name}, raw`);
  button.innerHTML = `<span class="cut-name">${meat.cut.name}</span><span class="meat-visual"><span class="sear-marks"></span></span><span class="progress-track"><span class="progress-fill"></span></span><span class="doneness-label">Raw</span>`;
  meat.element = button;
  meat.progressElement = button.querySelector(".progress-fill");
  meat.labelElement = button.querySelector(".doneness-label");
  return button;
}

// Add one independently timed piece of meat unless the grill is full.
function spawnMeat(now) {
  if (!state.active || state.meats.length >= MAX_GRILL_LOAD) return;
  const meat = {
    id: state.nextMeatId++,
    cut: pick(cuts),
    addedAt: now,
    cookDuration: 6800 + Math.random() * 3600,
    status: "raw",
    element: null,
    progressElement: null,
    labelElement: null,
  };
  state.meats.push(meat);
  state.peakGrillLoad = Math.max(state.peakGrillLoad, state.meats.length);
  elements.grill.appendChild(createMeatElement(meat));
  updateMetrics();
}

// Update one card's progress, colour, label, and accessible state.
function updateMeat(meat, now) {
  const progress = (now - meat.addedAt) / meat.cookDuration;
  const nextStatus = progress >= 1 ? "burnt" : progress >= .68 ? "cooked" : "raw";
  meat.progressElement.style.width = `${Math.min(progress, 1) * 100}%`;
  if (nextStatus !== meat.status) {
    meat.status = nextStatus;
    meat.element.classList.remove("raw", "cooked", "burnt");
    meat.element.classList.add(nextStatus);
    meat.labelElement.textContent = nextStatus === "cooked" ? "Pull now" : nextStatus;
    meat.element.setAttribute("aria-label", `${meat.cut.name}, ${nextStatus === "cooked" ? "cooked, pull now" : nextStatus}`);
  }
  if (progress >= 1.13) resolveMeat(meat, "charred", now);
}

// Remove one resolved card with a short pull-off animation.
function removeMeatCard(meat) {
  meat.element.classList.add("leaving");
  window.setTimeout(() => meat.element.remove(), 240);
}

// Score a cooked pull, early pull, or charred miss exactly once.
function resolveMeat(meat, outcome, now = performance.now()) {
  const index = state.meats.findIndex((candidate) => candidate.id === meat.id);
  if (index < 0) return;
  state.meats.splice(index, 1);
  state.total += 1;
  if (outcome === "cooked") {
    const cookTime = now - meat.addedAt;
    state.correct += 1;
    state.score += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.totalCookMilliseconds += cookTime;
    state.fastestCookMilliseconds = state.fastestCookMilliseconds ? Math.min(state.fastestCookMilliseconds, cookTime) : cookTime;
    elements.grillMessage.textContent = `${meat.cut.name} pulled at peak doneness. +1`;
  } else {
    state.score -= 1;
    state.streak = 0;
    if (outcome === "raw") {
      state.rawPulled += 1;
      elements.grillMessage.textContent = `${meat.cut.name} was still raw. −1`;
    } else {
      state.charred += 1;
      elements.grillMessage.textContent = `${meat.cut.name} charred. −1`;
    }
  }
  removeMeatCard(meat);
  updateMetrics();
}

// Resolve a player's tap according to the piece's current doneness.
function pullMeat(meatId) {
  if (!state.active) return;
  const meat = state.meats.find((candidate) => candidate.id === meatId);
  if (!meat) return;
  resolveMeat(meat, meat.status === "cooked" ? "cooked" : meat.status === "burnt" ? "charred" : "raw");
}

// Shorten spawn intervals continuously as the shift progresses.
function scheduleNextSpawn(now) {
  const elapsed = now - state.startedAt;
  const shiftProgress = Math.min(elapsed / (state.durationSeconds * 1000), 1);
  const baseInterval = 2800 - 2100 * shiftProgress;
  state.nextSpawnAt = now + baseInterval * (.8 + Math.random() * .4);
}

// Drive independent cook bars and accelerating arrivals every animation frame.
function runGrill(now) {
  if (!state.active) return;
  if (now >= state.nextSpawnAt) {
    spawnMeat(now);
    scheduleNextSpawn(now);
  }
  [...state.meats].forEach((meat) => updateMeat(meat, now));
  state.frameId = window.requestAnimationFrame(runGrill);
}

// Update the shift timer against wall-clock time and finish at zero.
function updateTimer() {
  if (!state.active) return;
  const remaining = state.durationSeconds - (performance.now() - state.startedAt) / 1000;
  elements.timer.textContent = formatTime(remaining);
  if (remaining <= 0) finishSession();
}

// Start a clean shift and place two initial cuts on the grill.
function startSession() {
  state.active = true;
  state.startedAt = performance.now();
  state.nextMeatId = 0;
  state.meats = [];
  state.correct = 0;
  state.total = 0;
  state.score = 0;
  state.rawPulled = 0;
  state.charred = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.peakGrillLoad = 0;
  state.totalCookMilliseconds = 0;
  state.fastestCookMilliseconds = 0;
  elements.grill.innerHTML = "";
  elements.grillMessage.textContent = "Watch every progress bar.";
  elements.home.hidden = true;
  elements.historyScreen.hidden = true;
  elements.game.hidden = false;
  elements.summary.hidden = true;
  elements.endActions.hidden = true;
  elements.historyButton.hidden = true;
  elements.quit.hidden = false;
  updateMetrics();
  spawnMeat(state.startedAt);
  spawnMeat(state.startedAt);
  scheduleNextSpawn(state.startedAt);
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 200);
  state.frameId = window.requestAnimationFrame(runGrill);
}

// Render key-value data for a completed shift or selected history item.
function renderDetails(container, details) {
  container.innerHTML = Object.entries(details).map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
}

// Build the shared Grill Master detail set from one saved performance.
function performanceDetails(performance) {
  const details = performance.details || {};
  const average = performance.correct ? (details.totalCookMilliseconds || 0) / performance.correct : 0;
  return {
    Cooked: performance.correct,
    Resolved: performance.total,
    Accuracy: `${performance.accuracy.toFixed(1)}%`,
    Score: performance.score,
    "Pulled raw": details.rawPulled || 0,
    Charred: details.charred || 0,
    "Best streak": details.bestStreak || 0,
    "Peak grill load": details.peakGrillLoad || 0,
    "Average pull": formatMilliseconds(average),
    "Fastest pull": formatMilliseconds(details.fastestCookMilliseconds || 0),
    Duration: `${performance.durationSeconds / 60} min`,
  };
}

// Save a completed shift and show its detailed result immediately.
async function finishSession() {
  if (!state.active) return;
  state.active = false;
  window.clearInterval(state.timerId);
  window.cancelAnimationFrame(state.frameId);
  elements.timer.textContent = "00:00";
  elements.quit.hidden = true;
  elements.endActions.hidden = false;
  elements.grillMessage.textContent = `Shift complete: ${state.correct} cut${state.correct === 1 ? "" : "s"} served.`;
  elements.grill.querySelectorAll("button").forEach((button) => { button.disabled = true; });

  try {
    const response = await fetch("/api/performances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "grillmaster",
        mode: "classic",
        durationSeconds: state.durationSeconds,
        correct: state.correct,
        total: state.total,
        details: {
          rawPulled: state.rawPulled,
          charred: state.charred,
          bestStreak: state.bestStreak,
          peakGrillLoad: state.peakGrillLoad,
          totalCookMilliseconds: Math.round(state.totalCookMilliseconds),
          fastestCookMilliseconds: Math.round(state.fastestCookMilliseconds),
        },
        startedAt: new Date(Date.now() - state.durationSeconds * 1000).toISOString(),
      }),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      throw new Error(problem.error || `Server returned ${response.status}.`);
    }
    const { performance } = await response.json();
    renderDetails(elements.summaryDetails, performanceDetails(performance));
    elements.summary.hidden = false;
    elements.historyButton.hidden = false;
    await loadHistory();
  } catch (error) {
    elements.grillMessage.textContent = `History was not saved: ${error.message} Restart the Python server and play the shift again.`;
  }
}

// Exit an unfinished shift without saving it to history.
function quitSession() {
  if (!state.active) return;
  state.active = false;
  window.clearInterval(state.timerId);
  window.cancelAnimationFrame(state.frameId);
  showHome();
}

// Show the separate history tracker outside the active game screen.
function showHistory() {
  if (state.active) return;
  elements.home.hidden = true;
  elements.game.hidden = true;
  elements.historyScreen.hidden = false;
}

// Return to setup and restore tracker access when saved shifts exist.
function showHome() {
  elements.game.hidden = true;
  elements.historyScreen.hidden = true;
  elements.home.hidden = false;
  elements.historyButton.hidden = state.history.length === 0;
}

// Load only Grill Master records and render selectable tracker rows.
async function loadHistory() {
  try {
    const response = await fetch("/api/performances?game=grillmaster");
    if (!response.ok) throw new Error("History unavailable");
    const { performances } = await response.json();
    state.history = performances;
    elements.historyBody.innerHTML = performances.length ? performances.map((performance) => {
      const date = new Date(performance.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      return `<tr><td>${date}</td><td>${performance.correct}</td><td>${performance.accuracy.toFixed(1)}%</td><td>${performance.score}</td><td><button class="detail-button" data-id="${performance.id}" type="button">Details</button></td></tr>`;
    }).join("") : '<tr><td class="empty-row" colspan="5">No completed Grill Master shifts yet.</td></tr>';
    elements.historyStatus.textContent = `${performances.length} completed Grill Master shift${performances.length === 1 ? "" : "s"}.`;
  } catch (error) {
    elements.historyStatus.textContent = "Grill Master history is unavailable. Restart the Python server.";
  }
}

// Display the full metrics for one selected Grill Master history entry.
function showHistoryDetail(id) {
  const performance = state.history.find((item) => item.id === id);
  if (!performance) return;
  renderDetails(elements.historyDetailList, performanceDetails(performance));
  elements.historyDetail.hidden = false;
}

elements.durations.forEach((button) => button.addEventListener("click", () => {
  if (state.active) return;
  state.durationSeconds = Number(button.dataset.duration);
  elements.timer.textContent = formatTime(state.durationSeconds);
  elements.durations.forEach((candidate) => {
    const selected = candidate === button;
    candidate.classList.toggle("selected", selected);
    candidate.setAttribute("aria-checked", String(selected));
  });
}));
elements.start.addEventListener("click", startSession);
elements.playAgain.addEventListener("click", startSession);
elements.returnHome.addEventListener("click", showHome);
elements.backToHome.addEventListener("click", showHome);
elements.historyButton.addEventListener("click", showHistory);
elements.quit.addEventListener("click", quitSession);
elements.grill.addEventListener("click", (event) => { const button = event.target.closest("[data-meat-id]"); if (button) pullMeat(Number(button.dataset.meatId)); });
elements.historyBody.addEventListener("click", (event) => { const button = event.target.closest("[data-id]"); if (button) showHistoryDetail(button.dataset.id); });

elements.timer.textContent = formatTime(state.durationSeconds);
loadHistory().then(() => { elements.historyButton.hidden = state.history.length === 0; });
