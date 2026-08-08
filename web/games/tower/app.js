const DISK_COUNT = 3;
const state = { active: false, durationSeconds: 60, startedAt: null, timerId: null, target: null, player: null, minimumMoves: 0, moves: 0, solved: 0, puzzlesStarted: 0, totalMoves: 0, totalMinimumMoves: 0, selectedRod: null, dragSource: null, history: [] };
const elements = { home: document.querySelector("#home-screen"), game: document.querySelector("#game-screen"), durations: [...document.querySelectorAll(".duration")], start: document.querySelector("#start-button"), timer: document.querySelector("#timer"), solved: document.querySelector("#session-score"), minimum: document.querySelector("#minimum-moves"), moves: document.querySelector("#move-count"), target: document.querySelector("#target-towers"), player: document.querySelector("#player-towers"), instruction: document.querySelector("#instruction"), quit: document.querySelector("#quit-button"), endActions: document.querySelector("#end-actions"), playAgain: document.querySelector("#play-again"), returnHome: document.querySelector("#return-home"), historyButton: document.querySelector("#history-button"), historyScreen: document.querySelector("#history-screen"), backToHome: document.querySelector("#back-to-home"), historyBody: document.querySelector("#history-body"), historyStatus: document.querySelector("#history-status"), historyDetail: document.querySelector("#history-detail"), historyDetailList: document.querySelector("#history-detail-list"), summary: document.querySelector("#round-summary"), summaryDetails: document.querySelector("#summary-details") };

// Clone tower stacks so moves never mutate the target arrangement.
function cloneTowers(towers) { return towers.map((tower) => [...tower]); }

// Convert a tower layout into a compact key for breadth-first search.
function towerKey(towers) { return towers.map((tower) => tower.join("-")).join("|"); }

// Build legal bottom-to-top stacks from one peg position per disk.
function towersFromPositions(positions) { const towers = [[], [], []]; for (let disk = DISK_COUNT - 1; disk >= 0; disk -= 1) towers[positions[disk]].push(disk); return towers; }

// Generate all legal one-floor moves from a tower arrangement.
function nextLayouts(towers) { const layouts = []; towers.forEach((source, sourceIndex) => { const moving = source[source.length - 1]; if (moving === undefined) return; towers.forEach((destination, destinationIndex) => { if (sourceIndex === destinationIndex) return; const destinationTop = destination[destination.length - 1]; if (destinationTop !== undefined && destinationTop < moving) return; const next = cloneTowers(towers); next[sourceIndex].pop(); next[destinationIndex].push(moving); layouts.push(next); }); }); return layouts; }

// Find the shortest legal route between the player's start and target towers.
function minimumMoveCount(start, target) { const targetKey = towerKey(target); const queue = [{ towers: start, distance: 0 }]; const visited = new Set([towerKey(start)]); while (queue.length) { const current = queue.shift(); if (towerKey(current.towers) === targetKey) return current.distance; nextLayouts(current.towers).forEach((next) => { const key = towerKey(next); if (!visited.has(key)) { visited.add(key); queue.push({ towers: next, distance: current.distance + 1 }); } }); } return 0; }

// Pick a random target that requires a meaningful number of moves.
function createTarget(start) { for (let attempt = 0; attempt < 50; attempt += 1) { const target = towersFromPositions(Array.from({ length: DISK_COUNT }, () => Math.floor(Math.random() * 3))); const moves = minimumMoveCount(start, target); if (moves >= 3) return { target, moves }; } const target = [[2, 1], [], [0]]; return { target, moves: minimumMoveCount(start, target) }; }

// Render static or interactive rods and make only a top floor draggable.
function renderTowers(container, towers, interactive) {
  container.innerHTML = "";
  towers.forEach((tower, index) => {
    const rod = document.createElement(interactive ? "button" : "div");
    rod.className = "rod";
    if (interactive) { rod.type = "button"; rod.dataset.rod = String(index); rod.setAttribute("aria-label", `Tower ${index + 1}`); rod.classList.toggle("selected", state.selectedRod === index); }
    tower.forEach((disk, stackIndex) => { const floor = document.createElement("span"); floor.className = `floor floor-${disk}`; if (interactive && stackIndex === tower.length - 1) { floor.draggable = true; floor.dataset.source = String(index); floor.setAttribute("aria-label", `Drag top floor from Tower ${index + 1}`); } rod.appendChild(floor); });
    container.appendChild(rod);
  });
}

// Draw the target, playable stacks, and move counters together.
function renderGame() { renderTowers(elements.target, state.target, false); renderTowers(elements.player, state.player, true); elements.minimum.textContent = `Minimum: ${state.minimumMoves} moves`; elements.moves.textContent = `Moves: ${state.moves}`; elements.solved.textContent = `${state.solved} solved`; }

