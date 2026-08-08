const phases = [
  { key: "early", name: "Early rounds", rewardCents: 5, penaltyCents: 0, minBurst: 8, maxBurst: 18, rule: "+$0.05 per pump · no burst penalty" },
  { key: "rising", name: "Rising stakes", rewardCents: 10, penaltyCents: 25, minBurst: 5, maxBurst: 15, rule: "+$0.10 per pump · −$0.25 on burst" },
  { key: "high", name: "High stakes", rewardCents: 20, penaltyCents: 75, minBurst: 3, maxBurst: 12, rule: "+$0.20 per pump · −$0.75 on burst" },
];

const balloonPalettes = [
  ["#ff9eb7", "#e4537b", "#9d284d"],
  ["#89c9e8", "#438fbd", "#22567a"],
  ["#f5c27a", "#dc8644", "#985128"],
  ["#a8dc9a", "#61a96c", "#347143"],
  ["#c7a6ed", "#8e63c7", "#59368d"],
];

const state = {
  active: false,
  locked: false,
  durationSeconds: 60,
  startedAt: null,
  startedAtIso: null,
  timerId: null,
  phase: phases[0],
  burstAt: 0,
  currentPumps: 0,
  roundCents: 0,
  balloonNumber: 0,
  grossBankedCents: 0,
  penaltyCents: 0,
  lostCents: 0,
  bankedBalloons: 0,
  poppedBalloons: 0,
  totalPumps: 0,
  bankedPumps: 0,
  maxPumpsBanked: 0,
  highestBalloonCents: 0,
  history: [],
};

