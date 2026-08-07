const state = {
  active: false,
  locked: false,
  mode: "symbol",
  durationSeconds: 60,
  startedAt: null,
  correct: 0,
  total: 0,
  score: 0,
  currentTrial: null,
  timerId: null,
  history: [],
};

const elements = {
  modeButtons: [...document.querySelectorAll(".mode-card")],
  durationButtons: [...document.querySelectorAll(".duration")],
  start: document.querySelector("#start-button"),
  quit: document.querySelector("#quit-button"),
  homeScreen: document.querySelector("#home-screen"),
  gameScreen: document.querySelector("#game-screen"),
  endActions: document.querySelector("#end-actions"),
  playAgain: document.querySelector("#play-again"),
  returnHome: document.querySelector("#return-home"),
  historyScreen: document.querySelector("#history-screen"),
  historyButton: document.querySelector("#history-button"),
  backToHome: document.querySelector("#back-to-home"),
  taskType: document.querySelector("#task-type"),
  taskPrompt: document.querySelector("#task-prompt"),
  timer: document.querySelector("#timer"),
  stimulus: document.querySelector("#stimulus"),
  answers: [...document.querySelectorAll("#answers button")],
  answerLabels: [document.querySelector("#answer-one"), document.querySelector("#answer-two")],
  score: document.querySelector("#score"),
  attempts: document.querySelector("#attempts"),
  accuracy: document.querySelector("#accuracy"),
  cpm: document.querySelector("#cpm"),
  historyBody: document.querySelector("#history-body"),
  historyStatus: document.querySelector("#history-status"),
  historyDetail: document.querySelector("#history-detail"),
  historyDetailList: document.querySelector("#history-detail-list"),
  summary: document.querySelector("#round-summary"),
  summaryDetails: document.querySelector("#summary-details"),
};

const vowels = ["A", "E", "I", "O", "U"];
const consonants = "BCDFGHJKLMNPQRSTVWXYZ".split("");
const arrowSymbols = ["↑", "↓", "←", "→"];

// Pick one item from an array for an unpredictable but balanced trial.
function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

// Format seconds as the compact clock shown during a practice session.
function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

// Create two alphanumeric cards and randomly choose the active classification rule.
function symbolTrial(kind) {
  const leftIsVowel = Math.random() < 0.5;
  const rightIsVowel = Math.random() < 0.5;
  const leftLetter = pick(leftIsVowel ? vowels : consonants);
  const rightLetter = pick(rightIsVowel ? vowels : consonants);
  const leftNumber = Math.floor(Math.random() * 98) + 2;
  const rightNumber = Math.floor(Math.random() * 98) + 2;

  if (kind === "letter") {
    return {
      label: "Left / letter rule",
      prompt: "Focus left: is the letter a vowel or consonant?",
      stimulus: `<div class="dual-stimulus"><div class="symbol-card active-card"><span class="card-label">Left / letter</span><strong>${leftLetter}${leftNumber}</strong></div><div class="symbol-card"><span class="card-label">Right / number</span><strong>${rightLetter}${rightNumber}</strong></div></div>`,
      options: ["Vowel", "Consonant"],
      correctIndex: leftIsVowel ? 0 : 1,
    };
  }

  return {
    label: "Right / number rule",
    prompt: "Focus right: is the number even or odd?",
    stimulus: `<div class="dual-stimulus"><div class="symbol-card"><span class="card-label">Left / letter</span><strong>${leftLetter}${leftNumber}</strong></div><div class="symbol-card active-card"><span class="card-label">Right / number</span><strong>${rightLetter}${rightNumber}</strong></div></div>`,
    options: ["Even", "Odd"],
    correctIndex: rightNumber % 2 === 0 ? 0 : 1,
  };
}

// Create the arrow-comparison or arithmetic-parity task for the second mode.
function arrowTrial(kind) {
  if (kind === "arrows") {
    const first = Array.from({ length: 4 }, () => pick(arrowSymbols));
    const isIdentical = Math.random() < 0.5;
    const second = [...first];
    if (!isIdentical) {
      const changedIndex = Math.floor(Math.random() * second.length);
      const alternatives = arrowSymbols.filter((arrow) => arrow !== second[changedIndex]);
      second[changedIndex] = pick(alternatives);
    }
    return {
      label: "Arrow rule",
      prompt: "Compare the two arrow sets.",
      stimulus: `<div class="arrow-comparison"><div class="arrow-set">${first.join("")}</div><div class="arrow-set">${second.join("")}</div></div>`,
      options: ["Identical", "Different"],
      correctIndex: isIdentical ? 0 : 1,
    };
  }

  const left = Math.floor(Math.random() * 16) + 4;
  const right = Math.floor(Math.random() * 16) + 3;
  const useAddition = Math.random() < 0.5;
  const result = useAddition ? left + right : left - right;
  return {
    label: "Arithmetic rule",
    prompt: "Is the result odd or even?",
    stimulus: `<div class="math-expression">${left} ${useAddition ? "+" : "−"} ${right}</div>`,
    options: ["Even", "Odd"],
    correctIndex: Math.abs(result) % 2 === 0 ? 0 : 1,
  };
}

