// Daily house profit with realistic, mixed player behaviour.
// Each day PLAYERS new players. Each player gets a random profile:
//  - reloads: when the balance can't cover the smallest bet, deposits another 100 (0..6 times)
//  - target: half have none (play until broke or out of time); the rest cash out at 1.5x/2x/3x/5x of what they deposited
//  - style: steady (same bet), chaser (raises the bet after losing streaks / when down), cautious (lowers when down,
//    raises after a big win)
//  - session length: 200..1500 rounds
// When the balance is below the current bet, the bet drops to the largest affordable level.
// House result per day = all deposits - all money paid back.
// node web/daily2.js [days] [players per day] > out.json
const E = require('./engine.js');
const DAYS = +process.argv[2] || 30, PLAYERS = +process.argv[3] || 1000;
const DEPOSIT = 100, BETS = [0.2, 0.5, 1, 2, 5, 10, 20];
const rng = Math.random;
const pick = (arr, w) => { let r = rng() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { if ((r -= w[i]) < 0) return arr[i]; } return arr[arr.length - 1]; };
const round = bet => {
  const b = E.playBase(rng);
  const cap = Math.min(E.MAX_WIN, E.MAX_WIN_EUR / bet);
  let w = b.total;
  if (b.bonusCount >= 3) w += E.playBonus(b.bonusCount, rng).total;
  return Math.min(w, cap) * bet;
};

function player() {
  const reloads = pick([0, 1, 2, 3, 4, 5, 6], [40, 22, 14, 9, 6, 5, 4]);
  const target = pick([0, 1.5, 2, 3, 5], [50, 15, 15, 12, 8]);
  const style = pick(['steady', 'chaser', 'cautious'], [40, 30, 30]);
  const session = 200 + Math.floor(rng() * 1301);
  let lvl = pick([0, 1, 2, 3, 4, 5, 6], [18, 20, 22, 16, 12, 7, 5]);
  let deposited = DEPOSIT, used = 0, bal = DEPOSIT, wagered = 0, rounds = 0, lossStreak = 0, biggest = 0;
  while (rounds < session) {
    if (target && bal >= target * deposited) break;                 // cash out at target
    while (lvl > 0 && BETS[lvl] > bal + 1e-9) lvl--;                // can't afford: smaller bet
    if (BETS[lvl] > bal + 1e-9) {                                    // broke
      if (used < reloads) { used++; deposited += DEPOSIT; bal += DEPOSIT; continue; }
      break;
    }
    const bet = BETS[lvl];
    bal -= bet; wagered += bet; rounds++;
    const w = round(bet); bal += w;
    if (w > biggest) biggest = w;
    lossStreak = w > 0 ? 0 : lossStreak + 1;
    const down = bal < deposited * 0.5;
    if (style === 'chaser' && (lossStreak >= 15 || (down && rng() < 0.02)) && lvl < BETS.length - 1) { lvl++; lossStreak = 0; }
    if (style === 'cautious') {
      if (down && rng() < 0.02 && lvl > 0) lvl--;
      if (w >= 20 * bet && lvl < BETS.length - 1) lvl++;
    }
  }
  return { deposited, paid: bal, wagered, rounds, biggest, reloadsUsed: used, style };
}

const days = [];
for (let d = 0; d < DAYS; d++) {
  let dep = 0, paid = 0, wag = 0, rounds = 0, biggest = 0, winners = 0, reloads = 0;
  for (let p = 0; p < PLAYERS; p++) {
    const r = player();
    dep += r.deposited; paid += r.paid; wag += r.wagered; rounds += r.rounds; reloads += r.reloadsUsed;
    if (r.biggest > biggest) biggest = r.biggest;
    if (r.paid > r.deposited) winners++;
  }
  days.push({ deposits: dep, paid, profit: dep - paid, wagered: wag, rounds, biggest, winners, reloads });
}
console.log(JSON.stringify(days));
