# Chain of Command (web prototype)

Military-themed 5x4, 1024-ways slot. Demo credits only.

- `engine.js` – game math: symbols, weights, paytable, bonus rules. Edit here.
- `sim.js` – RTP simulator: `node web/sim.js 4000000 200000`
- `template.html` – page, art and UI. `/*ENGINE*/` is replaced with the engine.
- `build.js` – `node web/build.js` writes `chain-of-command.html`.

Current tuning: 95.97% RTP, bonus 1 in 166 spins, max bonus 1 in 3,285.
