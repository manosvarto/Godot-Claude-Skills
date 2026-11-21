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
let WILD_W_FS = [0, 12, 12, 12, 0];   // more wilds in the bonus
let WILD_W_MAX = [0, 25, 25, 25, 0];      // and more again in the max bonus (with multipliers)
let BONUS_P = 0.06;            // chance a reel shows one bonus symbol (max 1 per reel)
// Pays in multiples of total bet per way, for 3/4/5 of a kind.
let PAY = {
  L10:[0.25,0.52,1], LJ:[0.25,0.52,1.13], LQ:[0.32,0.63,1.25], LK:[0.32,0.63,1.51], LH:[0.38,0.76,1.76], LM:[0.38,0.87,1.87],
  PVT:[0.63,1.56,3.14], SGT:[0.76,1.87,3.76], SSG:[0.94,2.2,4.7], MSG:[1.13,2.52,5.64], LT2:[1.25,3.14,6.28], LT1:[1.56,3.76,7.83],
  CPT:[1.87,4.7,9.4], MAJ:[2.52,6.28,12.2], LTC:[3.14,7.83,15.3], COL:[4.7,12.2,25.5], GEN:[6.28,18.4,62.3]
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

// Bonus wilds: a wild that is part of a win moves one row down for the next spin (and leaves from the
// bottom row); a wild that is not part of a win leaves the board. Nothing locks.
// In the max bonus (mult given) every win also raises that wild's multiplier by 1.
// Returns every wild's move: {c, r, fromR, sym, hit, gone, m}. gone = leaving (r === ROWS or no win).
function nextWilds(grid, res, mult = null) {
  const hit = new Set();
  for (const w of res.wins) for (const [c, r] of w.cells) if (grid[c][r] === WILD) hit.add(c + ',' + r);
  const out = [];
  for (let c = 0; c < REELS; c++) for (let r = ROWS - 1; r >= 0; r--) if (grid[c][r] === WILD) {
    const k = c + ',' + r, h = hit.has(k), m0 = mult ? (mult[k] || 1) : 1;
    out.push(h ? { c, r: r + 1, fromR: r, sym: WILD, hit: true, gone: r + 1 >= ROWS, m: mult ? m0 + 1 : 1 }
               : { c, r, fromR: r, sym: WILD, hit: false, gone: true, m: m0 });
  }
  return out;
}
// Multiplier of every wild on the grid: carried wilds keep theirs, new wilds start at x1
function multOf(grid, kept) {
  const m = {};
  for (let c = 0; c < REELS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r] === WILD) m[c + ',' + r] = 1;
  for (const w of kept) m[w.c + ',' + w.r] = w.m || 1;
  return m;
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

// Returns { total (x bet), wins: [{sym, len, ways, pay, cells, mult}], bonusCount }
// mult (max bonus only): {"c,r": m} multiplier carried by each wild. A win that uses wilds is
// multiplied by 1 + the sum of (m - 1) over those wilds, so plain x1 wilds change nothing.
function evaluate(grid, mult = null) {
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
      const used = cells.filter(([c]) => c < len);   // keep only cells on counted reels
      let m = 1;
      if (mult) for (const [c, r] of used) if (grid[c][r] === WILD) m += (mult[c + ',' + r] || 1) - 1;
      const pay = PAY[s][len - 3] * ways * m;
      wins.push({ sym: s, len, ways, pay, cells: used, mult: m });
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

// Plays a whole bonus. Wilds walk in both bonuses; the max bonus has more wilds and multipliers.
function playBonus(n, rng) {
  const max = n >= 4, spins = spinsFor(n);
  let wilds = [], total = 0;
  for (let i = 0; i < spins; i++) {
    const kept = keptWilds(wilds);
    const grid = spinGrid(rng, { allowBonus: false, fixed: kept, fs: max ? 'max' : true });
    const mult = max ? multOf(grid, kept) : null;
    const res = evaluate(grid, mult);
    total += res.total;
    wilds = nextWilds(grid, res, mult);
    if (total >= MAX_WIN) return { total: MAX_WIN, max, spins };
  }
  return { total, max, spins };
}

if (typeof module !== 'undefined') module.exports = {
  REELS, ROWS, SYMBOLS, WILD, BONUS, WEIGHTS, WILD_W, BONUS_P, BONUS_PAY, MAX_WIN,
  get PAY() { return PAY; }, setPay(p) { PAY = p; }, setBonusP(p) { BONUS_P = p; }, setWildMax(w) { WILD_W_MAX = [0, w, w, w, 0]; }, setWildFs(w) { WILD_W_FS = [0, w, w, w, 0]; },
  spinsFor, makeRng, spinGrid, evaluate, playBonus, playBase, nextWilds, keptWilds, multOf, medalsOf, canRespin, stepDown
};
