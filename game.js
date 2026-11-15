'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - light blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const gameoverBox = document.getElementById('gameover-box');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');

const MAX_START_LEVEL = 15;

const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const recordsBox = document.getElementById('records');
const recordsList = document.getElementById('records-list');
const recordsStats = document.getElementById('records-stats');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const MAX_NAME = 12;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let started = false, combo = 0, maxCombo = 0, pendingRank = -1;
// Nivel inicial elegido en el menú de pausa; sobrevive a init() y se aplica en la siguiente partida
let startLevel = 1;

function calcDropInterval(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = calcDropInterval(level);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function loadRecords() {
  const rec = { scores: [], bestCombo: 0, maxLines: 0 };
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (data && Array.isArray(data.scores)) {
      rec.scores = data.scores
        .filter(s => s && Number.isFinite(s.score))
        .map(s => ({ name: String(s.name ?? '').slice(0, MAX_NAME), score: s.score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECORDS);
    }
    if (data && Number.isFinite(data.bestCombo)) rec.bestCombo = data.bestCombo;
    if (data && Number.isFinite(data.maxLines)) rec.maxLines = data.maxLines;
  } catch (e) {}
  return rec;
}

function saveRecords(rec) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(rec)); } catch (e) {}
}

// Posición (0-based) que ocuparía la puntuación en el top, o -1 si no entra
function rankFor(rec, s) {
  if (s <= 0) return -1;
  let i = rec.scores.findIndex(r => s > r.score);
  if (i === -1) i = rec.scores.length;
  return i < MAX_RECORDS ? i : -1;
}

function renderRecords(highlight = -1) {
  const rec = loadRecords();
  recordsList.textContent = '';
  for (let i = 0; i < MAX_RECORDS; i++) {
    const li = document.createElement('li');
    const left = document.createElement('span');
    const right = document.createElement('span');
    const r = rec.scores[i];
    if (r) {
      left.textContent = `${i + 1}. ${r.name || 'Anónimo'}`;
      right.textContent = r.score.toLocaleString();
    } else {
      left.textContent = `${i + 1}. ---`;
      li.className = 'empty';
    }
    if (i === highlight) li.classList.add('highlight');
    li.append(left, right);
    recordsList.appendChild(li);
  }
  recordsStats.textContent = `Mejor combo: ${rec.bestCombo} · Líneas máx.: ${rec.maxLines}`;
}

function showOverlay(title, scoreText, withRecords) {
  overlayTitle.textContent = title;
  overlayScore.textContent = scoreText;
  pauseMenu.classList.add('hidden');
  gameoverBox.classList.remove('hidden');
  nameForm.classList.add('hidden');
  recordsBox.classList.toggle('hidden', !withRecords);
  if (withRecords) renderRecords();
  overlay.classList.remove('hidden');
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  const rec = loadRecords();
  rec.bestCombo = Math.max(rec.bestCombo, maxCombo);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);
  pendingRank = rankFor(rec, score);
  showOverlay('GAME OVER', `Puntuación: ${score.toLocaleString()}`, true);
  if (pendingRank >= 0) {
    recordsList.children[pendingRank].classList.add('highlight');
    nameForm.classList.remove('hidden');
    nameInput.value = '';
    nameInput.focus();
  }
}

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  if (pendingRank < 0) return;
  const name = nameInput.value.trim().slice(0, MAX_NAME) || 'Anónimo';
  const rec = loadRecords();
  const idx = rankFor(rec, score);
  if (idx >= 0) {
    rec.scores.splice(idx, 0, { name, score });
    rec.scores = rec.scores.slice(0, MAX_RECORDS);
    saveRecords(rec);
    renderRecords(idx);
  }
  pendingRank = -1;
  nameForm.classList.add('hidden');
  restartBtn.focus();
});

resetRecordsBtn.addEventListener('click', () => {
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) {}
  pendingRank = -1;
  nameForm.classList.add('hidden');
  renderRecords();
  resetRecordsBtn.blur();
});

function showControls(show) {
  pauseControls.classList.toggle('hidden', !show);
  controlsBtn.setAttribute('aria-expanded', String(show));
  controlsBtn.textContent = show ? 'Ocultar controles' : 'Ver controles';
}

function togglePause() {
  if (gameOver || !started) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(animId);
    showControls(false);
    startLevelSelect.value = String(startLevel);
    gameoverBox.classList.add('hidden');
    pauseMenu.classList.remove('hidden');
    overlay.classList.remove('hidden');
    resumeBtn.focus();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  started = true;
  combo = 0;
  maxCombo = 0;
  pendingRank = -1;
  dropInterval = calcDropInterval(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  gameoverBox.classList.remove('hidden');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  restartBtn.textContent = 'Reiniciar';
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (!started) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (!e.repeat) togglePause();
    return;
  }
  // Con el menú de pausa abierto (o game over) los controles de juego no actúan
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => { init(); restartBtn.blur(); });
resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => showControls(pauseControls.classList.contains('hidden')));

for (let l = 1; l <= MAX_START_LEVEL; l++) {
  const opt = document.createElement('option');
  opt.value = String(l);
  opt.textContent = String(l);
  startLevelSelect.appendChild(opt);
}
startLevelSelect.addEventListener('change', () => {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, parseInt(startLevelSelect.value, 10) || 1));
  startLevelSelect.blur();
});

const themeToggle = document.getElementById('theme-toggle');

function applyTheme(theme) {
  const light = theme === 'light';
  if (light) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  themeToggle.textContent = light ? 'Modo oscuro' : 'Modo claro';
  themeToggle.setAttribute('aria-pressed', String(light));
  themeToggle.setAttribute('aria-label', light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  // Redibujar para que el cambio se vea también en pausa / game over
  if (current && next) { draw(); drawNext(); }
}

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('theme', theme); } catch (e) {}
  applyTheme(theme);
  themeToggle.blur(); // evita que Espacio/flechas activen el botón durante la partida
});

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

// Pantalla de inicio: tablero listo pero sin arrancar hasta pulsar "Jugar"
init();
cancelAnimationFrame(animId);
started = false;
draw();
showOverlay('TETRIS', 'Pulsa Jugar para empezar', true);
restartBtn.textContent = 'Jugar';
