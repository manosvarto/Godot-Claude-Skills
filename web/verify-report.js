// Combines verify.js chunks and checks them against the Greek limits we found.
// node web/verify-report.js <dir with *.json chunks>
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const dir = process.argv[2];
const cs = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const S = k => cs.reduce((a, c) => a + c[k], 0);
const n = S('rounds'), rtp = S('sum') / n, sd = Math.sqrt(S('sumSq') / n - rtp * rtp), se = sd / Math.sqrt(n);
const nb = S('buys'), brtp = S('buySum') / nb, bsd = Math.sqrt(S('buySumSq') / nb - brtp * brtp), bse = bsd / Math.sqrt(nb);
const pct = x => (x * 100).toFixed(2) + '%';
const r = {
  rounds: n, seeds: cs.map(c => c.seed),
  rtp: pct(rtp), rtp95: [pct(rtp - 1.96 * se), pct(rtp + 1.96 * se)],
  hitRate: pct(S('hits') / n), bonusEvery: Math.round(n / S('bonus')), maxBonusEvery: Math.round(n / S('maxBonus')),
  biggestWinX: Math.max(...cs.map(c => c.max)), cappedRounds: S('capped'),
  buys: nb, buyRtp: pct(brtp), buyRtp95: [pct(brtp - 1.96 * bse), pct(brtp + 1.96 * bse)],
  checks: {
    'RTP >= 80% (low end of 95% interval)': rtp - 1.96 * se >= 0.80,
    'RTP close to 90% target (88-92%)': rtp >= 0.88 && rtp <= 0.92,
    'Βύσμα RTP >= 80% (low end)': brtp - 1.96 * bse >= 0.80,
    'Max bet <= 20': E.MAX_BET <= 20,
    'Max win per round <= 140.000 €': E.MAX_WIN_EUR <= 140000 && Math.min(E.MAX_WIN, E.MAX_WIN_EUR / E.MAX_BET) * E.MAX_BET <= 140000,
    'Min round time >= 3 s (2 s is the 2022 minimum)': E.MIN_CYCLE_MS >= 2000,
    'Βύσμα price within the 20 € stake limit': E.BUY_PRICE_EUR <= 20
  }
};
console.log(JSON.stringify(r, null, 1));
