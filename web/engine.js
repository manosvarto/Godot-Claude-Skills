// Slot engine: 6 reels x 5 rows, 15625 ways. Pure logic, no DOM.
const REELS = 6, ROWS = 5;
// Ladder, lowest rung first. Index = rank.
// Low pays: letters 10, J, Q, K, H, M. Mid pays: items Φραπές, Τσιγάρο, Αλεξίσφαιρο γιλέκο, Πιστόλι, Τυφέκιο, Άρμα μάχης.
// High pays, the ranks: Λοχίας, Αρχιλοχίας, Ανθυπολοχαγός, Λοχαγός, Ταγματάρχης, Αντισυνταγματάρχης, Συνταγματάρχης, Στρατηγός.
// The Στρατιώτης (the crying recruit, lowest rank) is the bonus symbol (BONUS).
const SYMBOLS = ['L10','LJ','LQ','LK','LH','LM','FRAPPE','CIG','VEST','PISTOL','RIFLE','TANK','SGT','MSG','LT2','CPT','MAJ','LTC','COL','GEN'];
const WILD = 'WILD', BONUS = 'BONUS';   // BONUS = Στρατιώτης
// Per-cell draw weights (non-bonus). Wild only on reels 2-4.
const WEIGHTS = { L10:46, LJ:44, LQ:42, LK:40, LH:38, LM:36, FRAPPE:20, CIG:19, VEST:18, PISTOL:17, RIFLE:16, TANK:15, SGT:13, MSG:11, LT2:9, CPT:8, MAJ:7, LTC:6, COL:5, GEN:4 };
const WILD_W = [0, 7, 7, 7, 7, 0];   // wilds on reels 2-5
let WILD_W_FS = [0, 11, 11, 11, 11, 0];   // more wilds in the bonus
let WILD_W_MAX = [0, 24, 24, 24, 24, 0];      // and more again in the max bonus (with multipliers)
let BONUS_P = 0.045;            // chance a reel shows one bonus symbol (max 1 per reel)
// Pays in multiples of total bet per way, for 3/4/5 of a kind.
let PAY = {   // x bet per way for 3/4/5/6 of a kind
  L10:[0.13,0.29,0.55,1.1], LJ:[0.13,0.29,0.62,1.24], LQ:[0.18,0.35,0.69,1.39], LK:[0.18,0.35,0.83,1.67], LH:[0.21,0.43,0.98,1.96], LM:[0.21,0.49,1.04,2.09],
  FRAPPE:[0.24,0.54,1.13,2.26], CIG:[0.24,0.57,1.19,2.37], VEST:[0.27,0.6,1.25,2.5], PISTOL:[0.27,0.65,1.37,2.74], RIFLE:[0.3,0.71,1.48,2.96], TANK:[0.32,0.77,1.61,3.21],
  SGT:[0.35,0.87,1.75,3.5], MSG:[0.43,1.04,2.1,4.19], LT2:[0.62,1.4,3.13,6.28], CPT:[0.69,1.75,3.5,6.99], MAJ:[1.04,2.62,5.22,10.44], LTC:[1.4,3.5,6.8,13.6],
  COL:[1.75,4.36,8.53,17.06], GEN:[3.5,10.25,34.71,69.41]
};
const BONUS_PAY = { 3: 1, 4: 10, 5: 100, 6: 100 };   // x total bet
const MAX_WIN = 10000;                       // x total bet, per game round (spin + respins + bonus)
const MAX_WIN_EUR = 140000;                  // and never more than this per game round (Greek rule, 2022)
const MIN_CYCLE_MS = 3000;                   // a new paid round may start at least 3 s after the last one
const MAX_BET = 20;                          // maximum stake per round
// «Βύσμα»: buy a bonus straight away. Price in x bet, set so a bought bonus returns ~90% like the rest of the game.
// A buy is a stake, so it is offered only while its price is within MAX_BUY_EUR.
// «Βύσμα»: always costs BUY_PRICE_EUR and the bought bonus always plays at BUY_BET (0,20 €), whatever bet is selected.
// It plays a real trigger spin with at least 3 Generals. 20 € is 100x that bet, so the buy carries a bigger chance of
// the max bonus (4 Generals 17%, 5 Generals 0.7%) to return ~90%. Line and General wins on that spin pay too.
const BUYS = {
  bonus: { min: 3, odds: { 3: 0.8233, 4: 0.17, 5: 0.0067 }, priceX: 100 }
};
const BUY_PRICE_EUR = 20, BUY_BET = 0.2;
const buyBet = () => BUY_BET;
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
// mult (max bonus only): {"c,r": m} multiplier carried by each wild. Each way of a win is multiplied by
// 1 + the sum of (m - 1) over the wilds on that way, so plain x1 wilds change nothing.
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
      // Wild multipliers apply only to the ways that pass through that wild, and add up along a way:
      // a way through a x2 and a x3 wild pays x4 (1 + 1 + 2). Summed over all ways:
      //   sum = ways + sum over reels of (sum of (m - 1) on that reel) * (ways on the other reels)
      let waysPaid = ways, top = 1;
      if (mult) {
        for (let c = 0; c < len; c++) {
          let extra = 0, n = 0;
          for (let r = 0; r < ROWS; r++) {
            const v = grid[c][r];
            if (v === s || v === WILD) { n++; if (v === WILD) { const m = mult[c + ',' + r] || 1; extra += m - 1; if (m > top) top = m; } }
          }
          if (extra) waysPaid += extra * (ways / n);
        }
      }
      const pay = PAY[s][len - 3] * waysPaid;
      wins.push({ sym: s, len, ways, pay, cells: used, mult: waysPaid / ways, topMult: top });
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

