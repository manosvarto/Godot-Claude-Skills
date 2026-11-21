// Summarises a house-result*.json file: node web/house-report.js web/house-result-90.json
const a = require(require('path').resolve(process.argv[2]));
const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const need = a.map(x => Math.max(0, x.need)), end = a.map(x => x.houseEnd), peak = a.map(x => x.peakCashout);
console.log(JSON.stringify({
  scenarios: a.length,
  capital: { p50: q(need, .5), p90: q(need, .9), p99: q(need, .99), worst: Math.max(...need), neverNeeded: need.filter(x => x === 0).length },
  houseProfit: { avg: end.reduce((s, x) => s + x, 0) / a.length, worst: Math.min(...end), best: Math.max(...end), losing: end.filter(x => x < 0).length },
  peakCashout: { p50: q(peak, .5), p99: q(peak, .99), worst: Math.max(...peak) },
  biggestWin: Math.max(...a.map(x => x.biggest))
}, null, 1));
