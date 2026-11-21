// Slot engine: 5 reels x 4 rows, 1024 ways. Pure logic, no DOM.
const REELS = 5, ROWS = 4;
// Ladder, lowest rung first. Index = rank.
// Λοχίας, Επιλοχίας, Αρχιλοχίας, Ανθυπολοχαγός, Υπολοχαγός, Λοχαγός,
// Ταγματάρχης, Αντισυνταγματάρχης, Συνταγματάρχης, Στρατηγός
const SYMBOLS = ['SGT','SSG','MSG','LT2','LT1','CPT','MAJ','LTC','COL','GEN'];
const WILD = 'WILD', BONUS = 'BONUS';   // BONUS = Στρατάρχης
// Per-cell draw weights (non-bonus). Wild only on reels 2-4.
const WEIGHTS = { SGT:28, SSG:26, MSG:24, LT2:20, LT1:17, CPT:15, MAJ:12, LTC:10, COL:7, GEN:4 };
const WILD_W = [0, 5, 5, 5, 0];
const WILD_W_FS = [0, 12, 12, 12, 0];   // wilds land more often in free spins
const BONUS_P = 0.09;            // chance a reel shows one bonus symbol (max 1 per reel)
// Pays in multiples of total bet per way, for 3/4/5 of a kind.
let PAY = {
  SGT:[0.12,0.24,0.59], SSG:[0.12,0.24,0.71], MSG:[0.19,0.35,0.82], LT2:[0.24,0.47,0.94], LT1:[0.24,0.59,1.18],
  CPT:[0.35,0.71,1.41], MAJ:[0.47,0.94,1.88], LTC:[0.59,1.41,2.83], COL:[0.94,2.35,4.71], GEN:[1.41,4.71,14.1]
};
const BONUS_PAY = { 3: 1, 4: 10, 5: 100 };   // x total bet
const MAX_WIN = 10000;                       // x total bet, per spin/feature
const spinsFor = n => 10 + 2 * (n - 3);      // 3 -> 10, 4 -> 12, 5 -> 14

function makeRng() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    return () => { crypto.getRandomValues(buf); return buf[0] / 4294967296; };
  }
  return Math.random;
}

function drawCell(reel, rng, fs) {
  const wild = (fs ? WILD_W_FS : WILD_W)[reel];
  let total = wild;
  for (const s of SYMBOLS) total += WEIGHTS[s];
  let r = rng() * total;
  if (r < wild) return WILD;
  r -= wild;
  for (const s of SYMBOLS) { if (r < WEIGHTS[s]) return s; r -= WEIGHTS[s]; }
  return SYMBOLS[0];
}

// grid[reel][row]. sticky: same shape, true where a wild is locked.
function spinGrid(rng, { allowBonus = true, sticky = null, fs = false } = {}) {
  const grid = [];
  for (let c = 0; c < REELS; c++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) col.push(drawCell(c, rng, fs));
    if (allowBonus && rng() < BONUS_P) col[Math.floor(rng() * ROWS)] = BONUS;
    if (sticky) for (let r = 0; r < ROWS; r++) if (sticky[c][r]) col[r] = WILD;
    grid.push(col);
  }
  return grid;
}

// Returns { total (x bet), wins: [{sym, len, ways, pay, cells}], bonusCount }
function evaluate(grid) {
  const wins = [];
  let total = 0;
  for (const s of SYMBOLS) {
    let ways = 1, len = 0;
    const cells = [];
    for (let c = 0; c < REELS; c++) {
      let n = 0;
      for (let r = 0; r < ROWS; r++) {
        const v = grid[c][r];
        if (v === s || v === WILD) { n++; cells.push([c, r]); }
      }
      if (n === 0) break;
      ways *= n; len++;
    }
    if (len >= 3) {
      const pay = PAY[s][len - 3] * ways;
      // keep only cells on counted reels
      wins.push({ sym: s, len, ways, pay, cells: cells.filter(([c]) => c < len) });
      total += pay;
    }
  }
  let bonusCount = 0;
  const bonusCells = [];
  for (let c = 0; c < REELS; c++) for (let r = 0; r < ROWS; r++)
    if (grid[c][r] === BONUS) { bonusCount++; bonusCells.push([c, r]); }
  if (bonusCount >= 3) {
    const pay = BONUS_PAY[Math.min(bonusCount, 5)];
    wins.push({ sym: BONUS, len: bonusCount, ways: 1, pay, cells: bonusCells });
    total += pay;
  }
  return { total, wins, bonusCount };
}

// Plays a whole bonus. Returns total win (x bet) and per-spin results.
function playBonus(n, rng) {
  const max = n >= 4;
  const spins = spinsFor(n);
  const sticky = Array.from({ length: REELS }, () => Array(ROWS).fill(false));
  const rounds = [];
  let total = 0;
  for (let i = 0; i < spins; i++) {
    const grid = spinGrid(rng, { allowBonus: false, sticky: max ? sticky : null, fs: true });
    if (max) for (let c = 0; c < REELS; c++) for (let r = 0; r < ROWS; r++)
      if (grid[c][r] === WILD) sticky[c][r] = true;
    const res = evaluate(grid);
    total += res.total;
    rounds.push({ grid, res, sticky: sticky.map(col => col.slice()) });
  }
  return { total, rounds, max, spins };
}

if (typeof module !== 'undefined') module.exports = {
  REELS, ROWS, SYMBOLS, WILD, BONUS, WEIGHTS, WILD_W, BONUS_P, BONUS_PAY, MAX_WIN,
  get PAY() { return PAY; }, setPay(p) { PAY = p; },
  spinsFor, makeRng, spinGrid, evaluate, playBonus
};