const elements = {
  home: document.querySelector("#home-screen"),
  game: document.querySelector("#game-screen"),
  historyScreen: document.querySelector("#history-screen"),
  durations: [...document.querySelectorAll(".duration")],
  start: document.querySelector("#start-button"),
  timer: document.querySelector("#timer"),
  bankTotal: document.querySelector("#bank-total"),
  phaseName: document.querySelector("#phase-name"),
  phaseRule: document.querySelector("#phase-rule"),
  balloonCount: document.querySelector("#balloon-count"),
  roundValue: document.querySelector("#round-value"),
  balloonSpace: document.querySelector("#balloon-space"),
  balloon: document.querySelector("#balloon"),
  burstMark: document.querySelector("#burst-mark"),
  pumpCount: document.querySelector("#pump-count"),
  feedback: document.querySelector("#feedback"),
  pump: document.querySelector("#pump-button"),
  pumpReward: document.querySelector("#pump-reward"),
  cash: document.querySelector("#cash-button"),
  cashAmount: document.querySelector("#cash-button span"),
  quit: document.querySelector("#quit-button"),
  banked: document.querySelector("#banked"),
  bursts: document.querySelector("#bursts"),
  totalPumps: document.querySelector("#total-pumps"),
  netEarnings: document.querySelector("#net-earnings"),
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

// Format signed integer cents as a dollar amount without floating-point drift.
function formatMoney(cents) {
  const sign = cents < 0 ? "−" : "";
  const absolute = Math.abs(cents);
  return `${sign}$${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

// Format seconds as the countdown clock shown during a session.
function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

// Select the current stakes phase from elapsed session progress.
function phaseForCurrentTime() {
  const elapsed = performance.now() - state.startedAt;
  const progress = Math.min(elapsed / (state.durationSeconds * 1000), 1);
  if (progress >= .7) return phases[2];
  if (progress >= .35) return phases[1];
  return phases[0];
}

// Return a hidden integer burst point inside the current phase range.
function randomBurstPoint(phase) {
  return Math.floor(Math.random() * (phase.maxBurst - phase.minBurst + 1)) + phase.minBurst;
}

// Replace feedback text and its positive or negative state colour.
function setFeedback(message, kind = "") {
  elements.feedback.textContent = message;
  elements.feedback.className = `feedback${kind ? ` ${kind}` : ""}`;
}

// Update money, risk outcomes, and pump counters across the game screen.
function updateMetrics() {
  const netCents = state.grossBankedCents - state.penaltyCents;
  elements.bankTotal.textContent = `Bank ${formatMoney(netCents)}`;
  elements.roundValue.textContent = formatMoney(state.roundCents);
  elements.pumpCount.textContent = `${state.currentPumps} pump${state.currentPumps === 1 ? "" : "s"} on this balloon`;
  elements.cashAmount.textContent = `Bank ${formatMoney(state.roundCents)}`;
  elements.cash.disabled = state.locked || state.currentPumps === 0;
  elements.banked.textContent = state.bankedBalloons;
  elements.bursts.textContent = state.poppedBalloons;
  elements.totalPumps.textContent = state.totalPumps;
  elements.netEarnings.textContent = formatMoney(netCents);
}

// Apply a new colour palette and reset the visual balloon size.
function resetBalloonVisual() {
  const [light, color, dark] = balloonPalettes[Math.floor(Math.random() * balloonPalettes.length)];
  elements.balloon.style.setProperty("--balloon-light", light);
  elements.balloon.style.setProperty("--balloon-color", color);
  elements.balloon.style.setProperty("--balloon-dark", dark);
  elements.balloon.style.setProperty("--balloon-scale", "1");
  elements.balloon.classList.remove("popped");
  elements.balloonSpace.classList.remove("shake");
  elements.burstMark.hidden = true;
}

// Start the next balloon with phase-specific reward and hidden risk settings.
function nextBalloon() {
  if (!state.active) return;
  state.locked = false;
  state.phase = phaseForCurrentTime();
  state.burstAt = randomBurstPoint(state.phase);
  state.currentPumps = 0;
  state.roundCents = 0;
  state.balloonNumber += 1;
  elements.phaseName.textContent = state.phase.name;
  elements.phaseRule.textContent = state.phase.rule;
  elements.balloonCount.textContent = `Balloon ${state.balloonNumber}`;
  elements.pumpReward.textContent = `+${formatMoney(state.phase.rewardCents)}`;
  elements.pump.disabled = false;
  resetBalloonVisual();
  setFeedback("Pump to build value, or bank whenever you choose.");
  updateMetrics();
}

// Inflate once, add unbanked reward, and trigger a burst at the hidden limit.
function pumpBalloon() {
  if (!state.active || state.locked) return;
  state.currentPumps += 1;
  state.totalPumps += 1;
  state.roundCents += state.phase.rewardCents;
  const scale = Math.min(1 + state.currentPumps * .045, 1.68);
  elements.balloon.style.setProperty("--balloon-scale", String(scale));
  setFeedback(`${formatMoney(state.roundCents)} is at risk on this balloon.`);
  updateMetrics();
  if (state.currentPumps >= state.burstAt) burstBalloon();
}

// Lose current earnings, apply the current phase penalty, and animate the burst.
function burstBalloon() {
  if (state.locked) return;
  state.locked = true;
  state.poppedBalloons += 1;
  state.lostCents += state.roundCents;
  state.penaltyCents += state.phase.penaltyCents;
  const lost = state.roundCents;
  state.roundCents = 0;
  elements.pump.disabled = true;
  elements.cash.disabled = true;
  elements.balloon.classList.add("popped");
  elements.balloonSpace.classList.add("shake");
  elements.burstMark.hidden = false;
  const penaltyCopy = state.phase.penaltyCents ? ` plus a ${formatMoney(state.phase.penaltyCents)} bank penalty` : "";
  setFeedback(`Burst. Lost ${formatMoney(lost)}${penaltyCopy}.`, "bad");
  updateMetrics();
  window.setTimeout(nextBalloon, 850);
}

// Transfer the current balloon's earnings into the bank and continue safely.
function cashOut() {
  if (!state.active || state.locked || state.currentPumps === 0) return;
  state.locked = true;
  state.bankedBalloons += 1;
  state.grossBankedCents += state.roundCents;
  state.bankedPumps += state.currentPumps;
  state.maxPumpsBanked = Math.max(state.maxPumpsBanked, state.currentPumps);
  state.highestBalloonCents = Math.max(state.highestBalloonCents, state.roundCents);
  const banked = state.roundCents;
  elements.pump.disabled = true;
  elements.cash.disabled = true;
  setFeedback(`Cashed out ${formatMoney(banked)} safely.`, "good");
  updateMetrics();
  window.setTimeout(nextBalloon, 480);
}

// Update the timer against wall-clock time and finish at zero.
function updateTimer() {
  if (!state.active) return;
  const remaining = state.durationSeconds - (performance.now() - state.startedAt) / 1000;
  elements.timer.textContent = formatTime(remaining);
  if (remaining <= 0) finishSession();
}

// Start a clean timed Balloon session using the selected duration.
function startSession() {
  state.active = true;
  state.locked = false;
  state.startedAt = performance.now();
  state.startedAtIso = new Date().toISOString();
  state.balloonNumber = 0;
  state.grossBankedCents = 0;
  state.penaltyCents = 0;
  state.lostCents = 0;
  state.bankedBalloons = 0;
  state.poppedBalloons = 0;
  state.totalPumps = 0;
  state.bankedPumps = 0;
  state.maxPumpsBanked = 0;
  state.highestBalloonCents = 0;
  elements.home.hidden = true;
  elements.historyScreen.hidden = true;
  elements.game.hidden = false;
  elements.summary.hidden = true;
  elements.endActions.hidden = true;
  elements.historyButton.hidden = true;
  elements.quit.hidden = false;
  nextBalloon();
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 200);
}

// Render key-value data for a completed session or selected history item.
function renderDetails(container, details) {
  container.innerHTML = Object.entries(details).map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
}

// Build the shared Balloon detail set from one saved performance.
function performanceDetails(performance) {
  const details = performance.details || {};
  const netCents = (details.grossBankedCents || 0) - (details.penaltyCents || 0);
  const averagePumps = performance.correct ? (details.bankedPumps || 0) / performance.correct : 0;
  return {
    "Net earnings": formatMoney(netCents),
    "Gross banked": formatMoney(details.grossBankedCents || 0),
    Penalties: formatMoney(details.penaltyCents || 0),
    "Lost in bursts": formatMoney(details.lostCents || 0),
    "Balloons banked": performance.correct,
    Bursts: performance.total - performance.correct,
    "Cash-out rate": `${performance.accuracy.toFixed(1)}%`,
    "Total pumps": details.totalPumps || 0,
    "Average pumps banked": averagePumps.toFixed(1),
    "Max pumps banked": details.maxPumpsBanked || 0,
    "Best balloon": formatMoney(details.highestBalloonCents || 0),
    Duration: `${performance.durationSeconds / 60} min`,
  };
}

// Save a completed session and show its detailed financial result.
async function finishSession() {
  if (!state.active) return;
  state.active = false;
  state.locked = true;
  window.clearInterval(state.timerId);
  elements.timer.textContent = "00:00";
  elements.pump.disabled = true;
  elements.cash.disabled = true;
  elements.quit.hidden = true;
  elements.endActions.hidden = false;
  setFeedback(`Session complete with ${formatMoney(state.grossBankedCents - state.penaltyCents)} net earnings.`, "good");

  try {
    const response = await fetch("/api/performances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "balloon",
        mode: "classic",
        durationSeconds: state.durationSeconds,
        correct: state.bankedBalloons,
        total: state.bankedBalloons + state.poppedBalloons,
        details: {
          grossBankedCents: state.grossBankedCents,
          penaltyCents: state.penaltyCents,
          lostCents: state.lostCents,
          totalPumps: state.totalPumps,
          bankedPumps: state.bankedPumps,
          maxPumpsBanked: state.maxPumpsBanked,
          highestBalloonCents: state.highestBalloonCents,
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
  state.locked = true;
  window.clearInterval(state.timerId);
  showHome();
}

// Show the separate Balloon history tracker outside active play.
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

// Load only Balloon records and render selectable tracker rows.
async function loadHistory() {
  try {
    const response = await fetch("/api/performances?game=balloon");
    if (!response.ok) throw new Error("History unavailable");
    const { performances } = await response.json();
    state.history = performances;
    elements.historyBody.innerHTML = performances.length ? performances.map((performance) => {
      const details = performance.details || {};
      const net = (details.grossBankedCents || 0) - (details.penaltyCents || 0);
      const date = new Date(performance.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      return `<tr><td>${date}</td><td>${formatMoney(net)}</td><td>${performance.correct}</td><td>${performance.total - performance.correct}</td><td><button class="detail-button" data-id="${performance.id}" type="button">Details</button></td></tr>`;
    }).join("") : '<tr><td class="empty-row" colspan="5">No completed Balloon sessions yet.</td></tr>';
    elements.historyStatus.textContent = `${performances.length} completed Balloon session${performances.length === 1 ? "" : "s"}.`;
  } catch (error) {
    elements.historyStatus.textContent = "Balloon history is unavailable. Restart the Python server.";
  }
}

// Display the full metrics for one selected Balloon history entry.
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
elements.pump.addEventListener("click", pumpBalloon);
elements.cash.addEventListener("click", cashOut);
elements.quit.addEventListener("click", quitSession);
elements.historyBody.addEventListener("click", (event) => { const button = event.target.closest("[data-id]"); if (button) showHistoryDetail(button.dataset.id); });

elements.timer.textContent = formatTime(state.durationSeconds);
loadHistory().then(() => { elements.historyButton.hidden = state.history.length === 0; });