// Generate each task independently so the same rule may repeat or switch.
function createTrial() {
  const tasks = state.mode === "symbol" ? ["letter", "number"] : ["arrows", "math"];
  const task = pick(tasks);
  return state.mode === "symbol" ? symbolTrial(task) : arrowTrial(task);
}

// Render the next task only while a timed session remains active.
function showNextTrial() {
  if (!state.active) return;
  state.currentTrial = createTrial();
  const trial = state.currentTrial;
  elements.taskType.textContent = trial.label;
  elements.taskPrompt.textContent = trial.prompt;
  elements.stimulus.classList.remove("idle");
  elements.stimulus.innerHTML = trial.stimulus;
  elements.answerLabels.forEach((label, index) => { label.textContent = trial.options[index]; });
  elements.answers.forEach((button) => {
    button.disabled = false;
    button.classList.remove("correct", "incorrect");
  });
}

// Update the live signed score without waiting until the end of a session.
function updateMetrics() {
  const elapsedSeconds = state.active ? Math.max(1, (Date.now() - state.startedAt) / 1000) : state.durationSeconds;
  const accuracy = state.total ? (state.correct / state.total) * 100 : 0;
  elements.score.textContent = state.score;
  elements.attempts.textContent = state.total;
  elements.accuracy.textContent = state.total ? `${accuracy.toFixed(1)}%` : "--";
  elements.cpm.textContent = (state.score * 60 / elapsedSeconds).toFixed(1);
}

// Keep the timer accurate even if the browser briefly pauses rendering.
function updateTimer() {
  if (!state.active) return;
  const remaining = state.durationSeconds - (Date.now() - state.startedAt) / 1000;
  elements.timer.textContent = formatTime(remaining);
  updateMetrics();
  if (remaining <= 0) finishSession();
}

// Start a new session from the selected mode and duration.
function startSession() {
  state.active = true;
  state.locked = false;
  state.startedAt = Date.now();
  state.correct = 0;
  state.total = 0;
  state.score = 0;
  elements.homeScreen.hidden = true;
  elements.gameScreen.hidden = false;
  elements.endActions.hidden = true;
  elements.summary.hidden = true;
  elements.quit.hidden = false;
  elements.historyButton.hidden = true;
  elements.durationButtons.forEach((button) => { button.disabled = true; });
  showNextTrial();
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 200);
}

// Render compact key-value metrics in completed-round and tracker detail panels.
function renderDetails(container, details) {
  container.innerHTML = Object.entries(details)
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("");
}

// Show the saved result immediately after the player finishes a session.
function showRoundSummary(performance) {
  const details = performance.details || {};
  renderDetails(elements.summaryDetails, {
    Mode: performance.mode === "symbol" ? "Symbol switch" : "Arrow + arithmetic",
    Score: performance.score,
    Correct: performance.correct,
    Incorrect: details.incorrect ?? performance.total - performance.correct,
    Attempts: performance.total,
    Accuracy: `${performance.accuracy.toFixed(1)}%`,
    "Score / min": performance.scorePerMinute,
    Duration: `${performance.durationSeconds / 60} min`,
  });
  elements.summary.hidden = false;
}

// Save a completed session and expose the post-game actions.
async function finishSession() {
  if (!state.active) return;
  state.active = false;
  state.locked = true;
  window.clearInterval(state.timerId);
  elements.timer.textContent = "00:00";
  elements.answers.forEach((button) => { button.disabled = true; });
  elements.taskType.textContent = "Session complete";
  elements.taskPrompt.textContent = `Score ${state.score}: ${state.correct} correct from ${state.total} attempts.`;
  elements.stimulus.classList.add("idle");
  elements.stimulus.innerHTML = `<div class="idle-mark">✓</div><p>Your result has been added to the local log.</p>`;
  elements.quit.hidden = true;
  elements.durationButtons.forEach((button) => { button.disabled = false; });
  elements.historyButton.hidden = false;
  elements.endActions.hidden = false;
  updateMetrics();

  try {
    const response = await fetch("/api/performances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "shapeshift",
        mode: state.mode,
        durationSeconds: state.durationSeconds,
        correct: state.correct,
        total: state.total,
        details: { incorrect: state.total - state.correct },
        startedAt: new Date(state.startedAt).toISOString(),
      }),
    });
    if (!response.ok) throw new Error("Could not save this session.");
    const { performance } = await response.json();
    showRoundSummary(performance);
    await loadHistory();
  } catch (error) {
    elements.historyStatus.textContent = "Session finished, but local history could not be saved.";
  }
}

