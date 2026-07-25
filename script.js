const GRID_SIZE = 15;
const STORAGE_KEY = "bostonian-times-word-links-progress-v2";
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const puzzles = [
  {
    name: "Morning Edition",
    starters: [
      { word: "PRESS", row: 3, col: 2, direction: "across", id: "A" },
      { word: "SCOOP", row: 10, col: 9, direction: "down", id: "B" },
    ],
  },
  {
    name: "City Desk",
    starters: [
      { word: "PRINT", row: 2, col: 10, direction: "down", id: "A" },
      { word: "PAGES", row: 11, col: 3, direction: "across", id: "B" },
    ],
  },
  {
    name: "Late Edition",
    starters: [
      { word: "INK", row: 6, col: 3, direction: "across", id: "A" },
      { word: "EDITION", row: 4, col: 11, direction: "down", id: "B" },
    ],
  },
];

const state = {
  puzzleIndex: 0,
  board: [],
  words: [],
  score: 0,
  selectedCell: null,
  status: "playing",
  starterCells: { A: [], B: [] },
  dateKey: "",
};

const boardEl = document.getElementById("board");
const wordForm = document.getElementById("word-form");
const wordInput = document.getElementById("word-input");
const rowInput = document.getElementById("row-input");
const colInput = document.getElementById("col-input");
const messageEl = document.getElementById("message");
const puzzleNameEl = document.getElementById("puzzle-name");
const scoreValueEl = document.getElementById("score-value");
const scoreLargeEl = document.getElementById("score-large");
const wordsAddedEl = document.getElementById("words-added");
const historyListEl = document.getElementById("history-list");
const statusPillEl = document.getElementById("status-pill");
const editionLabelEl = document.getElementById("edition-label");
const challengeDateEl = document.getElementById("challenge-date");
const heroDateEl = document.getElementById("hero-date");

function createEmptyBoard() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null)
  );
}

function getCellsForWord({ word, row, col, direction }) {
  return word.split("").map((letter, index) => ({
    row: row + (direction === "down" ? index : 0),
    col: col + (direction === "across" ? index : 0),
    letter,
  }));
}

function isInBounds(cells) {
  return cells.every(
    ({ row, col }) => row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE
  );
}

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateParts(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function formatLongDate(dateKey) {
  const { year, month, day } = getDateParts(dateKey);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

function formatEditionLabel(dateKey) {
  const { year, month, day } = getDateParts(dateKey);
  const weekday = WEEKDAY_NAMES[new Date(year, month - 1, day).getDay()];
  return `${weekday} Games Edition`;
}

function getPuzzleIndexForDate(dateKey) {
  const { year, month, day } = getDateParts(dateKey);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  return ((dayNumber % puzzles.length) + puzzles.length) % puzzles.length;
}

function placeStarterWord(starter) {
  const cells = getCellsForWord(starter);
  cells.forEach(({ row, col, letter }) => {
    state.board[row][col] = {
      letter,
      type: "starter",
      starterId: starter.id,
      owners: [starter.id],
    };
    state.starterCells[starter.id].push({ row, col });
  });

  state.words.push({
    ...starter,
    cells,
    type: "starter",
  });
}

function setDailyLabels() {
  const formattedDate = formatLongDate(state.dateKey);
  editionLabelEl.textContent = formatEditionLabel(state.dateKey);
  challengeDateEl.textContent = formattedDate;
  heroDateEl.textContent = formattedDate;
}

function setMessage(text, isSuccess = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle("is-success", isSuccess);
}

function setFormAvailability() {
  const isComplete = state.status === "won";
  Array.from(wordForm.elements).forEach((field) => {
    field.disabled = isComplete;
  });
}

function updateScore() {
  scoreValueEl.textContent = String(state.score);
  scoreLargeEl.textContent = String(state.score);
  const addedWords = state.words.filter((word) => word.type === "placed").length;
  wordsAddedEl.textContent = String(addedWords);
}

function updateHistory() {
  const placedWords = state.words.filter((word) => word.type === "placed").slice().reverse();
  historyListEl.innerHTML = "";

  if (!placedWords.length) {
    historyListEl.innerHTML = "<li>No moves yet.</li>";
    return;
  }

  placedWords.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = `${entry.word} at row ${entry.row + 1}, column ${
      entry.col + 1
    } ${entry.direction} for ${entry.cost} points`;
    historyListEl.appendChild(item);
  });
}

