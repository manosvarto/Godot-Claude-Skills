const E = require('./engine.js');
const rng = Math.random;
const N = +process.argv[2] || 2e6, NB = +process.argv[3] || 2e5;
// Base game line wins (bonus symbols can appear, scatter pay counted separately below)
let base = 0;
for (let i = 0; i < N; i++) {
  const res = E.evaluate(E.spinGrid(rng));
  for (const w of res.wins) if (w.sym !== E.BONUS) base += w.pay;
}
base /= N;
const p = E.BONUS_P, C = (n, k) => [1,5,10,10,5,1][k];
const P = k => C(5, k) * p ** k * (1 - p) ** (5 - k);
let scatter = 0; for (const k of [3,4,5]) scatter += P(k) * E.BONUS_PAY[k];
const ev = {};
for (const k of [3,4,5]) {
  let t = 0; const n = k === 5 ? NB / 4 : NB;
  for (let i = 0; i < n; i++) t += Math.min(E.playBonus(k, rng).total, E.MAX_WIN);
  ev[k] = t / n;
}
let feat = 0; for (const k of [3,4,5]) feat += P(k) * ev[k];
console.log(JSON.stringify({ base, scatter, feat, total: base + scatter + feat,
  ev, trigger3: 1 / P(3), trigger4plus: 1 / (P(4) + P(5)) }, null, 1));
