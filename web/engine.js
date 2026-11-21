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
let WILD_W_MAX = [0, 60, 60, 60, 0];      // and even more often in the max bonus
let BONUS_P = 0.06;            // chance a reel shows one bonus symbol (max 1 per reel)
// Pays in multiples of total bet per way, for 3/4/5 of a kind.
let PAY = {
  L10:[0.25,0.52,1.01], LJ:[0.25,0.52,1.14], LQ:[0.32,0.63,1.26], LK:[0.32,0.63,1.52], LH:[0.38,0.77,1.77], LM:[0.38,0.88,1.88],
  PVT:[0.63,1.57,3.16], SGT:[0.77,1.88,3.79], SSG:[0.95,2.22,4.74], MSG:[1.14,2.54,5.68], LT2:[1.26,3.16,6.33], LT1:[1.57,3.79,7.89],
  CPT:[1.88,4.74,9.47], MAJ:[2.54,6.33,12.3], LTC:[3.16,7.89,15.4], COL:[4.74,12.3,25.7], GEN:[6.33,18.5,62.8]
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
  const wild = (fs === 'max' ? WILD_W_MAX : fs ? WILD_W_FS : WILD_W)[reel];
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

// Max bonus: a wild that is part of a win moves one row down for the next spin (and leaves from the
// bottom row); a wild that is not part of a win leaves the board. Nothing locks.
// Returns every wild's move: {c, r, fromR, sym, hit, gone}. gone = leaving (r === ROWS or no win).
function nextWilds(grid, res) {
  const hit = new Set();
  for (const w of res.wins) for (const [c, r] of w.cells) if (grid[c][r] === WILD) hit.add(c + ',' + r);
  const out = [];
  for (let c = 0; c < REELS; c++) for (let r = ROWS - 1; r >= 0; r--) if (grid[c][r] === WILD) {
    const h = hit.has(c + ',' + r);
    out.push(h ? { c, r: r + 1, fromR: r, sym: WILD, hit: true, gone: r + 1 >= ROWS } : { c, r, fromR: r, sym: WILD, hit: false, gone: true });
  }
  return out;
}
// Wilds that are still on the board for the next spin
const keptWilds = moves => moves.filter(w => !w.gone);

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
    const grid = spinGrid(rng, { allowBonus: false, fixed: max ? keptWilds(wilds) : [], fs: max ? 'max' : true });
    const res = evaluate(grid);
    total += res.total;
    if (max) wilds = nextWilds(grid, res);
    if (total >= MAX_WIN) return { total: MAX_WIN, max, spins };
  }
  return { total, max, spins };
}

if (typeof module !== 'undefined') module.exports = {
  REELS, ROWS, SYMBOLS, WILD, BONUS, WEIGHTS, WILD_W, BONUS_P, BONUS_PAY, MAX_WIN,
  get PAY() { return PAY; }, setPay(p) { PAY = p; }, setBonusP(p) { BONUS_P = p; }, setWildMax(w) { WILD_W_MAX = [0, w, w, w, 0]; },
  spinsFor, makeRng, spinGrid, evaluate, playBonus, playBase, nextWilds, keptWilds, medalsOf, canRespin, stepDown
};