function updateStatus() {
  if (state.status === "won") {
    statusPillEl.textContent = "Daily challenge complete";
    statusPillEl.classList.add("is-success");
  } else {
    statusPillEl.textContent = "Daily challenge in progress";
    statusPillEl.classList.remove("is-success");
  }

  setFormAvailability();
}

function renderBoard() {
  boardEl.innerHTML = "";

  const connectedCells = getConnectedRegionFromStarter("A");
  const winningPath = state.status === "won" ? connectedCells : [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.row = String(row);
      button.dataset.col = String(col);
      button.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}`);

      const cell = state.board[row][col];
      if (cell) {
        button.textContent = cell.letter;
        button.classList.add(cell.type === "starter" ? "cell--starter" : "cell--placed");
      }

      if (
        state.selectedCell &&
        state.selectedCell.row === row &&
        state.selectedCell.col === col
      ) {
        button.classList.add("cell--selected");
      }

      if (winningPath.some((entry) => entry.row === row && entry.col === col)) {
        button.classList.add("cell--connected");
      }

      button.addEventListener("click", () => selectCell(row, col));
      boardEl.appendChild(button);
    }
  }
}

function selectCell(row, col) {
  if (state.status === "won") {
    return;
  }

  state.selectedCell = { row, col };
  rowInput.value = row + 1;
  colInput.value = col + 1;
  renderBoard();
}

function sanitizeWord(rawWord) {
  return rawWord.trim().toUpperCase().replace(/[^A-Z]/g, "");
}

function validatePlacement(word, row, col, direction) {
  if (!word) {
    return { ok: false, reason: "Enter letters only for your word." };
  }

  const cells = getCellsForWord({ word, row, col, direction });
  if (!isInBounds(cells)) {
    return { ok: false, reason: "That word would run off the edge of the board." };
  }

  let overlapCount = 0;

  for (const cell of cells) {
    const existing = state.board[cell.row][cell.col];
    if (!existing) {
      continue;
    }

    if (existing.letter !== cell.letter) {
      return {
        ok: false,
        reason: `The letter at row ${cell.row + 1}, column ${
          cell.col + 1
        } does not match.`,
      };
    }

    overlapCount += 1;
  }

  if (overlapCount !== 1) {
    return {
      ok: false,
      reason: "Each move must overlap the current board in exactly one matching letter.",
    };
  }

  const duplicateWord = state.words.some(
    (existingWord) =>
      existingWord.word === word &&
      existingWord.row === row &&
      existingWord.col === col &&
      existingWord.direction === direction
  );

  if (duplicateWord) {
    return { ok: false, reason: "That exact word placement is already on the board." };
  }

  return { ok: true, cells };
}

function applyPlacement(word, row, col, direction, cells) {
  cells.forEach(({ row: cellRow, col: cellCol, letter }) => {
    const existing = state.board[cellRow][cellCol];
    if (existing) {
      existing.owners.push(word);
      return;
    }

    state.board[cellRow][cellCol] = {
      letter,
      type: "placed",
      owners: [word],
    };
  });

  const cost = 10 + word.length;
  state.words.push({
    word,
    row,
    col,
    direction,
    cells,
    type: "placed",
    cost,
  });
  state.score += cost;
}

function getNeighbors(row, col) {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ].filter(
    ({ row: nextRow, col: nextCol }) =>
      nextRow >= 0 &&
      nextRow < GRID_SIZE &&
      nextCol >= 0 &&
      nextCol < GRID_SIZE &&
      state.board[nextRow][nextCol]
  );
}

function getConnectedRegionFromStarter(starterId) {
  const starters = state.starterCells[starterId];
  const queue = [...starters];
  const seen = new Set(starters.map(({ row, col }) => `${row},${col}`));

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const neighbors = getNeighbors(current.row, current.col);

    neighbors.forEach((neighbor) => {
      const key = `${neighbor.row},${neighbor.col}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(neighbor);
      }
    });
  }

  return queue;
}

