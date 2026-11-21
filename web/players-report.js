// Summarises web/players-result.json into a table (Greek labels).
const r = require('./players-result.json');
const med = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const f = (n, d = 0) => n.toLocaleString('el-GR', { minimumFractionDigits: d, maximumFractionDigits: d });
const rows = [];
for (const { bet, players } of r.bets) {
  const busted = players.filter(p => p.busted), alive = players.filter(p => !p.busted);
  const wag = players.reduce((a, p) => a + p.wagered, 0), won = players.reduce((a, p) => a + p.won, 0);
  const top = players.reduce((a, p) => p.peak > a.peak ? p : a);
  rows.push({
    bet, bustedN: busted.length,
    bustMedian: med(busted.map(p => p.spins)), bustMin: busted.length ? Math.min(...busted.map(p => p.spins)) : 0,
    bustMax: busted.length ? Math.max(...busted.map(p => p.spins)) : 0,
    peakMedian: med(players.map(p => p.peak)), peakTop: top.peak, peakTopSpin: top.peakSpin,
    everDoubled: players.filter(p => p.peak >= 2 * r.start).length,
    aliveN: alive.length, aliveAhead: alive.filter(p => p.final > r.start).length,
    aliveBest: alive.length ? Math.max(...alive.map(p => p.final)) : 0,
    biggest: Math.max(...players.map(p => p.biggest)),
    bonuses: players.reduce((a, p) => a + p.bonuses, 0), maxes: players.reduce((a, p) => a + p.maxes, 0),
    rtp: won / wag
  });
}
console.log(JSON.stringify(rows, null, 1));
