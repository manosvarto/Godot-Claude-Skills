# Ιεραρχία (web prototype)

Greek Army themed 5x4, 1024-ways slot in the "card edition" art style. Demo credits only.

- `engine.js` – game math: symbols, weights, paytable, bonus rules. Edit here.
- `sim.js` – RTP simulator: `node web/sim.js 3000000 400000` (base rounds, bonuses per type, optional medal chance)
- `cards/*.jpg` – symbol art (cropped from the user's card sheets), embedded at build time.
- `background.jpg` – camp scene behind the page, embedded at build time.
- `logo.jpg` – the game logo, for use outside the game (store page, thumbnail). Not shown in the game.
- `template.html` – page, frames, bonus/wild art and UI. `/*ENGINE*/` and `/*CARDS*/` are filled in by the build.
- `build.js` – `node web/build.js` writes `chain-of-command.html`.
- `players.js` – player simulation (100 players per bet, start 100, no refill): `node web/players.js 100 20000`; `players-report.js` summarises `players-result.json`.
- `house.js` / `house-report.js` – house capital for 1000 concurrent players (results: `house-result-96.json`, `house-result-90.json`).
- `daily.js` – 365 days x 1000 new players a day, sessions up to 300 rounds, cash out at 200 (results: `daily-result.json`).

Current tuning: ~90% RTP (89.8% measured), medal respin 1 in 60 rounds, bonus 1 in 164 (~19x avg), max bonus 1 in 3,190 (~345x avg). Limits (Greek rules found online, to be confirmed with a specialist): max bet 20, 3 s minimum between paid rounds, max win 10,000x bet and at most 140,000 per round.
