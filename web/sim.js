// RTP simulator. node web/sim.js [base rounds] [bonuses per type] [bonusP]
const E = require('./engine.js');
const rng = Math.random;
const N = +process.argv[2] || 2e6, NB = +process.argv[3] || 2e5;
if (process.argv[4]) E.setBonusP(+process.argv[4]);
let base = 0, hits = 0, respinRounds = 0;
const trig = { 3: 0, 4: 0, 5: 0 };
for (let i = 0; i < N; i++) {
  const r = E.playBase(rng);
  base += Math.min(r.total, E.MAX_WIN); if (r.total > 0) hits++; if (r.respins) respinRounds++;
  if (r.bonusCount) trig[Math.min(r.bonusCount, 5)]++;
}
const ev = {};
for (const k of [3, 4, 5]) { let t = 0; const n = k === 5 ? NB / 4 : NB; for (let i = 0; i < n; i++) t += E.playBonus(k, rng).total; ev[k] = t / n; }
let feat = 0; for (const k of [3, 4, 5]) feat += trig[k] / N * ev[k];
base /= N;
console.log(JSON.stringify({ base, feat, total: base + feat, ev, hitRate: hits / N,
  respinEvery: N / respinRounds, bonusEvery: N / (trig[3] + trig[4] + trig[5]), maxEvery: N / (trig[4] + trig[5]) }, null, 1));
