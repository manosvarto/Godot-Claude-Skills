// Slot engine: 5 reels x 4 rows, 1024 ways. Pure logic, no DOM.
const REELS = 5, ROWS = 4;
// Ladder, lowest rung first. Index = rank.
// Low pays: letters 10, J, Q, K, H, M. Then ranks: Στρατιώτης, Λοχίας, Επιλοχίας, Αρχιλοχίας,
// Ανθυπολοχαγός, Υπολοχαγός, Λοχαγός, Ταγματάρχης, Αντισυνταγματάρχης, Συνταγματάρχης, Στρατηγός
const SYMBOLS = ['L10','LJ','LQ','LK','LH','LM','PVT','SGT','SSG','MSG','LT2','LT1','CPT','MAJ','LTC','COL','GEN'];
const WILD = 'WILD', BONUS = 'BONUS';   // BONUS = Στρατάρχης
// Per-cell draw weights (non-bonus). Wild only on reels 2-4.
const WEIGHTS = { L10:34, LJ:32, LQ:30, LK:28, LH:26, LM:24, PVT:14, SGT:12, SSG:11, MSG:10, LT2:9, LT1:8, CPT:7, MAJ:6, LTC:5, COL:4, GEN:3 };
const WILD_W = [0, 8, 8, 8, 0];
const WILD_W_FS = [0, 20, 20, 20, 0];   // wilds land more often in free spins
let BONUS_P = 0.06;            // chance a reel shows one bonus symbol (max 1 per reel)
// Pays in multiples of total bet per way, for 3/4/5 of a kind.
let PAY = {
  L10:[0.24,0.49,0.96], LJ:[0.24,0.49,1.08], LQ:[0.3,0.6,1.2], LK:[0.3,0.6,1.44], LH:[0.36,0.73,1.68], LM:[0.36,0.84,1.79],
  PVT:[0.6,1.49,3], SGT:[0.73,1.79,3.6], SSG:[0.9,2.11,4.5], MSG:[1.08,2.41,5.4], LT2:[1.2,3,6.01], LT1:[1.49,3.6,7.5],
  CPT:[1.79,4.5,9], MAJ:[2.41,6.01,11.7], LTC:[3,7.5,14.6], COL:[4.5,11.7,24.4], GEN:[6.01,17.6,59.7]
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

// grid[reel][row]. fixed: [{c, r, sym}] symbols held in place (moving wilds, moving medals).
// A reel that already holds a medal never gets a second one.
function spinGrid(rng, { allowBonus = true, fixed = [], fs = false } = {}) {
  const grid = [];
  for (let c = 0; c < REELS; c++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) col.push(drawCell(c, rng, fs));
    const held = fixed.filter(f => f.c === c && f.r < ROWS);
    if (allowBonus && !held.some(f => f.sym === BONUS) && rng() < BONUS_P) col[Math.floor(rng() * ROWS)] = BONUS;
    for (const f of held) col[f.r] = f.sym;
    grid.push(col);
  }
  return grid;
}

// Medal positions on a grid
const medalsOf = grid => { const out = []; for (let c = 0; c < REELS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r] === BONUS) out.push({ c, r }); return out; };
// Exactly 2 medals: they step down one row per free respin while neither is on the bottom row.
const canRespin = pos => pos.length === 2 && Math.max(...pos.map(p => p.r)) < ROWS - 1;
const stepDown = (pos, sym) => pos.map(p => ({ c: p.c, r: p.r + 1, fromR: p.r, sym }));

// Max bonus: a wild that is part of a win locks for the rest of the bonus; a wild that has never
// been part of a win moves one row down (and leaves the board from the bottom row).
// prev: the moves returned last spin (to know which wilds are already locked).
// Returns every move, including r === ROWS (leaving).
function nextWilds(grid, res, prev = []) {
  const hit = new Set(), was = new Set(prev.filter(w => w.stay && w.r < ROWS).map(w => w.c + ',' + w.r));
  for (const w of res.wins) for (const [c, r] of w.cells) if (grid[c][r] === WILD) hit.add(c + ',' + r);
  const out = new Map();
  for (let c = 0; c < REELS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r] === WILD) {
    const k = c + ',' + r, stay = was.has(k) || hit.has(k), nr = stay ? r : r + 1;
    const key = c + ',' + nr;
    if (!out.has(key) || stay) out.set(key, { c, r: nr, fromR: r, sym: WILD, stay });
  }
  return [...out.values()];
}

// One paid base-game round: the spin plus any medal respins. Returns total (x bet) and bonusCount.
function playBase(rng) {
  let grid = spinGrid(rng), res = evaluate(grid), total = res.total, respins = 0;
  let pos = medalsOf(grid);
  while (res.bonusCount < 3 && canRespin(pos)) {
    const fixed = stepDown(pos, BONUS);
    grid = spinGrid(rng, { fixed }); res = evaluate(grid); total += res.total; respins++;
    pos = medalsOf(grid);
  }
  return { total, bonusCount: res.bonusCount >= 3 ? res.bonusCount : 0, respins };
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

// Plays a whole bonus. Returns total win (x bet).
function playBonus(n, rng) {
  const max = n >= 4, spins = spinsFor(n);
  let wilds = [], total = 0;
  for (let i = 0; i < spins; i++) {
    const grid = spinGrid(rng, { allowBonus: false, fixed: max ? wilds.filter(w => w.r < ROWS) : [], fs: true });
    const res = evaluate(grid);
    total += res.total;
    if (max) wilds = nextWilds(grid, res, wilds);
    if (total >= MAX_WIN) return { total: MAX_WIN, max, spins };
  }
  return { total, max, spins };
}

if (typeof module !== 'undefined') module.exports = {
  REELS, ROWS, SYMBOLS, WILD, BONUS, WEIGHTS, WILD_W, BONUS_P, BONUS_PAY, MAX_WIN,
  get PAY() { return PAY; }, setPay(p) { PAY = p; }, setBonusP(p) { BONUS_P = p; },
  spinsFor, makeRng, spinGrid, evaluate, playBonus, playBase, nextWilds, medalsOf, canRespin, stepDown
};
