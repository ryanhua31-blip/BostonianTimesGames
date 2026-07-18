const GRID_SIZE = 15;

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
};

const boardEl = document.getElementById("board");
const wordForm = document.getElementById("word-form");
const replayButton = document.getElementById("replay-button");
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

function pickNextPuzzleIndex() {
  if (puzzles.length === 1) {
    return 0;
  }

  let nextIndex = state.puzzleIndex;
  while (nextIndex === state.puzzleIndex) {
    nextIndex = Math.floor(Math.random() * puzzles.length);
  }
  return nextIndex;
}

function startPuzzle(nextIndex = state.puzzleIndex) {
  state.puzzleIndex = nextIndex;
  state.board = createEmptyBoard();
  state.words = [];
  state.score = 0;
  state.selectedCell = null;
  state.status = "playing";
  state.starterCells = { A: [], B: [] };

  const puzzle = puzzles[state.puzzleIndex];
  puzzle.starters.forEach(placeStarterWord);

  puzzleNameEl.textContent = puzzle.name;
  setMessage("Starter words are placed. Build a chain across the board.");
  updateScore();
  updateHistory();
  updateStatus();
  renderBoard();
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
  state.selectedCell = { row, col };
  rowInput.value = row + 1;
  colInput.value = col + 1;
  renderBoard();
}

function sanitizeWord(rawWord) {
  return rawWord.trim().toUpperCase().replace(/[^A-Z]/g, "");
}

function setMessage(text, isSuccess = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle("is-success", isSuccess);
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
    statusPillEl.textContent = "Connection complete";
    statusPillEl.classList.add("is-success");
  } else {
    statusPillEl.textContent = "Puzzle in progress";
    statusPillEl.classList.remove("is-success");
  }
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

function checkWin() {
  const regionA = getConnectedRegionFromStarter("A");
  const regionKeys = new Set(regionA.map(({ row, col }) => `${row},${col}`));
  const connected = state.starterCells.B.some(({ row, col }) => regionKeys.has(`${row},${col}`));

  if (connected) {
    state.status = "won";
    updateStatus();
    renderBoard();
    setMessage("You connected the starter words. Replay to try a fresh puzzle.", true);
    return true;
  }

  return false;
}

wordForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (state.status === "won") {
    setMessage("This puzzle is complete. Press Replay for a new board.");
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
  updateScore();
  updateHistory();
  renderBoard();

  const moveCost = 10 + word.length;
  setMessage(`Placed ${word} for ${moveCost} points. Keep linking the chain.`, true);

  wordForm.reset();
  rowInput.value = row + 1;
  colInput.value = col + 1;
  wordInput.focus();

  checkWin();
});

replayButton.addEventListener("click", () => {
  startPuzzle(pickNextPuzzleIndex());
});

startPuzzle(Math.floor(Math.random() * puzzles.length));
