// Daily profit simulation for the house.
// Each day PLAYERS new players deposit 100 each, pick a random bet level, and play a session of up to
// SESSION rounds. A player stops when they can't afford the bet, or cashes out once they double (>= 200).
// House result per day = deposits - money paid back. Also reports the extreme case where every player
// cashes out at their own best moment of the session.
// node web/daily.js [days] [players per day] [session rounds] > out.json
const E = require('./engine.js');
const DAYS = +process.argv[2] || 30, PLAYERS = +process.argv[3] || 1000, SESSION = +process.argv[4] || 300;
const START = 100, TARGET = 200, BETS = [0.2, 0.5, 1, 2, 5, 10, 20];
const rng = Math.random;
const round = bet => {
  const b = E.playBase(rng);
  const cap = Math.min(E.MAX_WIN, E.MAX_WIN_EUR / bet);
  let w = b.total;
  if (b.bonusCount >= 3) w += E.playBonus(b.bonusCount, rng).total;
  return Math.min(w, cap) * bet;
};
const days = [];
for (let d = 0; d < DAYS; d++) {
  let paid = 0, paidPeak = 0, biggest = 0, busted = 0, doubled = 0, wagered = 0;
  for (let p = 0; p < PLAYERS; p++) {
    const bet = BETS[Math.floor(rng() * BETS.length)];
    let bal = START, peak = START;
    for (let t = 0; t < SESSION && bal >= bet - 1e-9 && bal < TARGET; t++) {
      bal -= bet; wagered += bet;
      const w = round(bet); bal += w;
      if (w > biggest) biggest = w;
      if (bal > peak) peak = bal;
    }
    if (bal < bet - 1e-9) busted++;
    if (bal >= TARGET) doubled++;
    paid += bal; paidPeak += peak;
  }
  const deposits = PLAYERS * START;
  days.push({ profit: deposits - paid, profitIfPeak: deposits - paidPeak, biggest, busted, doubled, wagered });
}
console.log(JSON.stringify(days));