// End a practice run without adding incomplete results to local history.
async function quitSession() {
  if (!state.active) return;
  state.active = false;
  state.locked = true;
  window.clearInterval(state.timerId);
  elements.quit.hidden = true;
  elements.durationButtons.forEach((button) => { button.disabled = false; });
  elements.historyButton.hidden = false;
  await loadHistory();
  showHome();
}

// Score an answer, give brief visual feedback, then change the active rule.
function answerTrial(index) {
  if (!state.active || state.locked || !state.currentTrial) return;
  state.locked = true;
  const isCorrect = index === state.currentTrial.correctIndex;
  state.total += 1;
  if (isCorrect) state.correct += 1;
  state.score += isCorrect ? 1 : -1;
  elements.answers[index].classList.add(isCorrect ? "correct" : "incorrect");
  if (!isCorrect) elements.answers[state.currentTrial.correctIndex].classList.add("correct");
  elements.answers.forEach((button) => { button.disabled = true; });
  updateMetrics();
  window.setTimeout(() => {
    state.locked = false;
    showNextTrial();
  }, 120);
}

// Switch to the separate history view only after a completed game.
function showHistory() {
  if (state.active) return;
  elements.homeScreen.hidden = true;
  elements.gameScreen.hidden = true;
  elements.historyScreen.hidden = false;
}

// Return to the configuration screen from a finished or quit session.
function showHome() {
  elements.historyScreen.hidden = true;
  elements.gameScreen.hidden = true;
  elements.homeScreen.hidden = false;
}

// Load the most recent local sessions into the separate history view.
async function loadHistory() {
  try {
    const response = await fetch("/api/performances?game=shapeshift");
    if (!response.ok) throw new Error("History unavailable");
    const { performances } = await response.json();
    state.history = performances;
    elements.historyBody.innerHTML = "";
    if (!performances.length) {
      elements.historyBody.innerHTML = '<tr><td class="empty-row" colspan="6">No sessions yet. Your completed games will appear here.</td></tr>';
      elements.historyStatus.textContent = "Stored only on this computer.";
      return;
    }
    performances.forEach((performance) => {
      const row = document.createElement("tr");
      const date = new Date(performance.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      const mode = performance.mode === "symbol" ? "Symbol switch" : "Arrow + arithmetic";
      row.innerHTML = `<td>${date}</td><td>${mode}</td><td>${performance.score}</td><td>${performance.accuracy.toFixed(1)}%</td><td>${performance.scorePerMinute.toFixed(1)}</td><td><button class="detail-button" data-id="${performance.id}" type="button">Details</button></td>`;
      elements.historyBody.appendChild(row);
    });
    elements.historyStatus.textContent = `${performances.length} local session${performances.length === 1 ? "" : "s"} saved.`;
  } catch (error) {
    elements.historyBody.innerHTML = '<tr><td class="empty-row" colspan="6">Start the Python server to view local history.</td></tr>';
    elements.historyStatus.textContent = "History is unavailable.";
  }
}

// Reveal a saved session's full metrics from the ShapeShift tracker.
function showHistoryDetail(id) {
  const performance = state.history.find((item) => item.id === id);
  if (!performance) return;
  const details = performance.details || {};
  renderDetails(elements.historyDetailList, {
    Mode: performance.mode === "symbol" ? "Symbol switch" : "Arrow + arithmetic",
    Score: performance.score,
    Correct: performance.correct,
    Incorrect: details.incorrect ?? performance.total - performance.correct,
    Attempts: performance.total,
    Accuracy: `${performance.accuracy.toFixed(1)}%`,
    "Score / min": performance.scorePerMinute,
    Duration: `${performance.durationSeconds / 60} min`,
  });
  elements.historyDetail.hidden = false;
}

elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.active) return;
    state.mode = button.dataset.mode;
    elements.modeButtons.forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle("selected", selected);
      candidate.setAttribute("aria-checked", String(selected));
    });
  });
});

elements.durationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.active) return;
    state.durationSeconds = Number(button.dataset.duration);
    elements.timer.textContent = formatTime(state.durationSeconds);
    elements.durationButtons.forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle("selected", selected);
      candidate.setAttribute("aria-checked", String(selected));
    });
  });
});

elements.start.addEventListener("click", startSession);
elements.playAgain.addEventListener("click", startSession);
elements.quit.addEventListener("click", quitSession);
elements.answers.forEach((button, index) => { button.addEventListener("click", () => answerTrial(index)); });
elements.historyButton.addEventListener("click", showHistory);
elements.returnHome.addEventListener("click", showHome);
elements.backToHome.addEventListener("click", showHome);
elements.historyBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (button) showHistoryDetail(button.dataset.id);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") answerTrial(0);
  if (event.key === "ArrowRight") answerTrial(1);
});

elements.timer.textContent = formatTime(state.durationSeconds);
loadHistory().then(() => {
  elements.historyButton.hidden = state.history.length === 0;
});