function readProgressStore() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeProgressStore(store) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures and continue with the live board state.
  }
}

function saveProgress() {
  const store = readProgressStore();
  const placedWords = state.words
    .filter((word) => word.type === "placed")
    .map(({ word, row, col, direction }) => ({
      word,
      row,
      col,
      direction,
    }));

  store[state.dateKey] = {
    puzzleIndex: state.puzzleIndex,
    status: state.status,
    placedWords,
  };

  writeProgressStore(store);
}

function loadSavedProgress() {
  const saved = readProgressStore()[state.dateKey];
  if (!saved || saved.puzzleIndex !== state.puzzleIndex) {
    return;
  }

  try {
    saved.placedWords.forEach((entry) => {
      const validation = validatePlacement(entry.word, entry.row, entry.col, entry.direction);
      if (!validation.ok) {
        throw new Error(validation.reason);
      }
      applyPlacement(entry.word, entry.row, entry.col, entry.direction, validation.cells);
    });

    state.status = saved.status === "won" ? "won" : "playing";
  } catch {
    const puzzle = puzzles[state.puzzleIndex];
    state.board = createEmptyBoard();
    state.words = [];
    state.score = 0;
    state.selectedCell = null;
    state.status = "playing";
    state.starterCells = { A: [], B: [] };
    puzzle.starters.forEach(placeStarterWord);
    const store = readProgressStore();
    delete store[state.dateKey];
    writeProgressStore(store);
  }
}

function checkWin() {
  const regionA = getConnectedRegionFromStarter("A");
  const regionKeys = new Set(regionA.map(({ row, col }) => `${row},${col}`));
  const connected = state.starterCells.B.some(({ row, col }) => regionKeys.has(`${row},${col}`));

  if (connected) {
    state.status = "won";
    updateStatus();
    renderBoard();
    saveProgress();
    setMessage("You completed today's daily challenge. Come back tomorrow for a new puzzle.", true);
    return true;
  }

  return false;
}

function startDailyPuzzle() {
  state.dateKey = getTodayKey();
  state.puzzleIndex = getPuzzleIndexForDate(state.dateKey);
  state.board = createEmptyBoard();
  state.words = [];
  state.score = 0;
  state.selectedCell = null;
  state.status = "playing";
  state.starterCells = { A: [], B: [] };

  const puzzle = puzzles[state.puzzleIndex];
  puzzle.starters.forEach(placeStarterWord);

  puzzleNameEl.textContent = puzzle.name;
  setDailyLabels();
  loadSavedProgress();
  updateScore();
  updateHistory();
  updateStatus();
  renderBoard();

  const placedWords = state.words.filter((word) => word.type === "placed").length;
  if (state.status === "won") {
    setMessage("You already solved today's daily challenge. Come back tomorrow for a new board.", true);
    return;
  }

  if (placedWords > 0) {
    setMessage("Welcome back. Today's daily challenge has been restored.");
    return;
  }

  setMessage("Today's daily challenge is ready. Build a chain across the board.");
}

wordForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (state.status === "won") {
    setMessage("Today's puzzle is already complete. Come back tomorrow for a new challenge.");
    return;
  }

  const word = sanitizeWord(wordInput.value);
  const row = Number.parseInt(rowInput.value, 10) - 1;
  const col = Number.parseInt(colInput.value, 10) - 1;
  const direction = new FormData(wordForm).get("direction");

  if (Number.isNaN(row) || Number.isNaN(col)) {
    setMessage("Choose a starting row and column first.");
    return;
  }

  const validation = validatePlacement(word, row, col, direction);
  if (!validation.ok) {
    setMessage(validation.reason);
    return;
  }

  applyPlacement(word, row, col, direction, validation.cells);
  saveProgress();
  updateScore();
  updateHistory();
  renderBoard();

  const moveCost = 10 + word.length;
  setMessage(`Placed ${word} for ${moveCost} points. Keep linking today's chain.`, true);

  wordForm.reset();
  rowInput.value = row + 1;
  colInput.value = col + 1;
  wordInput.focus();

  checkWin();
});

startDailyPuzzle();