// Start a new random target while retaining the active session timer.
function createPuzzle() { const start = [[2, 1, 0], [], []]; const next = createTarget(start); state.target = next.target; state.player = cloneTowers(start); state.minimumMoves = next.moves; state.moves = 0; state.selectedRod = null; state.puzzlesStarted += 1; elements.instruction.textContent = "Select or drag the top floor to move it."; elements.instruction.classList.remove("complete"); renderGame(); }

// Format the countdown shown for the current practice session.
function formatTime(seconds) { const safe = Math.max(0, Math.ceil(seconds)); return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`; }

// Update the timer and finish the current session at zero.
function updateTimer() { if (!state.active) return; const remaining = state.durationSeconds - (Date.now() - state.startedAt) / 1000; elements.timer.textContent = formatTime(remaining); if (remaining <= 0) finishSession(); }

// Begin a timed Tower practice session from the selected home settings.
function startSession() { state.active = true; state.startedAt = Date.now(); state.solved = 0; state.puzzlesStarted = 0; state.totalMoves = 0; state.totalMinimumMoves = 0; elements.home.hidden = true; elements.game.hidden = false; elements.endActions.hidden = true; elements.summary.hidden = true; elements.quit.hidden = false; elements.historyButton.hidden = true; createPuzzle(); updateTimer(); state.timerId = window.setInterval(updateTimer, 200); }

// Render key-value rows for a completed-session detail view.
function renderDetails(container, details) { container.innerHTML = Object.entries(details).map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join(""); }

// Show the detailed result immediately after a completed Tower round.
function showRoundSummary(performance) { const details = performance.details || {}; renderDetails(elements.summaryDetails, { "Puzzles solved": `${performance.correct} / ${performance.total}`, Score: performance.score, "Total moves": details.totalMoves ?? 0, "Minimum moves total": details.totalMinimumMoves ?? 0, "Move efficiency": `${details.totalMinimumMoves ?? 0} / ${details.totalMoves ?? 0}`, Duration: `${performance.durationSeconds / 60} min` }); elements.summary.hidden = false; }

// Conclude the timed session, save it, and expose replay or home actions.
async function finishSession() { if (!state.active) return; state.active = false; window.clearInterval(state.timerId); elements.timer.textContent = "00:00"; elements.quit.hidden = true; elements.instruction.textContent = `Session complete: ${state.solved} tower${state.solved === 1 ? "" : "s"} solved.`; elements.instruction.classList.add("complete"); elements.endActions.hidden = false; try { const response = await window.neuroRequest("/api/performances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "tower", mode: "tower", durationSeconds: state.durationSeconds, correct: state.solved, total: state.puzzlesStarted, details: { puzzlesStarted: state.puzzlesStarted, totalMoves: state.totalMoves + state.moves, totalMinimumMoves: state.totalMinimumMoves }, startedAt: new Date(state.startedAt).toISOString() }) }); if (!response.ok) throw new Error("Could not save this session."); const { performance } = await response.json(); showRoundSummary(performance); elements.historyButton.hidden = false; await loadHistory(); } catch (error) { elements.instruction.textContent = "Session complete, but the account history could not be saved."; } }

// Attempt one legal move and reject larger-on-smaller placements.
function attemptMove(sourceIndex, destinationIndex) { const source = state.player[sourceIndex]; const destination = state.player[destinationIndex]; const moving = source[source.length - 1]; const destinationTop = destination[destination.length - 1]; if (moving === undefined || sourceIndex === destinationIndex) return false; if (destinationTop !== undefined && destinationTop < moving) { elements.instruction.textContent = "A larger floor cannot sit on a smaller floor."; return false; } source.pop(); destination.push(moving); state.moves += 1; state.selectedRod = null; elements.instruction.textContent = "Select or drag the top floor to move it."; renderGame(); if (towerKey(state.player) === towerKey(state.target)) { state.solved += 1; state.totalMoves += state.moves; state.totalMinimumMoves += state.minimumMoves; elements.instruction.textContent = `Solved in ${state.moves} moves. Minimum was ${state.minimumMoves}.`; elements.instruction.classList.add("complete"); renderGame(); window.setTimeout(() => { if (state.active) createPuzzle(); }, 650); } return true; }

// Support click-to-move as an accessible alternative to dragging.
function moveFromRod(destinationIndex) { if (!state.active) return; if (state.selectedRod === null) { if (!state.player[destinationIndex].length) return; state.selectedRod = destinationIndex; elements.instruction.textContent = "Now select a destination tower."; renderGame(); return; } if (state.selectedRod === destinationIndex) { state.selectedRod = null; elements.instruction.textContent = "Select or drag the top floor to move it."; renderGame(); return; } attemptMove(state.selectedRod, destinationIndex); }

// Exit an active session without recording an unfinished Tower round.
function quitSession() { if (!state.active) return; state.active = false; window.clearInterval(state.timerId); showHome(); }

// Show the per-game tracker and allow selecting one row for details.
function showHistory() { if (state.active) return; elements.home.hidden = true; elements.game.hidden = true; elements.historyScreen.hidden = false; }

// Return to Tower's configuration screen from another view.
function showHome() { elements.game.hidden = true; elements.historyScreen.hidden = true; elements.home.hidden = false; }

// Load only Tower records and render each as a selectable history row.
async function loadHistory() { try { const response = await window.neuroRequest("/api/performances?game=tower"); if (!response.ok) throw new Error("History unavailable"); const { performances } = await response.json(); state.history = performances; elements.historyBody.innerHTML = performances.length ? performances.map((performance) => { const detail = performance.details || {}; const date = new Date(performance.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); return `<tr><td>${date}</td><td>${performance.correct}/${performance.total}</td><td>${performance.score}</td><td>${detail.totalMoves ?? 0}</td><td><button class="detail-button" data-id="${performance.id}" type="button">Details</button></td></tr>`; }).join("") : '<tr><td class="empty-row" colspan="5">No completed Tower sessions yet.</td></tr>'; elements.historyStatus.textContent = `${performances.length} completed Tower session${performances.length === 1 ? "" : "s"}.`; } catch (error) { elements.historyStatus.textContent = "Tower history is unavailable."; } }

// Display detailed metrics for the selected tracker entry.
function showHistoryDetail(id) { const performance = state.history.find((item) => item.id === id); if (!performance) return; const detail = performance.details || {}; renderDetails(elements.historyDetailList, { "Puzzles solved": `${performance.correct} / ${performance.total}`, Score: performance.score, Accuracy: `${performance.accuracy.toFixed(1)}%`, "Score / min": performance.scorePerMinute, "Total moves": detail.totalMoves ?? 0, "Minimum moves total": detail.totalMinimumMoves ?? 0, Duration: `${performance.durationSeconds / 60} min` }); elements.historyDetail.hidden = false; }

elements.durations.forEach((button) => button.addEventListener("click", () => { if (state.active) return; state.durationSeconds = Number(button.dataset.duration); elements.timer.textContent = formatTime(state.durationSeconds); elements.durations.forEach((candidate) => { const selected = candidate === button; candidate.classList.toggle("selected", selected); candidate.setAttribute("aria-checked", String(selected)); }); }));
elements.start.addEventListener("click", startSession); elements.playAgain.addEventListener("click", startSession); elements.returnHome.addEventListener("click", showHome); elements.quit.addEventListener("click", quitSession); elements.historyButton.addEventListener("click", showHistory); elements.backToHome.addEventListener("click", showHome); elements.player.addEventListener("click", (event) => { const rod = event.target.closest("[data-rod]"); if (rod) moveFromRod(Number(rod.dataset.rod)); }); elements.player.addEventListener("dragstart", (event) => { const floor = event.target.closest("[draggable]"); if (!floor || !state.active) return; state.dragSource = Number(floor.dataset.source); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", floor.dataset.source); }); elements.player.addEventListener("dragover", (event) => { const rod = event.target.closest("[data-rod]"); if (!rod || state.dragSource === null) return; event.preventDefault(); rod.classList.add("drop-target"); }); elements.player.addEventListener("dragleave", (event) => { event.target.closest("[data-rod]")?.classList.remove("drop-target"); }); elements.player.addEventListener("drop", (event) => { const rod = event.target.closest("[data-rod]"); if (!rod || state.dragSource === null) return; event.preventDefault(); const source = state.dragSource; state.dragSource = null; elements.player.querySelectorAll(".drop-target").forEach((item) => item.classList.remove("drop-target")); attemptMove(source, Number(rod.dataset.rod)); }); elements.player.addEventListener("dragend", () => { state.dragSource = null; elements.player.querySelectorAll(".drop-target").forEach((item) => item.classList.remove("drop-target")); }); elements.historyBody.addEventListener("click", (event) => { const button = event.target.closest("[data-id]"); if (button) showHistoryDetail(button.dataset.id); });
elements.timer.textContent = formatTime(state.durationSeconds);
loadHistory().then(() => {
  elements.historyButton.hidden = state.history.length === 0;
});
