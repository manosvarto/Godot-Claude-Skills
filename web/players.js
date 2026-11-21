// Player simulation: N players per bet level, each starts with 100 credits, never refills,
// and plays until the balance is below the bet (bust) or MAX_SPINS rounds.
// node web/players.js [players per bet] [max spins]  ->  writes web/players-result.json
const E = require('./engine.js');
const fs = require('fs'), path = require('path');
const PLAYERS = +process.argv[2] || 100, MAX_SPINS = +process.argv[3] || 20000, START = 100;
const BETS = [0.2, 0.5, 1, 2, 5, 10, 20];
const rng = Math.random;

function playRound(bet) {
  const base = E.playBase(rng);
  let win = Math.min(base.total, E.MAX_WIN), bonus = 0, kind = null;
  if (base.bonusCount >= 3) {
    bonus = Math.min(E.playBonus(base.bonusCount, rng).total, E.MAX_WIN);
    kind = base.bonusCount >= 4 ? 'max' : 'bonus';
  }
  return { win: (win + bonus) * bet, kind, respin: base.respins > 0 };
}

const out = { start: START, players: PLAYERS, maxSpins: MAX_SPINS, bets: [] };
for (const bet of BETS) {
  const players = [];
  for (let p = 0; p < PLAYERS; p++) {
    let bal = START, peak = START, peakSpin = 0, spins = 0, biggest = 0, bonuses = 0, maxes = 0, respins = 0, wagered = 0, won = 0;
    while (bal >= bet - 1e-9 && spins < MAX_SPINS) {
      bal -= bet; wagered += bet; spins++;
      const r = playRound(bet);
      bal += r.win; won += r.win;
      if (r.win > biggest) biggest = r.win;
      if (r.kind === 'bonus') bonuses++; if (r.kind === 'max') maxes++; if (r.respin) respins++;
      if (bal > peak) { peak = bal; peakSpin = spins; }
    }
    players.push({ busted: bal < bet - 1e-9, spins, final: +bal.toFixed(2), peak: +peak.toFixed(2), peakSpin, biggest: +biggest.toFixed(2), bonuses, maxes, respins, wagered, won });
  }
  out.bets.push({ bet, players });
  const b = players.filter(x => x.busted).length;
  console.log(`bet ${bet}: busted ${b}/${PLAYERS}`);
}
fs.writeFileSync(path.join(__dirname, 'players-result.json'), JSON.stringify(out));
console.log('done');
