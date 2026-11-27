// Legal check of the game math. Plays full paid rounds (spin + respins + bonus) with the per-round max-win
// cap that applies at a given bet, and full «Βύσμα» buys. Seeded, so every number can be reproduced.
// node web/verify.js <rounds> <buys> <seed> <bet>  -> one JSON chunk; combine with verify-report.js
const E = require('./engine.js');
const N = +process.argv[2] || 1e6, NB = +process.argv[3] || 1e5, SEED = +process.argv[4] || 1, BET = +process.argv[5] || 1;
const rng = E.makeSeededRng(SEED);
const capX = Math.min(E.MAX_WIN, E.MAX_WIN_EUR / BET);           // max win per round at this bet, x bet
const out = { seed: SEED, bet: BET, capX, rounds: 0, sum: 0, sumSq: 0, hits: 0, max: 0, capped: 0, bonus: 0, maxBonus: 0,
  buys: 0, buySum: 0, buySumSq: 0, buyMax: 0 };
for (let i = 0; i < N; i++) {
  const b = E.playBase(rng);
  let w = b.total;
  if (b.bonusCount >= 3) { w += E.playBonus(b.bonusCount, rng).total; out.bonus++; if (b.bonusCount >= 4) out.maxBonus++; }
  if (w >= capX) { w = capX; out.capped++; }
  out.rounds++; out.sum += w; out.sumSq += w * w; if (w > 0) out.hits++; if (w > out.max) out.max = w;
}
// «Βύσμα»: costs BUY_PRICE_EUR, played at BUY_BET; return = paid back / price
const buyCapX = Math.min(E.MAX_WIN, E.MAX_WIN_EUR / E.BUY_BET);
for (let i = 0; i < NB; i++) {
  const x = Math.min(E.playBuy('bonus', rng).total, buyCapX) * E.BUY_BET / E.BUY_PRICE_EUR;   // as a share of the price
  out.buys++; out.buySum += x; out.buySumSq += x * x; if (x > out.buyMax) out.buyMax = x;
}
console.log(JSON.stringify(out));
