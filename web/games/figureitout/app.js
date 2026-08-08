const propertyValues = {
  shape: ["circle", "square", "triangle", "diamond"],
  color: ["red", "blue", "yellow", "green"],
  pattern: ["solid", "stripes", "dots", "grid"],
  size: ["small", "medium", "large"],
  border: ["none", "thin", "thick"],
};
const propertyNames = Object.keys(propertyValues);

const state = {
  active: false,
  roundEnded: false,
  durationSeconds: 60,
  startedAt: null,
  startedAtIso: null,
  timerId: null,
  target: null,
  guess: null,
  activeProperties: ["shape", "color"],
  roundNumber: 0,
  roundGuesses: 0,
  guessLog: [],
  solvedRounds: 0,
  failedRounds: 0,
  skippedRounds: 0,
  totalGuesses: 0,
  perfectRounds: 0,
  bestRoundGuesses: 0,
  totalCorrectProperties: 0,
  totalPropertiesTested: 0,
  highestFeatureCount: 2,
  history: [],
};

const elements = {
  home: document.querySelector("#home-screen"),
  game: document.querySelector("#game-screen"),
  historyScreen: document.querySelector("#history-screen"),
  durations: [...document.querySelectorAll(".duration")],
  start: document.querySelector("#start-button"),
  timer: document.querySelector("#timer"),
  roundCount: document.querySelector("#round-count"),
  hiddenCard: document.querySelector("#hidden-card"),
  hiddenFigure: document.querySelector("#hidden-figure"),
  hiddenDescription: document.querySelector("#hidden-description"),
  guessFigure: document.querySelector("#guess-figure"),
  attemptCounter: document.querySelector("#attempt-counter"),
  featureProgress: document.querySelector("#feature-progress"),
  featureRows: [...document.querySelectorAll("[data-feature]")],
  propertyButtons: [...document.querySelectorAll("[data-property]")],
  feedback: document.querySelector("#feedback"),
  submit: document.querySelector("#submit-button"),
  skip: document.querySelector("#skip-button"),
  next: document.querySelector("#next-button"),
  quit: document.querySelector("#quit-button"),
  guessLog: document.querySelector("#guess-log"),
  logStatus: document.querySelector("#log-status"),
  solved: document.querySelector("#solved"),
  totalGuesses: document.querySelector("#total-guesses"),
  propertyMatch: document.querySelector("#property-match"),
  bestSolve: document.querySelector("#best-solve"),
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

// Format seconds as the countdown clock shown during a session.
function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

// Build a random five-property target figure.
function createTarget() {
  return Object.fromEntries(propertyNames.map((property) => [property, pick(propertyValues[property])]));
}

// Return the consistent starting selection for a new round.
function defaultGuess() {
  return { shape: "circle", color: "red", pattern: "solid", size: "medium", border: "none" };
}

// Return the feature count for the current quarter of the session.
function currentFeatureCount() {
  if (!state.startedAt) return 2;
  const elapsed = (performance.now() - state.startedAt) / 1000;
  const progress = Math.min(1, Math.max(0, elapsed / state.durationSeconds));
  return Math.min(propertyNames.length, 2 + Math.floor(progress * 4));
}

// Render only active properties while keeping inactive visual defaults neutral.
function renderFigure(container, figure, properties = propertyNames) {
  const visibleFigure = defaultGuess();
  properties.forEach((property) => { visibleFigure[property] = figure[property]; });
  container.innerHTML = `<div class="figure-object shape-${visibleFigure.shape} color-${visibleFigure.color} pattern-${visibleFigure.pattern} size-${visibleFigure.size} border-${visibleFigure.border}" role="img" aria-label="${describeFigure(figure, properties)}"></div>`;
}

// Convert active properties into a readable compact description.
function describeFigure(figure, properties = propertyNames) {
  return properties.map((property) => `${property === "color" ? "colour" : property}: ${figure[property]}`).join(" · ");
}

// Replace feedback text and its positive or negative state colour.
function setFeedback(message, kind = "") {
  elements.feedback.textContent = message;
  elements.feedback.className = `feedback${kind ? ` ${kind}` : ""}`;
}

// Synchronize selected controls and the player's live figure preview.
function renderGuess() {
  elements.propertyButtons.forEach((button) => {
    const selected = state.guess[button.dataset.property] === button.dataset.value;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  renderFigure(elements.guessFigure, state.guess, state.activeProperties);
}

// Refresh solved, guess-count, property-match, and best-solve metrics.
function updateMetrics() {
  const propertyAccuracy = state.totalPropertiesTested ? state.totalCorrectProperties / state.totalPropertiesTested * 100 : 0;
  elements.solved.textContent = state.solvedRounds;
  elements.totalGuesses.textContent = state.totalGuesses;
  elements.propertyMatch.textContent = state.totalGuesses ? `${propertyAccuracy.toFixed(1)}%` : "--";
  elements.bestSolve.textContent = state.bestRoundGuesses ? `${state.bestRoundGuesses} guess${state.bestRoundGuesses === 1 ? "" : "es"}` : "--";
}

// Draw prior combinations and aggregate feedback for the current card.
function renderGuessLog() {
  elements.guessLog.innerHTML = state.guessLog.map((entry, index) => `<div class="guess-entry"><strong>#${index + 1}</strong><span>${describeFigure(entry.guess, entry.properties)}</span><em>${entry.matches} right · ${entry.properties.length - entry.matches} missed</em></div>`).join("");
  elements.logStatus.textContent = state.guessLog.length ? `${state.guessLog.length} guess${state.guessLog.length === 1 ? "" : "es"} used` : "No guesses yet";
}

// Enable or disable all figure-property controls together.
function setControlsDisabled(disabled) {
  elements.propertyButtons.forEach((button) => { button.disabled = disabled; });
  elements.submit.disabled = disabled;
  elements.skip.disabled = disabled;
}

// Begin another face-down card while retaining session totals.
function startRound() {
  if (!state.active) return;
  state.roundEnded = false;
  state.target = createTarget();
  state.guess = defaultGuess();
  state.activeProperties = propertyNames.slice(0, currentFeatureCount());
  state.highestFeatureCount = Math.max(state.highestFeatureCount, state.activeProperties.length);
  state.roundNumber += 1;
  state.roundGuesses = 0;
  state.guessLog = [];
  elements.roundCount.textContent = `Round ${state.roundNumber}`;
  elements.attemptCounter.textContent = `Guess 1 · ${state.activeProperties.length} active properties`;
  elements.featureProgress.textContent = `${state.activeProperties.length} properties active: ${state.activeProperties.map((property) => property === "color" ? "colour" : property).join(", ")}`;
  elements.featureRows.forEach((row) => { row.hidden = !state.activeProperties.includes(row.dataset.feature); });
  elements.hiddenCard.classList.remove("flipped");
  elements.hiddenFigure.innerHTML = "";
  elements.hiddenDescription.textContent = "";
  elements.submit.hidden = false;
  elements.skip.hidden = false;
  elements.next.hidden = true;
  setControlsDisabled(false);
  setFeedback(`Match the ${state.activeProperties.length} active properties. Guess as many times as needed or skip this figure.`);
  renderGuess();
  renderGuessLog();
}

// Reveal the hidden card and close the current round with its outcome.
function endRound(outcome, sessionEnding = false) {
  if (state.roundEnded) return;
  state.roundEnded = true;
  if (outcome === "solved") {
    state.solvedRounds += 1;
    if (state.roundGuesses === 1) state.perfectRounds += 1;
    state.bestRoundGuesses = state.bestRoundGuesses ? Math.min(state.bestRoundGuesses, state.roundGuesses) : state.roundGuesses;
    setFeedback(`Exact match in ${state.roundGuesses} guess${state.roundGuesses === 1 ? "" : "es"}.`, "good");
  } else if (outcome === "skipped") {
    state.skippedRounds += 1;
    setFeedback("Figure skipped. Review the active properties before moving on.", "bad");
  } else {
    state.failedRounds += 1;
    setFeedback("Time expired. The hidden figure is revealed.", "bad");
  }
  renderFigure(elements.hiddenFigure, state.target, state.activeProperties);
  elements.hiddenDescription.textContent = describeFigure(state.target, state.activeProperties);
  elements.hiddenCard.classList.add("flipped");
  elements.submit.hidden = true;
  elements.skip.hidden = true;
  elements.next.hidden = sessionEnding;
  setControlsDisabled(true);
  updateMetrics();
}

// Compare one guess and return only aggregate right and missed counts.
function submitGuess() {
  if (!state.active || state.roundEnded) return;
  const matches = state.activeProperties.filter((property) => state.guess[property] === state.target[property]).length;
  state.roundGuesses += 1;
  state.totalGuesses += 1;
  state.totalCorrectProperties += matches;
  state.totalPropertiesTested += state.activeProperties.length;
  state.guessLog.push({ guess: { ...state.guess }, matches, properties: [...state.activeProperties] });
  renderGuessLog();
  updateMetrics();
  if (matches === state.activeProperties.length) {
    endRound("solved");
    return;
  }
  const missed = state.activeProperties.length - matches;
  elements.attemptCounter.textContent = `Guess ${state.roundGuesses + 1} · ${state.activeProperties.length} active properties`;
  setFeedback(`${matches} ${matches === 1 ? "property" : "properties"} correct · ${missed} missed. Adjust and try again.`);
}

// Reveal and leave the current figure without counting it as a failed solve.
function skipRound() {
  if (!state.active || state.roundEnded) return;
  endRound("skipped");
}

// Update the timer against wall-clock time and finish at zero.
function updateTimer() {
  if (!state.active) return;
  const remaining = state.durationSeconds - (performance.now() - state.startedAt) / 1000;
  elements.timer.textContent = formatTime(remaining);
  if (remaining <= 0) finishSession();
}

// Start a clean timed deduction session.
function startSession() {
  state.active = true;
  state.startedAt = performance.now();
  state.startedAtIso = new Date().toISOString();
  state.roundNumber = 0;
  state.solvedRounds = 0;
  state.failedRounds = 0;
  state.skippedRounds = 0;
  state.totalGuesses = 0;
  state.perfectRounds = 0;
  state.bestRoundGuesses = 0;
  state.totalCorrectProperties = 0;
  state.totalPropertiesTested = 0;
  state.highestFeatureCount = 2;
  elements.home.hidden = true;
  elements.historyScreen.hidden = true;
  elements.game.hidden = false;
  elements.summary.hidden = true;
  elements.endActions.hidden = true;
  elements.historyButton.hidden = true;
  elements.quit.hidden = false;
  updateMetrics();
  startRound();
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 200);
}

// Render key-value data for a completed session or selected history item.
function renderDetails(container, details) {
  container.innerHTML = Object.entries(details).map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
}

// Build the shared Figure It Out detail set from one saved performance.
function performanceDetails(performance) {
  const details = performance.details || {};
  const testedProperties = details.totalPropertiesTested || ((details.totalGuesses || 0) * propertyNames.length);
  const propertyAccuracy = testedProperties ? (details.totalCorrectProperties || 0) / testedProperties * 100 : 0;
  const averageGuesses = performance.correct ? (details.totalGuesses || 0) / performance.correct : 0;
  return {
    Solved: performance.correct,
    "Failed rounds": details.failedRounds || 0,
    Skipped: details.skippedRounds || 0,
    "Solve rate": `${performance.accuracy.toFixed(1)}%`,
    "Total guesses": details.totalGuesses || 0,
    "Property match": `${propertyAccuracy.toFixed(1)}%`,
    "Perfect rounds": details.perfectRounds || 0,
    "Highest difficulty": `${details.highestFeatureCount || propertyNames.length} properties`,
    "Best solve": details.bestRoundGuesses ? `${details.bestRoundGuesses} guess${details.bestRoundGuesses === 1 ? "" : "es"}` : "--",
    "Guesses per solve": averageGuesses ? averageGuesses.toFixed(1) : "--",
    Duration: `${performance.durationSeconds / 60} min`,
  };
}

// Save a completed session and show its detailed deduction result.
async function finishSession() {
  if (!state.active) return;
  if (!state.roundEnded) endRound("timeout", true);
  state.active = false;
  window.clearInterval(state.timerId);
  elements.timer.textContent = "00:00";
  elements.next.hidden = true;
  elements.quit.hidden = true;
  elements.endActions.hidden = false;
  setControlsDisabled(true);

  try {
    const response = await fetch("/api/performances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "figureitout",
        mode: "classic",
        durationSeconds: state.durationSeconds,
        correct: state.solvedRounds,
        total: state.solvedRounds + state.failedRounds + state.skippedRounds,
        details: {
          totalGuesses: state.totalGuesses,
          failedRounds: state.failedRounds,
          skippedRounds: state.skippedRounds,
          perfectRounds: state.perfectRounds,
          bestRoundGuesses: state.bestRoundGuesses,
          totalCorrectProperties: state.totalCorrectProperties,
          totalPropertiesTested: state.totalPropertiesTested,
          highestFeatureCount: state.highestFeatureCount,
        },
        startedAt: state.startedAtIso,
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
    setFeedback(`History was not saved: ${error.message} Restart the Python server and play the session again.`, "bad");
  }
}

// Exit an unfinished session without writing it to local history.
function quitSession() {
  if (!state.active) return;
  state.active = false;
  window.clearInterval(state.timerId);
  showHome();
}

// Show the separate history tracker outside active play.
function showHistory() {
  if (state.active) return;
  elements.home.hidden = true;
  elements.game.hidden = true;
  elements.historyScreen.hidden = false;
}

// Return to setup and restore tracker access when saved sessions exist.
function showHome() {
  elements.game.hidden = true;
  elements.historyScreen.hidden = true;
  elements.home.hidden = false;
  elements.historyButton.hidden = state.history.length === 0;
}

// Load only Figure It Out records and render selectable tracker rows.
async function loadHistory() {
  try {
    const response = await fetch("/api/performances?game=figureitout");
    if (!response.ok) throw new Error("History unavailable");
    const { performances } = await response.json();
    state.history = performances;
    elements.historyBody.innerHTML = performances.length ? performances.map((performance) => {
      const details = performance.details || {};
      const date = new Date(performance.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      return `<tr><td>${date}</td><td>${performance.correct}</td><td>${performance.total}</td><td>${details.totalGuesses || 0}</td><td><button class="detail-button" data-id="${performance.id}" type="button">Details</button></td></tr>`;
    }).join("") : '<tr><td class="empty-row" colspan="5">No completed Figure It Out sessions yet.</td></tr>';
    elements.historyStatus.textContent = `${performances.length} completed Figure It Out session${performances.length === 1 ? "" : "s"}.`;
  } catch (error) {
    elements.historyStatus.textContent = "Figure It Out history is unavailable. Restart the Python server.";
  }
}

// Display the full metrics for one selected Figure It Out history entry.
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
elements.propertyButtons.forEach((button) => button.addEventListener("click", () => {
  if (!state.active || state.roundEnded) return;
  state.guess[button.dataset.property] = button.dataset.value;
  renderGuess();
}));
elements.start.addEventListener("click", startSession);
elements.playAgain.addEventListener("click", startSession);
elements.returnHome.addEventListener("click", showHome);
elements.backToHome.addEventListener("click", showHome);
elements.historyButton.addEventListener("click", showHistory);
elements.submit.addEventListener("click", submitGuess);
elements.skip.addEventListener("click", skipRound);
elements.next.addEventListener("click", startRound);
elements.quit.addEventListener("click", quitSession);
elements.historyBody.addEventListener("click", (event) => { const button = event.target.closest("[data-id]"); if (button) showHistoryDetail(button.dataset.id); });

elements.timer.textContent = formatTime(state.durationSeconds);
loadHistory().then(() => { elements.historyButton.hidden = state.history.length === 0; });
