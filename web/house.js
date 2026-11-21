// House bankroll simulation.
// Each scenario: PLAYERS players deposit 100 each, bets spread evenly over all bet levels, all playing
// at the same time (one spin each per tick) until they bust or reach MAX_SPINS.
// The house owes every player their balance at all times, so it stays solvent while
//   capital + deposits >= sum of balances.
// Capital needed in a scenario = max over time of (sum of balances) - deposits.
// Also reports the extreme case where every player cashes out at their own best moment.
// node web/house.js [scenarios] [players] [maxSpins] > out.json
const E = require('./engine.js');
const SCEN = +process.argv[2] || 10, PLAYERS = +process.argv[3] || 1000, MAX_SPINS = +process.argv[4] || 20000;
const START = 100, BETS = [0.2, 0.5, 1, 2, 5, 10, 20];
const rng = Math.random;
const round = bet => {
  const b = E.playBase(rng);
  let w = Math.min(b.total, E.MAX_WIN);
  if (b.bonusCount >= 3) w += Math.min(E.playBonus(b.bonusCount, rng).total, E.MAX_WIN);
  return w * bet;
};
const results = [];
for (let s = 0; s < SCEN; s++) {
  const L = new Float64Array(MAX_SPINS + 1);     // sum of balances after each tick
  const tail = new Float64Array(MAX_SPINS + 2);  // balances of players who stopped, from their stop tick on
  let sumPeak = 0, biggest = 0, final = 0;
  for (let p = 0; p < PLAYERS; p++) {
    const bet = BETS[p % BETS.length];
    let bal = START, peak = START, t = 0;
    L[0] += bal;
    while (bal >= bet - 1e-9 && t < MAX_SPINS) {
      bal -= bet; const w = round(bet); bal += w; t++;
      if (w > biggest) biggest = w;
      if (bal > peak) peak = bal;
      L[t] += bal;
    }
    tail[t + 1] += bal;
    sumPeak += peak; final += bal;
  }
  let run = 0, maxL = 0, maxT = 0;
  for (let t = 0; t <= MAX_SPINS; t++) { run += tail[t]; const v = L[t] + run; if (v > maxL) { maxL = v; maxT = t; } }
  const deposits = PLAYERS * START;
  results.push({ need: maxL - deposits, at: maxT, houseEnd: deposits - final, peakCashout: sumPeak - deposits, biggest });
}
console.log(JSON.stringify(results));
