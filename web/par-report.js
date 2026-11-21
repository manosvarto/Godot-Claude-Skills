// Merges PAR chunks into a PAR sheet. node web/par-report.js <dir with par_<rtp>_<chunk>.json> <out dir>
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const [dir, outDir] = [process.argv[2], process.argv[3] || path.join(__dirname, 'par')];
const groups = {};
for (const f of fs.readdirSync(dir).filter(f => /^par_\d+_\d+\.json$/.test(f))) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8').trim(); if (!txt) continue;
  const rtp = f.split('_')[1]; (groups[rtp] ||= []).push(JSON.parse(txt));
}
const oneIn = p => p > 0 ? 1 / p : Infinity;
const profiles = [];
for (const [target, chunks] of Object.entries(groups).sort((a, b) => b[0] - a[0])) {
  const m = chunks.reduce((a, c) => {
    for (const k of ['rounds', 'sum', 'sumSq', 'hits', 'capped', 'baseSum', 'featSum', 'respinRounds', 'respinTriggers']) a[k] = (a[k] || 0) + c[k];
    a.max = Math.max(a.max || 0, c.max);
    for (const k of [3, 4, 5]) { a.trig[k] = (a.trig[k] || 0) + c.trig[k]; a.featBy[k] = (a.featBy[k] || 0) + c.featBy[k]; }
    a.buckets = a.buckets ? a.buckets.map((v, i) => v + c.buckets[i]) : c.buckets.slice();
    a.edges = c.edges; a.scale = c.scale; a.seeds = [...(a.seeds || []), c.seed];
    return a;
  }, { trig: {}, featBy: {} });
  const n = m.rounds, rtp = m.sum / n, sd = Math.sqrt(m.sumSq / n - rtp * rtp), se = sd / Math.sqrt(n);
  const bonusN = m.trig[3] + m.trig[4] + m.trig[5], maxN = m.trig[4] + m.trig[5];
  const dist = m.buckets.map((c, i) => ({
    range: i === 0 ? '0 (χωρίς κέρδος)' : i === m.buckets.length - 1 ? `${m.edges[i].toLocaleString('el-GR')}× (μέγιστο)` : `${m.edges[i - 1].toLocaleString('el-GR')}× – ${m.edges[i].toLocaleString('el-GR')}×`,
    count: c, share: c / n, oneIn: oneIn(c / n)
  }));
  profiles.push({
    targetRtp: +target, payScale: m.scale, rounds: n, seeds: m.seeds.sort((a, b) => a - b),
    rtp, ci95: [rtp - 1.96 * se, rtp + 1.96 * se], baseRtp: m.baseSum / n, featureRtp: m.featSum / n,
    hitRate: m.hits / n, sdPerRound: sd, volatilityIndex90: 1.645 * sd,
    volatility: sd < 5 ? 'Χαμηλή' : sd < 10 ? 'Μέτρια' : sd < 20 ? 'Υψηλή' : 'Πολύ υψηλή',
    maxObserved: m.max, cappedRounds: m.capped, maxWinX: E.MAX_WIN,
    respinOneIn: oneIn(m.respinRounds / n), respinToBonus: m.respinTriggers / m.respinRounds,
    bonusOneIn: oneIn(bonusN / n), maxBonusOneIn: oneIn(maxN / n),
    avgBonus: m.featBy[3] / m.trig[3], avgMaxBonus: (m.featBy[4] + m.featBy[5]) / maxN,
    trig: m.trig, distribution: dist,
    paytable: Object.fromEntries(Object.entries(E.PAY).map(([k, v]) => [k, v.map(x => +(x * m.scale).toFixed(2))]))
  });
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'par-sheet.json'), JSON.stringify({
  game: 'Greek Army', engine: 'web/engine.js', simulator: 'web/par.js', generator: 'xoshiro128** (seeded)',
  grid: '5×4, 1024 τρόποι', maxWinX: E.MAX_WIN, maxWinEur: E.MAX_WIN_EUR, maxBet: E.MAX_BET, minCycleMs: E.MIN_CYCLE_MS,
  bonusChancePerReel: E.BONUS_P, weights: E.WEIGHTS, wild: { base: E.WILD_W, bonus: E.WILD_W_FS, maxBonus: E.WILD_W_MAX },
  scatterPays: E.BONUS_PAY, profiles
}, null, 1));
const f = (x, d = 2) => x.toLocaleString('el-GR', { minimumFractionDigits: d, maximumFractionDigits: d });
for (const p of profiles) console.log(`${p.targetRtp}%: RTP ${f(p.rtp * 100)}% [${f(p.ci95[0] * 100)}–${f(p.ci95[1] * 100)}], hit ${f(p.hitRate * 100, 1)}%, sd ${f(p.sdPerRound, 1)} (${p.volatility}), max ${f(p.maxObserved, 0)}×, bonus 1/${f(p.bonusOneIn, 0)}, max 1/${f(p.maxBonusOneIn, 0)}, rounds ${p.rounds.toLocaleString('el-GR')}`);
