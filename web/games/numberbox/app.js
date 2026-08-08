const state = {
  active: false,
  locked: false,
  boardComplete: false,
  durationSeconds: 60,
  startedAt: null,
  timerId: null,
  numbers: [],
  target: 0,
  solution: "",
  tiles: [],
  selectedIds: [],
  trail: [],
  nextTileId: 0,
  puzzleStartedAt: null,
  correct: 0,
  total: 0,
  score: 0,
  skipped: 0,
  resets: 0,
  streak: 0,
  bestStreak: 0,
  puzzlesSeen: 0,
  totalSolveMilliseconds: 0,
  fastestSolveMilliseconds: 0,
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
  target: document.querySelector("#target"),
  numberRow: document.querySelector("#number-row"),
  selectionGuide: document.querySelector("#selection-guide"),
  operationRow: document.querySelector("#operation-row"),
  operationButtons: [...document.querySelectorAll("[data-operation]")],
  calculationTrail: document.querySelector("#calculation-trail"),
  feedback: document.querySelector("#feedback"),
  reset: document.querySelector("#reset-button"),
  skip: document.querySelector("#skip-button"),
  quit: document.querySelector("#quit-button"),
  score: document.querySelector("#score"),
  attempts: document.querySelector("#attempts"),
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

const operatorSymbols = { "+": "+", "-": "−", "*": "×", "/": "÷" };

// Return the greatest common divisor used to normalize exact fractions.
function greatestCommonDivisor(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

// Normalize a numerator and denominator so operations never rely on floats.
function fraction(numerator, denominator = 1) {
  if (denominator === 0) throw new Error("Division by zero is not allowed.");
  const sign = denominator < 0 ? -1 : 1;
  const divisor = greatestCommonDivisor(numerator, denominator);
  return { numerator: sign * numerator / divisor, denominator: Math.abs(denominator) / divisor };
}

// Apply one supported operation to two exact fraction values.
function calculate(left, operator, right) {
  if (operator === "+") return fraction(left.numerator * right.denominator + right.numerator * left.denominator, left.denominator * right.denominator);
  if (operator === "-") return fraction(left.numerator * right.denominator - right.numerator * left.denominator, left.denominator * right.denominator);
  if (operator === "*") return fraction(left.numerator * right.numerator, left.denominator * right.denominator);
  if (operator === "/") return fraction(left.numerator * right.denominator, left.denominator * right.numerator);
  throw new Error("Unsupported operation.");
}

// Display whole numbers plainly and preserve exact fractions when needed.
function formatFraction(value) {
  return value.denominator === 1 ? String(value.numerator) : `${value.numerator}/${value.denominator}`;
}

// Shuffle an array copy without changing the original values.
function shuffled(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

// Build one guaranteed-solvable puzzle from a random expression tree.
function generatePuzzle() {
  const operators = ["+", "-", "*", "/"];
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const numbers = Array.from({ length: 4 }, () => Math.floor(Math.random() * 11) + 1);
    const nodes = shuffled(numbers).map((number) => ({ value: fraction(number), expression: String(number), operators: [] }));
    let failed = false;

    while (nodes.length > 1) {
      const left = nodes.splice(Math.floor(Math.random() * nodes.length), 1)[0];
      const right = nodes.splice(Math.floor(Math.random() * nodes.length), 1)[0];
      const operator = operators[Math.floor(Math.random() * operators.length)];
      try {
        nodes.push({ value: calculate(left.value, operator, right.value), expression: `(${left.expression} ${operatorSymbols[operator]} ${right.expression})`, operators: [...left.operators, ...right.operators, operator] });
      } catch (error) {
        failed = true;
        break;
      }
    }

    if (failed) continue;
    const candidate = nodes[0];
    const target = candidate.value.numerator;
    if (candidate.value.denominator === 1 && target >= 1 && target <= 100 && new Set(candidate.operators).size >= 2) {
      return { numbers, target, solution: candidate.expression };
    }
  }
  return { numbers: [2, 3, 4, 5], target: 19, solution: "((5 × 4) − (3 − 2))" };
}

// Format seconds as the countdown clock shown during a session.
function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

// Format stored millisecond timings for summaries and history details.
function formatMilliseconds(milliseconds) {
  return milliseconds ? `${(milliseconds / 1000).toFixed(1)} sec` : "--";
}

// Replace feedback text and its semantic colour in one operation.
function setFeedback(message, kind = "") {
  elements.feedback.textContent = message;
  elements.feedback.className = `feedback${kind ? ` ${kind}` : ""}`;
}

// Refresh score, accuracy, streak, and solved-puzzle displays.
function updateMetrics() {
  const accuracy = state.total ? state.correct / state.total * 100 : 0;
  elements.score.textContent = state.score;
  elements.attempts.textContent = state.total;
  elements.accuracy.textContent = state.total ? `${accuracy.toFixed(1)}%` : "--";
  elements.streak.textContent = state.streak;
  elements.sessionScore.textContent = `${state.correct} solved`;
}

// Draw current values, ordered selections, available operations, and calculation trail.
function renderBoard() {
  elements.numberRow.style.gridTemplateColumns = `repeat(${Math.max(state.tiles.length, 1)}, 1fr)`;
  elements.numberRow.innerHTML = state.tiles.map((tile) => {
    const selectionIndex = state.selectedIds.indexOf(tile.id);
    const selected = selectionIndex >= 0;
    const badge = selected ? `<span class="selection-order">${selectionIndex + 1}</span>` : "";
    return `<button class="number-chip${selected ? " selected" : ""}" data-tile-id="${tile.id}" type="button" aria-pressed="${selected}" aria-label="Select ${formatFraction(tile.value)}">${badge}${formatFraction(tile.value)}</button>`;
  }).join("");
  elements.calculationTrail.innerHTML = state.trail.map((step) => `<span class="calculation-step">${step}</span>`).join("");

  const canOperate = state.active && !state.locked && !state.boardComplete && state.selectedIds.length === 2;
  elements.operationButtons.forEach((button) => { button.disabled = !canOperate; });
  if (state.boardComplete) elements.selectionGuide.textContent = "Reset the puzzle to try a different route.";
  else if (state.selectedIds.length === 0) elements.selectionGuide.textContent = "Select the first value, then the second value.";
  else if (state.selectedIds.length === 1) elements.selectionGuide.textContent = "Now select the second value.";
  else elements.selectionGuide.textContent = "Choose an operation. Order matters for subtraction and division.";
}

// Restore the four starting values while retaining the current target.
function resetBoard(recordReset = true) {
  if (recordReset && (state.trail.length || state.selectedIds.length || state.boardComplete)) state.resets += 1;
  state.nextTileId = 0;
  state.tiles = state.numbers.map((number) => ({ id: state.nextTileId++, value: fraction(number), expression: String(number) }));
  state.selectedIds = [];
  state.trail = [];
  state.boardComplete = false;
  state.locked = false;
  setFeedback("Use all four starting numbers through three operations.");
  renderBoard();
}

// Present a new guaranteed-solvable challenge inside the active session.
function nextPuzzle() {
  if (!state.active) return;
  const puzzle = generatePuzzle();
  state.numbers = puzzle.numbers;
  state.target = puzzle.target;
  state.solution = puzzle.solution;
  state.puzzleStartedAt = Date.now();
  state.puzzlesSeen += 1;
  elements.target.textContent = state.target;
  elements.reset.disabled = false;
  elements.skip.disabled = false;
  resetBoard(false);
}

// Select or deselect a value while preserving the order of two operands.
function toggleTile(tileId) {
  if (!state.active || state.locked || state.boardComplete) return;
  const selectedIndex = state.selectedIds.indexOf(tileId);
  if (selectedIndex >= 0) state.selectedIds.splice(selectedIndex, 1);
  else if (state.selectedIds.length < 2) state.selectedIds.push(tileId);
  else setFeedback("Choose an operation or deselect one of the highlighted values.", "error");
  renderBoard();
}

// Score the final reduced value once all four originals have been consumed.
function scoreCompletedBoard(tile) {
  state.total += 1;
  state.boardComplete = true;
  if (tile.value.denominator === 1 && tile.value.numerator === state.target) {
    const solveTime = Date.now() - state.puzzleStartedAt;
    state.correct += 1;
    state.score += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.totalSolveMilliseconds += solveTime;
    state.fastestSolveMilliseconds = state.fastestSolveMilliseconds ? Math.min(state.fastestSolveMilliseconds, solveTime) : solveTime;
    state.locked = true;
    setFeedback(`Correct. ${tile.expression} = ${state.target}.`, "success");
    updateMetrics();
    renderBoard();
    window.setTimeout(nextPuzzle, 650);
    return;
  }
  state.score -= 1;
  state.streak = 0;
  setFeedback(`The final value is ${formatFraction(tile.value)}, not ${state.target}. Reset and try another route.`, "error");
  updateMetrics();
  renderBoard();
}

// Collapse two selected values into their exact intermediate result.
function applyOperation(operator) {
  if (!state.active || state.locked || state.boardComplete || state.selectedIds.length !== 2) return;
  const left = state.tiles.find((tile) => tile.id === state.selectedIds[0]);
  const right = state.tiles.find((tile) => tile.id === state.selectedIds[1]);
  try {
    const value = calculate(left.value, operator, right.value);
    const symbol = operatorSymbols[operator];
    const expression = `(${left.expression} ${symbol} ${right.expression})`;
    const step = `${formatFraction(left.value)} ${symbol} ${formatFraction(right.value)} = ${formatFraction(value)}`;
    state.tiles = state.tiles.filter((tile) => !state.selectedIds.includes(tile.id));
    const resultTile = { id: state.nextTileId++, value, expression };
    state.tiles.push(resultTile);
    state.selectedIds = [];
    state.trail.push(step);
    setFeedback(`${step}. Continue with the remaining values.`);
    renderBoard();
    if (state.tiles.length === 1) scoreCompletedBoard(resultTile);
  } catch (error) {
    setFeedback(error.message, "error");
  }
}

// Start a clean timed session using the selected duration.
function startSession() {
  state.active = true;
  state.locked = false;
  state.startedAt = Date.now();
  state.correct = 0;
  state.total = 0;
  state.score = 0;
  state.skipped = 0;
  state.resets = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.puzzlesSeen = 0;
  state.totalSolveMilliseconds = 0;
  state.fastestSolveMilliseconds = 0;
  elements.home.hidden = true;
  elements.historyScreen.hidden = true;
  elements.game.hidden = false;
  elements.summary.hidden = true;
  elements.endActions.hidden = true;
  elements.historyButton.hidden = true;
  elements.quit.hidden = false;
  elements.skip.hidden = false;
  elements.reset.hidden = false;
  updateMetrics();
  nextPuzzle();
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 200);
}

// Reveal the known solution, record a skip, then load another challenge.
function skipPuzzle() {
  if (!state.active || state.locked) return;
  state.locked = true;
  state.skipped += 1;
  state.streak = 0;
  setFeedback(`One solution: ${state.solution} = ${state.target}`, "solution");
  updateMetrics();
  renderBoard();
  window.setTimeout(nextPuzzle, 1400);
}

// Update the timer against wall-clock time and finish at zero.
function updateTimer() {
  if (!state.active) return;
  const remaining = state.durationSeconds - (Date.now() - state.startedAt) / 1000;
  elements.timer.textContent = formatTime(remaining);
  if (remaining <= 0) finishSession();
}

// Render key-value data for a completed round or selected history item.
function renderDetails(container, details) {
  container.innerHTML = Object.entries(details).map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
}

// Build the shared Number Box detail set from one saved performance.
function performanceDetails(performance) {
  const details = performance.details || {};
  const average = performance.correct ? (details.totalSolveMilliseconds || 0) / performance.correct : 0;
  return {
    Solved: performance.correct,
    Attempts: performance.total,
    Accuracy: `${performance.accuracy.toFixed(1)}%`,
    Score: performance.score,
    Skipped: details.skipped || 0,
    Resets: details.resets || 0,
    "Best streak": details.bestStreak || 0,
    "Average solve": formatMilliseconds(average),
    "Fastest solve": formatMilliseconds(details.fastestSolveMilliseconds || 0),
    Duration: `${performance.durationSeconds / 60} min`,
  };
}

// Save a completed session and display its detailed result immediately.
async function finishSession() {
  if (!state.active) return;
  state.active = false;
  state.locked = true;
  window.clearInterval(state.timerId);
  elements.timer.textContent = "00:00";
  elements.reset.hidden = true;
  elements.skip.hidden = true;
  elements.quit.hidden = true;
  elements.endActions.hidden = false;
  renderBoard();
  setFeedback(`Session complete: ${state.correct} puzzle${state.correct === 1 ? "" : "s"} solved.`, "success");

  try {
    const response = await fetch("/api/performances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "numberbox",
        mode: "classic",
        durationSeconds: state.durationSeconds,
        correct: state.correct,
        total: state.total,
        details: {
          skipped: state.skipped,
          resets: state.resets,
          bestStreak: state.bestStreak,
          puzzlesSeen: state.puzzlesSeen,
          totalSolveMilliseconds: Math.round(state.totalSolveMilliseconds),
          fastestSolveMilliseconds: Math.round(state.fastestSolveMilliseconds),
        },
        startedAt: new Date(state.startedAt).toISOString(),
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
    setFeedback(`History was not saved: ${error.message} Restart the Python server and play the session again.`, "error");
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

// Show the separate history tracker outside the active game screen.
function showHistory() {
  if (state.active) return;
  elements.home.hidden = true;
  elements.game.hidden = true;
  elements.historyScreen.hidden = false;
}

// Return to setup and restore tracker access when saved rounds exist.
function showHome() {
  elements.game.hidden = true;
  elements.historyScreen.hidden = true;
  elements.home.hidden = false;
  elements.historyButton.hidden = state.history.length === 0;
}

// Load only Number Box records and render selectable tracker rows.
async function loadHistory() {
  try {
    const response = await fetch("/api/performances?game=numberbox");
    if (!response.ok) throw new Error("History unavailable");
    const { performances } = await response.json();
    state.history = performances;
    elements.historyBody.innerHTML = performances.length ? performances.map((performance) => {
      const date = new Date(performance.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      return `<tr><td>${date}</td><td>${performance.correct}</td><td>${performance.accuracy.toFixed(1)}%</td><td>${performance.score}</td><td><button class="detail-button" data-id="${performance.id}" type="button">Details</button></td></tr>`;
    }).join("") : '<tr><td class="empty-row" colspan="5">No completed Number Box sessions yet.</td></tr>';
    elements.historyStatus.textContent = `${performances.length} completed Number Box session${performances.length === 1 ? "" : "s"}.`;
  } catch (error) {
    elements.historyStatus.textContent = "Number Box history is unavailable. Restart the Python server.";
  }
}

// Display the full metrics for one selected Number Box history entry.
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
elements.reset.addEventListener("click", () => resetBoard(true));
elements.skip.addEventListener("click", skipPuzzle);
elements.quit.addEventListener("click", quitSession);
elements.numberRow.addEventListener("click", (event) => { const button = event.target.closest("[data-tile-id]"); if (button) toggleTile(Number(button.dataset.tileId)); });
elements.operationRow.addEventListener("click", (event) => { const button = event.target.closest("[data-operation]"); if (button) applyOperation(button.dataset.operation); });
elements.historyBody.addEventListener("click", (event) => { const button = event.target.closest("[data-id]"); if (button) showHistoryDetail(button.dataset.id); });

elements.timer.textContent = formatTime(state.durationSeconds);
loadHistory().then(() => { elements.historyButton.hidden = state.history.length === 0; });
