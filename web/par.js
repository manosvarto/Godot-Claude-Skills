// PAR sheet simulation. Plays N paid rounds (spin + medal respins + bonus) with a seeded generator,
// so every figure can be reproduced exactly with the same seed.
// node web/par.js <rounds> <seed> <payScale> > chunk.json
// payScale multiplies every line pay in the paytable to produce the other RTP profiles.
const E = require('./engine.js');
const N = +process.argv[2] || 1e6, SEED = +process.argv[3] || 1, SCALE = +process.argv[4] || 1;
if (SCALE !== 1) {
  const p = {};
  for (const [k, v] of Object.entries(E.PAY)) p[k] = v.map(x => x * SCALE);
  E.setPay(p);
}
const rng = E.makeSeededRng(SEED);
const EDGES = [0, 1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2500, 5000, 10000];   // win buckets, x bet
const out = {
  rounds: 0, seed: SEED, scale: SCALE,
  sum: 0, sumSq: 0, max: 0, hits: 0, capped: 0,
  baseSum: 0, featSum: 0,
  respinRounds: 0, respinTriggers: 0,
  trig: { 3: 0, 4: 0, 5: 0 }, featBy: { 3: 0, 4: 0, 5: 0 },
  buckets: new Array(EDGES.length).fill(0), edges: EDGES
};
for (let i = 0; i < N; i++) {
  const b = E.playBase(rng);
  let base = b.total, feat = 0;
  if (b.respins) out.respinRounds++;
  if (b.bonusCount >= 3) {
    const k = Math.min(b.bonusCount, 5);
    feat = E.playBonus(b.bonusCount, rng).total;
    out.trig[k]++; out.featBy[k] += feat;
    if (b.respins) out.respinTriggers++;
  }
  let w = base + feat;
  if (w > E.MAX_WIN) { w = E.MAX_WIN; out.capped++; }
  out.rounds++; out.sum += w; out.sumSq += w * w; out.baseSum += Math.min(base, E.MAX_WIN); out.featSum += w - Math.min(base, E.MAX_WIN);
  if (w > 0) out.hits++;
  if (w > out.max) out.max = w;
  let j = 0; if (w > 0) { j = 1; while (j < EDGES.length - 1 && w > EDGES[j]) j++; if (w >= E.MAX_WIN) j = EDGES.length - 1; }
  out.buckets[j]++;
}
console.log(JSON.stringify(out));
