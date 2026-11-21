// Statistical checks of the random number generator and the symbol draw.
// These are a developer's pre-checks; an accredited lab (GLI, BMM, iTech Labs) certifies the RNG.
// node web/rngtest.js [samples]  -> prints JSON with each test, its statistic, p-value and pass/fail.
const E = require('./engine.js');
const N = +process.argv[2] || 10_000_000;
const ALPHA = 0.01;

// Normal CDF (Abramowitz-Stegun 7.1.26) and chi-square p-value (Wilson-Hilferty), fine for large df.
const phi = z => { const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2); return z >= 0 ? (1 + y) / 2 : (1 - y) / 2; };
const chiP = (x, k) => 1 - phi((Math.cbrt(x / k) - (1 - 2 / (9 * k))) / Math.sqrt(2 / (9 * k)));
const twoSided = z => 2 * (1 - phi(Math.abs(z)));

function suite(name, rng) {
  const tests = [];
  const add = (test, stat, p, detail) => tests.push({ test, stat: +stat.toFixed(4), p: +p.toFixed(4), pass: p >= ALPHA, detail });

  // 1. Uniformity: 1,000 equal bins
  const B = 1000, bins = new Float64Array(B);
  let prev = rng(), sxy = 0, sx = 0, sxx = 0, runs = 1, above = prev >= 0.5, nA = above ? 1 : 0;
  bins[Math.floor(prev * B)]++; sx += prev; sxx += prev * prev;
  for (let i = 1; i < N; i++) {
    const u = rng();
    bins[Math.floor(u * B)]++;
    sxy += prev * u; sx += u; sxx += u * u;
    const a = u >= 0.5; if (a !== above) runs++; above = a; if (a) nA++;
    prev = u;
  }
  const e = N / B; let chi = 0; for (const o of bins) chi += (o - e) ** 2 / e;
  add('Ομοιομορφία (chi-square, 1.000 κουτιά)', chi, chiP(chi, B - 1), `df=${B - 1}`);

  // 2. Lag-1 serial correlation
  const mean = sx / N, varr = sxx / N - mean * mean;
  const r1 = (sxy / (N - 1) - mean * mean) / varr;
  add('Συσχέτιση διαδοχικών τιμών (lag-1)', r1, twoSided(r1 * Math.sqrt(N)), `r=${r1.toExponential(2)}`);

  // 3. Runs above/below the median (Wald-Wolfowitz)
  const n1 = nA, n2 = N - nA, mu = 2 * n1 * n2 / N + 1, sd = Math.sqrt((mu - 1) * (mu - 2) / (N - 1));
  add('Σειρές πάνω/κάτω από τη μέση (runs test)', (runs - mu) / sd, twoSided((runs - mu) / sd), `runs=${runs}`);

  // 4. Symbol draw per reel matches the published weights
  const M = Math.min(N, 5_000_000);
  for (const [label, fs] of [['βασικό', false], ['μπόνους', true], ['μέγιστο μπόνους', 'max']]) {
    let chiS = 0, df = 0;
    for (let c = 0; c < E.REELS; c++) {
      const counts = {};
      for (let i = 0; i < M / E.REELS; i++) { const s = E.drawCell(c, rng, fs); counts[s] = (counts[s] || 0) + 1; }
      const wild = (fs === 'max' ? E.WILD_W_MAX : fs ? E.WILD_W_FS : E.WILD_W)[c];
      const w = { ...E.WEIGHTS }; if (wild) w.WILD = wild;
      const tot = Object.values(w).reduce((a, b) => a + b, 0);
      for (const [s, wt] of Object.entries(w)) { const ex = M / E.REELS * wt / tot; chiS += ((counts[s] || 0) - ex) ** 2 / ex; df++; }
      df--;
    }
    add(`Συχνότητα συμβόλων ανά τροχό (${label})`, chiS, chiP(chiS, df), `df=${df}`);
  }

  // 5. Field Marshal (bonus) rate per reel matches BONUS_P
  const G = Math.min(N / 10, 1_000_000); let medals = 0;
  for (let i = 0; i < G; i++) { const g = E.spinGrid(rng); for (let c = 0; c < E.REELS; c++) if (g[c].includes(E.BONUS)) medals++; }
  const n = G * E.REELS, p = E.BONUS_P, z = (medals - n * p) / Math.sqrt(n * p * (1 - p));
  add('Πιθανότητα Στρατάρχη ανά τροχό', z, twoSided(z), `παρατηρήθηκε ${(medals / n).toFixed(5)}, αναμένεται ${p}`);

  return { generator: name, samples: N, alpha: ALPHA, tests };
}

const out = [suite('crypto.getRandomValues (γεννήτρια του παιχνιδιού)', E.makeRng()), suite('xoshiro128** seed 1 (γεννήτρια προσομοιώσεων)', E.makeSeededRng(1))];
console.log(JSON.stringify(out, null, 1));
