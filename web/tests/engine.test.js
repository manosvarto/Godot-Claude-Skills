// Rule tests for the game engine. Run: node --test web/tests
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { REELS, ROWS, WILD, BONUS, PAY, BONUS_PAY, SYMBOLS } = E;

// Build a grid from columns; '.' fills with two symbols per reel that alternate down the reel and differ on every
// reel, so the filler never forms a way (3 reels from the left) or a cluster (4 touching).
const FILL = [['LJ', 'LQ'], ['LK', 'LH'], ['FRAPPE', 'CIG'], ['VEST', 'PISTOL'], ['RIFLE', 'TANK'], ['MSG', 'LT2']];
function grid(cols) {
  cols = Array.from({ length: REELS }, (_, c) => cols[c] || []);
  return cols.map((col, c) => Array.from({ length: ROWS }, (_, r) => (col[r] && col[r] !== '.') ? col[r] : FILL[c][r % 2]));
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('3 matching reels from the left pay the 3-of-a-kind amount', () => {
  const res = E.evaluate(grid([['SGT'], ['SGT'], ['SGT'], [], []]));
  const w = res.wins.find(x => x.sym === 'SGT');
  assert.equal(w.len, 3); assert.equal(w.ways, 1); near(w.pay, PAY.SGT[0]);
});

test('ways multiply: 2 on reel 1 and 1 on reels 2 and 3 make 2 ways', () => {
  const res = E.evaluate(grid([['SGT', 'SGT'], ['SGT'], ['SGT'], [], []]));
  const w = res.wins.find(x => x.sym === 'SGT');
  assert.equal(w.ways, 2); near(w.pay, PAY.SGT[0] * 2);
});

test('a gap breaks the line: reels 1, 2 and 4 do not pay', () => {
  const res = E.evaluate(grid([['SGT'], ['SGT'], [], ['SGT'], []]));
  assert.equal(res.wins.find(x => x.sym === 'SGT'), undefined);
});

test('5 of a kind pays the 5-of-a-kind amount', () => {
  const res = E.evaluate(grid([['COL'], ['COL'], ['COL'], ['COL'], ['COL']]));
  near(res.wins.find(x => x.sym === 'COL').pay, PAY.COL[2]);
});

test('WILD stands in for a rank', () => {
  const res = E.evaluate(grid([['SGT'], [WILD], ['SGT'], [], []]));
  assert.ok(res.wins.some(x => x.sym === 'SGT' && x.len === 3));
});

test('WILD does not stand in for the Field Marshal (bonus symbol)', () => {
  const res = E.evaluate(grid([[BONUS], [WILD], [BONUS], [], []]));
  assert.equal(res.bonusCount, 2);
  assert.equal(res.wins.find(x => x.sym === BONUS), undefined);
});

test('3, 4 and 5 Field Marshals pay anywhere and are counted', () => {
  for (const n of [3, 4, 5]) {
    const cols = [[], [], [], [], []];
    for (let c = 0; c < n; c++) cols[c] = ['.', '.', BONUS];
    const res = E.evaluate(grid(cols));
    assert.equal(res.bonusCount, n);
    near(res.wins.find(x => x.sym === BONUS).pay, BONUS_PAY[n]);
  }
});

test('free spins: 3 -> 10, 4 -> 12, 5 -> 14 (each extra adds 2)', () => {
  assert.equal(E.spinsFor(3), 10); assert.equal(E.spinsFor(4), 12); assert.equal(E.spinsFor(5), 14);
});

test('generated grids: WILD never on the first or last reel, at most one Field Marshal per reel', () => {
  const rng = E.makeSeededRng(42);
  for (let i = 0; i < 50000; i++) {
    const g = E.spinGrid(rng);
    for (let c = 0; c < REELS; c++) {
      if (c === 0 || c === REELS - 1) assert.ok(!g[c].includes(WILD));
      assert.ok(g[c].filter(s => s === BONUS).length <= 1);
    }
  }
});

test('free spins never show Field Marshals', () => {
  const rng = E.makeSeededRng(7);
  for (let i = 0; i < 20000; i++) assert.ok(!E.spinGrid(rng, { allowBonus: false, fs: true }).flat().includes(BONUS));
});

test('respin: only with exactly 2 medals and neither on the bottom row', () => {
  assert.equal(E.canRespin([{ c: 0, r: 0 }, { c: 3, r: 2 }]), true);
  assert.equal(E.canRespin([{ c: 0, r: 0 }, { c: 3, r: ROWS - 1 }]), false);
  assert.equal(E.canRespin([{ c: 0, r: 0 }]), false);
  assert.equal(E.canRespin([{ c: 0, r: 0 }, { c: 1, r: 0 }, { c: 2, r: 0 }]), false);
});

test('respin: both medals step down exactly one row and stay on their reels', () => {
  const m = E.stepDown([{ c: 1, r: 0 }, { c: 4, r: 1 }], BONUS);
  assert.deepEqual(m.map(x => [x.c, x.r, x.fromR]), [[1, 1, 0], [4, 2, 1]]);
  const g = E.spinGrid(E.makeSeededRng(3), { fixed: m });
  assert.equal(g[1][1], BONUS); assert.equal(g[4][2], BONUS);
});

test('respins: never more than ROWS - 1 in one round', () => {
  const rng = E.makeSeededRng(11);
  for (let i = 0; i < 100000; i++) assert.ok(E.playBase(rng).respins <= ROWS - 1);
});

test('bonus wilds: a winning wild steps down one row', () => {
  const g = grid([['SGT'], [WILD], ['SGT'], [], []]);
  const w = E.nextWilds(g, E.evaluate(g))[0];
  assert.equal(w.hit, true); assert.equal(w.r, 1); assert.equal(w.fromR, 0); assert.equal(w.gone, false);
});

test('bonus wilds: a wild that is not part of any win leaves', () => {
  const g = grid([[], [], [WILD], [], []]);          // reels 1 and 2 share no symbol, so nothing wins
  const res = E.evaluate(g);
  assert.equal(res.wins.length, 0);
  const w = E.nextWilds(g, res)[0];
  assert.equal(w.hit, false); assert.equal(w.gone, true);
});

test('ways rule: every wild on a counted reel is part of the win', () => {
  const g = grid([['SGT'], [WILD, '.', '.', WILD], ['SGT'], [], []]);
  const w = E.evaluate(g).wins.find(x => x.sym === 'SGT');
  assert.equal(w.ways, 2);
  assert.ok(E.nextWilds(g, E.evaluate(g)).every(m => m.hit));
});

test('bonus wilds: a winning wild on the bottom row leaves', () => {
  const B = Array(ROWS - 1).fill('.');
  const g = grid([[...B, 'SGT'], [...B, WILD], [...B, 'SGT'], [], []]);
  const moves = E.nextWilds(g, E.evaluate(g));
  assert.equal(moves[0].hit, true); assert.equal(moves[0].gone, true);
});

test('max bonus multipliers: a win raises the wild multiplier by 1', () => {
  const g = grid([['SGT'], [WILD], ['SGT'], [], []]);
  const mult = { '1,0': 3 };
  const res = E.evaluate(g, mult);
  near(res.wins.find(x => x.sym === 'SGT').pay, PAY.SGT[0] * 3);
  assert.equal(E.nextWilds(g, res, mult)[0].m, 4);
});

test('max bonus multipliers add up: x2 and x3 in one win pay x4', () => {
  const g = grid([['SGT'], [WILD], [WILD], [], []]);
  const res = E.evaluate(g, { '1,0': 2, '2,0': 3 });
  near(res.wins.find(x => x.sym === 'SGT').pay, PAY.SGT[0] * 4);
});

test('ways rule: a wild multiplier only counts on the ways that pass through it', () => {
  // reel 2 holds a Λοχίας and a x3 wild: 2 ways, one plain (x1), one through the wild (x3) = 4
  const g = grid([['SGT'], ['SGT', WILD], ['SGT'], [], []]);
  const w = E.evaluate(g, { '1,1': 3 }).wins.find(x => x.sym === 'SGT');
  assert.equal(w.ways, 2); near(w.pay, PAY.SGT[0] * 4); assert.equal(w.topMult, 3);
});

test('new wilds start at x1; carried wilds keep their multiplier', () => {
  const g = grid([[], [WILD, WILD], [], [], []]);
  const m = E.multOf(g, [{ c: 1, r: 1, m: 5 }]);
  assert.equal(m['1,0'], 1); assert.equal(m['1,1'], 5);
});

test('a bonus never pays more than the max win', () => {
  const rng = E.makeSeededRng(5);
  for (let i = 0; i < 3000; i++) assert.ok(E.playBonus(4, rng).total <= E.MAX_WIN);
});

test('paytable: every rank pays at least as much as the rank below it, letters pay least', () => {
  for (let i = 1; i < SYMBOLS.length; i++)
    for (let k = 0; k < PAY[SYMBOLS[i]].length; k++) assert.ok(PAY[SYMBOLS[i]][k] >= PAY[SYMBOLS[i - 1]][k] - 1e-9, `${SYMBOLS[i]} vs ${SYMBOLS[i - 1]}`);
});

test('Greek limits are set: max bet 20, 3 s per round, 140,000 max win per round', () => {
  assert.equal(E.MAX_BET, 20); assert.equal(E.MIN_CYCLE_MS, 3000); assert.equal(E.MAX_WIN_EUR, 140000);
});

test('seeded generator is reproducible', () => {
  const a = E.makeSeededRng(99), b = E.makeSeededRng(99);
  for (let i = 0; i < 1000; i++) assert.equal(a(), b());
});

test('Βύσμα: one buy, 20 at a 0,20 bet (100x)', () => {
  assert.deepEqual(Object.keys(E.BUYS), ['bonus']);
  assert.equal(E.BUYS.bonus.priceX, 100); assert.equal(E.BUYS.bonus.min, 3);
  assert.equal(E.MAX_BUY_EUR, 20);
  near(Object.values(E.BUYS.bonus.odds).reduce((a, b) => a + b, 0), 1);
});

test('Βύσμα: always costs 20 and always plays the bonus at 0,20', () => {
  assert.equal(E.BUY_PRICE_EUR, 20); near(E.buyBet('bonus'), 0.2);
  near(E.buyBet('bonus') * E.BUYS.bonus.priceX, E.BUY_PRICE_EUR);
});

test('Βύσμα: the trigger spin always lands at least the minimum medals, one per reel at most', () => {
  const rng = E.makeSeededRng(21), seen = { 3: 0, 4: 0, 5: 0 };
  for (const kind of ['bonus']) for (let i = 0; i < 20000; i++) {
    const g = E.buyGrid(kind, rng), n = E.evaluate(g).bonusCount;
    assert.ok(n >= E.BUYS[kind].min && n <= 5);
    for (let c = 0; c < E.REELS; c++) assert.ok(g[c].filter(s => s === BONUS).length <= 1);
    if (kind === 'bonus') seen[n]++;
  }
  assert.ok(seen[4] > 0, 'a bonus buy can land 4');
});

test('cluster: 4 of the same symbol touching pay anywhere, even away from the first reel', () => {
  const g = grid([[], [], ['SGT', 'SGT'], ['SGT', 'SGT'], [], []]);   // a 2x2 block on reels 3-4
  const w = E.evaluate(g).wins.find(x => x.kind === 'cluster');
  assert.equal(w.sym, 'SGT'); assert.equal(w.len, 4); near(w.pay, PAY.SGT[1] * E.CLUSTER_K);
});

test('cluster: 3 touching do not pay, and diagonal does not count as touching', () => {
  assert.equal(E.evaluate(grid([[], [], ['SGT', 'SGT'], ['SGT'], [], []])).wins.length, 0);
  assert.equal(E.evaluate(grid([[], [], ['SGT', '.', 'SGT'], ['.', 'SGT', '.', 'SGT'], [], []])).wins.length, 0);
});

test('cluster: a wild joins the cluster', () => {
  const g = grid([[], [], ['SGT', 'SGT'], ['SGT', WILD], [], []]);
  const w = E.evaluate(g).wins.find(x => x.kind === 'cluster');
  assert.equal(w.len, 4);
});