// The trigger spin of a «Βύσμα» buy: a base grid with the chosen number of medals on distinct reels.
function buyGrid(kind, rng) {
  const buy = BUYS[kind];
  let r = rng(), n = buy.min;
  for (const [k, p] of Object.entries(buy.odds)) { if (r < p) { n = +k; break; } r -= p; }
  const grid = spinGrid(rng, { allowBonus: false });
  const reels = Array.from({ length: REELS }, (_, i) => i);
  for (let i = reels.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [reels[i], reels[j]] = [reels[j], reels[i]]; }
  for (const c of reels.slice(0, n)) grid[c][Math.floor(rng() * ROWS)] = BONUS;
  return grid;
}
// A whole buy: trigger spin + bonus. Returns total (x bet).
function playBuy(kind, rng) {
  const grid = buyGrid(kind, rng), res = evaluate(grid);
  return { total: Math.min(res.total + playBonus(res.bonusCount, rng).total, MAX_WIN), medals: res.bonusCount };
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
  REELS, ROWS, SYMBOLS, WILD, BONUS, WEIGHTS, WILD_W, BONUS_P, BONUS_PAY, MAX_WIN, MAX_WIN_EUR, MIN_CYCLE_MS, MAX_BET, BUYS, MAX_BUY_EUR, BUY_PRICE_EUR, BUY_BET, buyBet,
  get PAY() { return PAY; }, setPay(p) { PAY = p; }, get BONUS_P() { return BONUS_P; }, get WILD_W_FS() { return WILD_W_FS; }, get WILD_W_MAX() { return WILD_W_MAX; }, setBonusP(p) { BONUS_P = p; }, setWildMax(w) { WILD_W_MAX = [0, w, w, w, w, 0]; }, setWildFs(w) { WILD_W_FS = [0, w, w, w, w, 0]; },
  spinsFor, makeRng, makeSeededRng, drawCell, spinGrid, evaluate, playBonus, playBase, buyGrid, playBuy, nextWilds, keptWilds, multOf, medalsOf, canRespin, stepDown
};
