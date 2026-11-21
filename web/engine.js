// Slot engine: 5 reels x 4 rows, 1024 ways. Pure logic, no DOM.
const REELS = 5, ROWS = 4;
// Ladder, lowest rung first. Index = rank.
// Low pays: letters 10, J, Q, K, H, M. Mid pays: items Φραπές, Τσιγάρο, Αλεξίσφαιρο γιλέκο, Πιστόλι, Τυφέκιο, Άρμα μάχης.
// High pays, the ranks: Στρατιώτης, Λοχίας, Επιλοχίας, Αρχιλοχίας, Ανθυπολοχαγός, Υπολοχαγός, Λοχαγός,
// Ταγματάρχης, Αντισυνταγματάρχης, Συνταγματάρχης, Στρατηγός
const SYMBOLS = ['L10','LJ','LQ','LK','LH','LM','FRAPPE','CIG','VEST','PISTOL','RIFLE','TANK','PVT','SGT','SSG','MSG','LT2','LT1','CPT','MAJ','LTC','COL','GEN'];
const WILD = 'WILD', BONUS = 'BONUS';   // BONUS = Στρατάρχης
// Per-cell draw weights (non-bonus). Wild only on reels 2-4.
const WEIGHTS = { L10:53, LJ:50, LQ:46, LK:43, LH:40, LM:37, FRAPPE:15, CIG:14, VEST:13, PISTOL:12, RIFLE:11, TANK:10, PVT:10, SGT:9, SSG:8, MSG:7, LT2:6, LT1:5, CPT:4, MAJ:4, LTC:3, COL:3, GEN:2 };
const WILD_W = [0, 12, 12, 12, 0];
let WILD_W_FS = [0, 18, 18, 18, 0];   // more wilds in the bonus
let WILD_W_MAX = [0, 38, 38, 38, 0];      // and more again in the max bonus (with multipliers)
let BONUS_P = 0.06;            // chance a reel shows one bonus symbol (max 1 per reel)
// Pays in multiples of total bet per way, for 3/4/5 of a kind.
let PAY = {   // = the 90% profile of the PAR sheet (web/par/par-sheet.json)
  L10:[0.28,0.6,1.13], LJ:[0.28,0.6,1.28], LQ:[0.37,0.72,1.42], LK:[0.37,0.72,1.72], LH:[0.43,0.86,2.0], LM:[0.43,0.99,2.13],
  FRAPPE:[0.49,1.1,2.31], CIG:[0.49,1.16,2.44], VEST:[0.55,1.22,2.56], PISTOL:[0.55,1.34,2.8], RIFLE:[0.61,1.46,3.04], TANK:[0.67,1.58,3.29],
  PVT:[0.72,1.78,3.58], SGT:[0.86,2.13,4.29], SSG:[1.07,2.5,5.36], MSG:[1.28,2.87,6.42], LT2:[1.42,3.58,7.15], LT1:[1.78,4.29,8.93],
  CPT:[2.13,5.36,10.7], MAJ:[2.87,7.15,13.92], LTC:[3.58,8.93,17.45], COL:[5.36,13.92,29.04], GEN:[7.15,20.99,71.02]
};
const BONUS_PAY = { 3: 1, 4: 10, 5: 100 };   // x total bet
const MAX_WIN = 10000;                       // x total bet, per game round (spin + respins + bonus)
const MAX_WIN_EUR = 140000;                  // and never more than this per game round (Greek rule, 2022)
const MIN_CYCLE_MS = 3000;                   // a new paid round may start at least 3 s after the last one
const MAX_BET = 20;                          // maximum stake per round
// «Βύσμα»: buy a bonus straight away. Price in x bet, set so a bought bonus returns ~90% like the rest of the game.
// A buy is a stake, so it is offered only while its price is within MAX_BUY_EUR.
const BUYS = { bonus: { medals: 3, priceX: 20 }, max: { medals: 4, priceX: 330 } };
const MAX_BUY_EUR = 20;
const spinsFor = n => 10 + 2 * (n - 3);      // 3 -> 10, 4 -> 12, 5 -> 14

function makeRng() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    return () => { crypto.getRandomValues(buf); return buf[0] / 4294967296; };
  }
  return Math.random;
}

// Seeded generator (xoshiro128**) for reproducible simulations and PAR sheets. The game itself uses makeRng().
function makeSeededRng(seed = 1) {
  let a = 0x9E3779B9 ^ seed, b = 0x243F6A88 ^ (seed * 31), c = 0xB7E15162 ^ (seed * 131), d = 0xDEADBEEF ^ (seed * 1031);
  const rotl = (x, k) => (x << k) | (x >>> (32 - k));
  const next = () => {
    const r = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0, t = b << 9;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = rotl(d, 11);
    return r / 4294967296;
  };
  for (let i = 0; i < 20; i++) next();   // warm up
  return next;
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
  REELS, ROWS, SYMBOLS, WILD, BONUS, WEIGHTS, WILD_W, BONUS_P, BONUS_PAY, MAX_WIN, MAX_WIN_EUR, MIN_CYCLE_MS, MAX_BET, BUYS, MAX_BUY_EUR,
  get PAY() { return PAY; }, setPay(p) { PAY = p; }, get BONUS_P() { return BONUS_P; }, get WILD_W_FS() { return WILD_W_FS; }, get WILD_W_MAX() { return WILD_W_MAX; }, setBonusP(p) { BONUS_P = p; }, setWildMax(w) { WILD_W_MAX = [0, w, w, w, 0]; }, setWildFs(w) { WILD_W_FS = [0, w, w, w, 0]; },
  spinsFor, makeRng, makeSeededRng, drawCell, spinGrid, evaluate, playBonus, playBase, nextWilds, keptWilds, multOf, medalsOf, canRespin, stepDown
};
